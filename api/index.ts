import { createDeliveryQuote, verifyDeliveryQuote, DeliveryQuoteError } from './addressDelivery.js';
import { installSecurity, normalizePhone, priceCart } from './security.js';
import { randomInt } from 'node:crypto';
import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { INITIAL_DELIVERY_AREAS, calculateDeliveryCharge, findDeliveryArea, DeliveryAreaRecord } from "../src/deliveryData.js";
import { forwardMapbox, reverseMapbox, drivingRoute, validCoordinates, deliveryFeeForRoute } from "../src/lib/mapbox.js";
import { sendOrderConfirmationSMS, sendOrderStatusSMS, isSMSGatewayConfigured, isSMSPKConfigured, isTwilioConfigured } from "./smsService.js";
import {
  sendOrderConfirmationEmail,
  sendTestEmail,
  generateOrderReceiptHtml,
  generateOrderReceiptPlainText,
  isEmailServiceConfigured,
  EMAIL_RECEIPT_LOGS
} from "./emailService.js";

const app = express();

installSecurity(app);
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error) return res.status(error.status === 413 ? 413 : 400).json({error: 'Invalid request body.'});
  next();
});

// Initialize Supabase Client
const dbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://dlinknypnlmcrhgbediu.supabase.co";
const dbKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_KkOjGDoE3yq7tKIKzIfajg_sIoyPlUT";
const dbClient = createClient(dbUrl, dbKey);

// Dynamic delivery areas store initialized with 299 baseline records
let CUSTOM_DELIVERY_AREAS: DeliveryAreaRecord[] = [...INITIAL_DELIVERY_AREAS];

// In-memory data structures
const ACTIVE_ORDERS: any[] = [];
const CHAT_SESSIONS: Record<string, { username: string; phone: string; messages: any[] }> = Object.create(null);

let CUSTOMER_REVIEWS = [
  {
    id: "rev-1",
    name: "Muhammad Siddique",
    rating: 5,
    city: "Islamabad",
    review: "The Chakki Atta is incredibly pure. The rotis stay soft even after several hours, unlike the commercial packed packet flours. Delivery in F-11 Islamabad was fast within 3 hours. Will definitely purchase again!",
    date: "2026-06-18"
  },
  {
    id: "rev-2",
    name: "Ayesha Khan",
    rating: 5,
    city: "Rawalpindi",
    review: "I ordered Basmati Kainat (430) and Daal Mong. The rice length is exceptionally long and cooked grains are completely separate. Truly premium Pakistani grocery quality they are running. Very proud of this local business!",
    date: "2026-06-15"
  },
  {
    id: "rev-3",
    name: "Zarrar Mughal",
    rating: 5,
    city: "Rawalpindi",
    review: "Babay Dee multigrain diet flour is fantastic for blood sugar control. My father has diabetic and his readings are stable now. Sourced very cleanly. Sincere prayers for Babay Dee team in Rawalpindi.",
    date: "2026-06-12"
  }
];

const CATEGORIES = [
  { id: "flour", name: "Atta & Flour", desc: "Pure stone-ground whole wheat, grain, and corn flours from our local Chakki", icon: "Wheat" },
  { id: "rice", name: "Premium Rice", desc: "Aromatic Basmati Kainat and Kernel rice aged to perfection", icon: "Salad" },
  { id: "lentils", name: "Daal & Lentils", desc: "Protein-rich, triple machine-cleaned local pulses and legumes", icon: "Disc" },
  { id: "dry_fruits", name: "Premium Dry Fruits", desc: "Crispy energy-packed almond kernels, cashews, raisins, and dates", icon: "Sun" },
  { id: "herbs", name: "Herbs & Special Items", desc: "100% natural psyllium husk, fennel, black seed, chia, and raw honey", icon: "Leaf" }
];

function mapSupabaseProduct(p: any) {
  const pId = String(p.id);
  const name = p["product name"] || p.name || "";
  const price = parseFloat(String(p.price).replace(/,/g, "")) || 0;
  
  const numId = parseInt(pId, 10);
  let category = "herbs";
  const dbCategory = p["Product Category"] || p["product_category"] || p["product category"] || p["Product Categories"] || p["product categories"] || p.category;
  
  if (dbCategory && typeof dbCategory === "string" && dbCategory.trim() !== "") {
    const normCategory = dbCategory.trim().toLowerCase();
    if (normCategory.includes("flour") || normCategory.includes("atta")) {
      category = "flour";
    } else if (normCategory.includes("rice") || normCategory.includes("chawal")) {
      category = "rice";
    } else if (normCategory.includes("lentil") || normCategory.includes("daal") || normCategory.includes("pulse")) {
      category = "lentils";
    } else if (normCategory.includes("dry") || normCategory.includes("fruit")) {
      category = "dry_fruits";
    } else if (normCategory.includes("herb") || normCategory.includes("supplement")) {
      category = "herbs";
    } else {
      category = normCategory;
    }
  } else {
    if (numId >= 1 && numId <= 15) category = "flour";
    else if (numId >= 16 && numId <= 25) category = "rice";
    else if (numId >= 26 && numId <= 41) category = "lentils";
    else if (numId >= 42 && numId <= 44) category = "flour";
    else if (numId >= 45 && numId <= 94) category = "dry_fruits";
    else if (numId >= 622 && numId <= 724) category = "herbs";
  }

  let unit = "Kg";
  let outOfStock = false;
  const rawQty = String(p.quantity || "").trim();
  const parsedQty = parseFloat(rawQty.replace(/,/g, ""));

  if (!isNaN(parsedQty)) {
    if (parsedQty <= 0) outOfStock = true;
    if (parsedQty > 50) {
      if (category === "flour" || category === "rice" || category === "lentils") {
        unit = "Kg";
      } else {
        unit = "Pack";
      }
    } else {
      unit = `${rawQty} Kg`;
    }
  } else {
    if (rawQty.toLowerCase().includes("out of stock") || rawQty.toLowerCase().includes("sold out") || rawQty === "0") {
      outOfStock = true;
      unit = "Kg";
    } else {
      unit = rawQty || "Kg";
    }
  }

  let code = pId;
  if (p.place) {
    const codeMatch = p.place.match(/Code:\s*([^\s|]+)/);
    if (codeMatch) code = codeMatch[1];
  }

  const specs: Record<string, string> = { "Product Code": code };
  if (category === "flour") {
    specs["Milling Style"] = "Chakki Stone-Ground";
    specs["Organic Nature"] = "100% Pure, Zero Preservatives";
  } else if (category === "dry_fruits") {
    specs["Purity Grade"] = "A-Grade Premium Export Quality";
  } else if (category === "herbs") {
    specs["Sourcing"] = "Double sieved, shade dried";
  }

  let img = "chakki_atta.png";
  if (category === "flour") {
    if (name.toLowerCase().includes("makai")) img = "makai_atta_yellow.png";
    else if (name.toLowerCase().includes("diet") || name.toLowerCase().includes("multi")) img = "diet_atta_multigrain.png";
    else if (name.toLowerCase().includes("jo")) img = "jo_atta.png";
    else if (name.toLowerCase().includes("suji")) img = "suji.png";
    else if (name.toLowerCase().includes("maida")) img = "maida.png";
    else if (name.toLowerCase().includes("besan")) img = "besan.png";
    else if (name.toLowerCase().includes("bajra")) img = "bajra_atta.png";
    else img = "chakki_atta.png";
  } else if (category === "rice") img = "basmati_kainat_340.png";
  else if (category === "lentils") img = "daal_mong.png";
  else if (category === "dry_fruits") {
    if (name.toLowerCase().includes("badaam")) img = "badaam_giri.png";
    else if (name.toLowerCase().includes("kishmish")) img = "sugi_gol_kishmish.png";
    else if (name.toLowerCase().includes("kaju")) img = "kaju_roasted.png";
    else if (name.toLowerCase().includes("akhrot")) img = "akhrot_giri.png";
    else if (name.toLowerCase().includes("khajoor")) img = "khajoor_rabi_irani.png";
    else img = "badaam_giri.png";
  } else if (category === "herbs") {
    if (name.toLowerCase().includes("ispaghol")) img = "ispaghol_husk.png";
    else img = "herbal_supplement.png";
  }

  const qtyStr = String(p.quantity || "").toLowerCase().trim();
  const placeStr = String(p.place || "").toLowerCase().trim();
  const nameStr = String(name || "").toLowerCase().trim();
  
  if (
    p.out_of_stock === true || p.out_of_stock === "true" || p.outOfStock === true || p.is_out_of_stock === true ||
    p.status === "out of stock" || p.status === "out-of-stock" ||
    qtyStr === "0" || qtyStr === "out of stock" || qtyStr === "out-of-stock" || qtyStr === "sold out" ||
    placeStr.includes("out of stock") || placeStr.includes("out-of-stock") || placeStr.includes("sold out") ||
    nameStr.includes("out of stock") || nameStr.includes("out-of-stock")
  ) {
    outOfStock = true;
  }

  const rawProductImage = p["Product Images"] || p["product image"] || p["product_image"] || p["Product Image"] || p["product_images"] || p.productImage;
  let productImage = undefined;
  if (rawProductImage && typeof rawProductImage === "string") {
    const trimmed = rawProductImage.trim();
    if (trimmed && trimmed.toLowerCase() !== "none" && trimmed.toLowerCase() !== "null" && trimmed.toLowerCase() !== "undefined" && trimmed !== "") {
      productImage = trimmed;
    }
  }

  let calories = "340 kcal";
  let protein = "10.0g";
  let fiber = "7.0g";
  const lowerName = name.toLowerCase();

  if (category === "flour") {
    if (lowerName.includes("multigrain") || lowerName.includes("diet")) {
      calories = "320 kcal"; protein = "14.5g"; fiber = "11.2g";
    } else if (lowerName.includes("makai") || lowerName.includes("corn")) {
      calories = "365 kcal"; protein = "9.4g"; fiber = "7.3g";
    } else if (lowerName.includes("jo") || lowerName.includes("barley")) {
      calories = "354 kcal"; protein = "12.0g"; fiber = "17.0g";
    } else if (lowerName.includes("besan")) {
      calories = "387 kcal"; protein = "22.0g"; fiber = "10.0g";
    } else if (lowerName.includes("bajra")) {
      calories = "360 kcal"; protein = "11.6g"; fiber = "8.5g";
    } else {
      calories = "340 kcal"; protein = "13.2g"; fiber = "10.7g";
    }
  } else if (category === "rice") {
    calories = "350 kcal"; protein = "7.5g"; fiber = "1.2g";
  } else if (category === "lentils") {
    calories = "347 kcal"; protein = "24.0g"; fiber = "16.3g";
  }

  return {
    id: pId,
    name,
    price,
    unit,
    desc: p.desc || `${name} (${unit}) - Pure traditional premium product supplied by Babay Dee Chakki.`,
    img,
    productImage,
    category,
    featured: numId <= 15 || numId === 45 || numId === 631,
    popular: numId <= 10 || numId === 61 || numId === 631,
    badge: numId === 4 ? "Bestseller" : numId === 8 ? "Wellness" : numId === 631 ? "100% Pure" : undefined,
    specs,
    outOfStock,
    nutrition: { calories, protein, fiber }
  };
}

async function getSupabaseProducts(): Promise<any[]> {
  try {
    const { data, error } = await dbClient.from("products").select("*");
    if (error || !data || data.length === 0) return [];
    data.sort((a: any, b: any) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    const mapped = data.map(mapSupabaseProduct);
    const seenIds = new Set<string>();
    return mapped.map((prod) => {
      let uniqueId = prod.id;
      let counter = 1;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${prod.id}_dup${counter}`;
        counter++;
      }
      seenIds.add(uniqueId);
      return { ...prod, id: uniqueId };
    });
  } catch {
    return [];
  }
}

// Helper function to trigger order notifications to the configured Ntfy topic immediately after successful checkout
async function triggerOrderNotification(order: any): Promise<boolean> {
  try {
    const ntfyTopic = process.env.NTFY_TOPIC;
    const ntfyToken = process.env.NTFY_TOKEN;
    if (!ntfyTopic || !ntfyToken) return false;
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsText = items
      .map((item: any) => `• ${item.name || "Item"} (${item.quantity || 1} ${item.unit || "unit"}) @ Rs.${item.price || 0} = Rs.${(item.price || 0) * (item.quantity || 1)}`)
      .join("\n") || "• Atta / Chakki Products";
    const formattedDateTime = new Date(order.createdAt || Date.now()).toLocaleString("en-US", { timeStyle: "medium", dateStyle: "long" });

    const deliverySummaryText = `Rs. ${order.deliveryCharges ?? 0}`;
    const custName = order.customer?.name || order.name || "Valued Customer";
    const custPhone = order.customer?.phone || order.phone || "";
    const custAddr = order.customer?.address || order.address || "";
    const custArea = order.customer?.area || order.area || "";

    const ntfyBody = `🌾 NEW CHAKKI ORDER RECEIVED!
-------------------------------
Order Code: ${order.id || "BDEC-ORDER"}
Milled Date & Time: ${formattedDateTime}

[Customer Coordinates]
Name: ${custName}
Contact Number: ${custPhone}
Address: ${custAddr}${custArea ? `, ${custArea}` : ""}

[Basket Ledger Summary]
${itemsText}

Sourced Subtotal: Rs. ${order.subtotal ?? 0}
Express Delivery Fee: ${deliverySummaryText}
${(order.discount || 0) > 0 ? `Milestone Discount: Rs. ${order.discount}\n` : ""}-------------------------------
Grand Total Ledger: Rs. ${order.total ?? 0}
Settlement Method: ${order.paymentMethod || "Cash on Delivery"}`;

    const titleText = `New Order Received: ${order.id || "Order"}`;
    const response = await fetch(`https://ntfy.sh/${ntfyTopic}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ntfyToken}`,
        "Title": titleText,
        "Priority": "high",
        "Tags": "ear_of_rice,shopping_bags,bell"
      },
      body: ntfyBody
    });
    console.log(`Ntfy notification dispatched successfully (status: ${response.status}) to topic: ${ntfyTopic}`);
    return response.ok;
  } catch (err) {
    console.warn("Ntfy trigger exception:", err);
    return false;
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", businessName: "Babay Dee Atta Chakki" });
});

app.get("/api/categories", (req, res) => {
  res.json(CATEGORIES);
});

app.get("/api/products", async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let products = await getSupabaseProducts();

    if (category && category !== "all") {
      products = products.filter(p => p.category === category);
    }
    if (search) {
      const searchStr = String(search).toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(searchStr) || p.desc.toLowerCase().includes(searchStr));
    }
    if (sort === "price-asc") products.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") products.sort((a, b) => b.price - a.price);
    else if (sort === "alphabetic") products.sort((a, b) => a.name.localeCompare(b.name));

    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/featured-products", async (req, res) => {
  try {
    const products = await getSupabaseProducts();
    res.json(products.filter(p => p.featured === true));
  } catch {
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

app.get("/api/popular-products", async (req, res) => {
  try {
    const products = await getSupabaseProducts();
    res.json(products.filter(p => p.popular === true));
  } catch {
    res.status(500).json({ error: "Failed to fetch popular products" });
  }
});

app.get("/api/product/:id", async (req, res) => {
  try {
    const products = await getSupabaseProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.post("/api/cart", (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid cart items schema." });
  }
  res.json({ success: true, count: items.length });
});

app.get("/api/reviews", (req, res) => {
  res.json(CUSTOMER_REVIEWS);
});

app.post("/api/reviews", (req, res) => {
  const { name, rating, review, city } = req.body;
  if (typeof name !== 'string' || name.length > 120 || typeof review !== 'string' || review.length > 3000 || !name.trim() || !review.trim() || (city && (typeof city !== 'string' || city.length > 100))) {
    return res.status(400).json({ error: "Name, rating and review fields are mandatory." });
  }
  const rNum = parseInt(rating);
  if (isNaN(rNum) || rNum < 1 || rNum > 5) {
    return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
  }
  const sanitizedName = String(name).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  const sanitizedReview = String(review).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  const sanitizedCity = city ? String(city).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() : "Rawalpindi";

  const newObj = {
    id: "rev-" + Date.now(),
    name: sanitizedName,
    rating: rNum,
    city: sanitizedCity,
    review: sanitizedReview,
    date: new Date().toISOString().split("T")[0]
  };
  CUSTOMER_REVIEWS.unshift(newObj);
  CUSTOMER_REVIEWS = CUSTOMER_REVIEWS.slice(0, 500);
  res.json({ success: true, review: newObj });
});

app.post("/api/order/feedback", requireOrderPhone, (req, res) => {
  const { orderId, rating, comment, customerName, bot_trap } = req.body;
  if (bot_trap) {
    return res.json({ success: true, message: "Feedback submitted successfully!" });
  }
  if (!rating || isNaN(Number(rating))) {
    return res.status(400).json({ error: "Delivery rating value between 1 and 5 is required." });
  }
  const numericRating = Math.max(1, Math.min(5, parseInt(String(rating), 10)));
  const sanitizedName = customerName ? String(customerName).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() : "Valued Customer";
  const sanitizedComment = comment ? String(comment).replace(/</g, "&lt;").replace(/>/g, "&gt;").trim() : "";

  const feedbackEntry = {
    id: "fb-" + Date.now(),
    orderId: orderId || "N/A",
    name: sanitizedName,
    rating: numericRating,
    city: "Rawalpindi / Islamabad",
    review: sanitizedComment || `Rated delivery experience ${numericRating}/5 stars. Excellent service!`,
    date: new Date().toISOString().split("T")[0]
  };

  if (numericRating >= 4 && sanitizedComment.length >= 3) {
    CUSTOMER_REVIEWS.unshift({
      id: feedbackEntry.id,
      name: feedbackEntry.name,
      rating: feedbackEntry.rating,
      city: feedbackEntry.city,
      review: `${feedbackEntry.review} (Order ${orderId || ""})`,
      date: feedbackEntry.date
    });
  }

  res.json({
    success: true,
    message: "Thank you! Your delivery feedback has been recorded successfully.",
    feedback: feedbackEntry
  });
});

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN || "";

export async function serverReverseGeocode(lat: number, lng: number) {
  const place = await reverseMapbox(lat, lng, MAPBOX_TOKEN);
  return place || { address: "", city: "", area: "", details: undefined };
}

export async function serverGeocodeAddress(query: string) {
  return (await forwardMapbox(query, MAPBOX_TOKEN, { autocomplete: false }))[0] || null;
}

// Helper: Fetch dynamic delivery settings from Supabase delivery_settings table
export async function getSupabaseDeliverySettings() {
  const fallbackSettings = {
    storeLatitude: 33.567348,
    storeLongitude: 73.104510,
    pricePerKm: 50,
    maxDeliveryDistanceKm: 45,
    storeAddress: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
    storeName: "Babay Dee Atta Chakki"
  };

  if (!dbClient) return fallbackSettings;

  try {
    const { data, error } = await dbClient.from("delivery_settings").select("*").limit(1).abortSignal(AbortSignal.timeout(5000));
    if (!error && data && data.length > 0) {
      const row = data[0];
      const lat = parseFloat(row.store_latitude ?? row.store_lat ?? row.latitude ?? row.lat ?? row["Store Latitude"] ?? row["store latitude"]);
      const lng = parseFloat(row.store_longitude ?? row.store_lng ?? row.longitude ?? row.lng ?? row["Store Longitude"] ?? row["store longitude"]);
      const price = parseFloat(row.price_per_km ?? row.price_per_kilometer ?? row.delivery_rate ?? row.rate_per_km ?? row.rate ?? row["Price Per KM"] ?? row["Price per km"]);
      const maxDist = parseFloat(row.max_delivery_distance ?? row.max_delivery_distance_km ?? row.max_distance_km ?? row.max_distance ?? row.maximum_delivery_distance ?? row["Max Delivery Distance"]);

      if (!isNaN(lat) && lat !== 0) fallbackSettings.storeLatitude = lat;
      if (!isNaN(lng) && lng !== 0) fallbackSettings.storeLongitude = lng;
      if (!isNaN(price) && price > 0) fallbackSettings.pricePerKm = price;
      if (!isNaN(maxDist) && maxDist > 0) fallbackSettings.maxDeliveryDistanceKm = maxDist;
      if (row.store_address || row.address) fallbackSettings.storeAddress = row.store_address || row.address;
      if (row.store_name || row.name) fallbackSettings.storeName = row.store_name || row.name;
    }
  } catch (err) {
    console.warn("Could not query delivery_settings from Supabase, using defaults:", err);
  }

  return fallbackSettings;
}

export async function computeMapboxDrivingDistance(originLat: number, originLng: number, destLat: number, destLng: number) {
  return drivingRoute(originLat, originLng, destLat, destLng, MAPBOX_TOKEN);
}

// Delivery Settings API Endpoint
app.get("/api/delivery/settings", async (req, res) => {
  try {
    const settings = await getSupabaseDeliverySettings();
    return res.json({
      success: true,
      data: settings
    });
  } catch (err: any) {
    return res.json({
      success: true,
      data: {
        storeLatitude: 33.567348,
        storeLongitude: 73.104510,
        pricePerKm: 50,
        maxDeliveryDistanceKm: 30,
        storeAddress: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
        storeName: "Babay Dee Atta Chakki"
      }
    });
  }
});

// Server-side Reverse Geocode Endpoint
app.post("/api/delivery/reverse-geocode", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const lat = typeof latitude === "number" ? latitude : NaN;
    const lng = typeof longitude === "number" ? longitude : NaN;

    if (!validCoordinates(lat, lng)) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }

    const geoResult = await serverReverseGeocode(lat, lng);
    return res.json({
      success: true,
      ...geoResult,
      latitude: lat,
      longitude: lng
    });
  } catch (err: any) {
    console.error("Reverse geocode endpoint exception:", err);
    return res.status(500).json({ error: err?.message || "Failed to reverse geocode location." });
  }
});

// Server-side Forward Geocode Endpoint
app.post("/api/delivery/geocode", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({ error: "Address string is required." });
    }

    const geoResult = await serverGeocodeAddress(address.trim());
    if (!geoResult) {
      return res.status(404).json({ error: "Could not find coordinates for this address." });
    }

    return res.json({
      success: true,
      latitude: geoResult.lat,
      longitude: geoResult.lng,
      address: geoResult.address,
      city: geoResult.city,
      area: geoResult.area,
      details: geoResult.details,
      accuracy: geoResult.accuracy,
      featureType: geoResult.featureType
    });
  } catch (err: any) {
    console.error("Geocode endpoint exception:", err);
    return res.status(500).json({ error: err?.message || "Failed to geocode address." });
  }
});

// Mapbox address autocomplete, biased toward the selected map location.
app.post("/api/delivery/autocomplete", async (req, res) => {
  try {
    const { text, proximity } = req.body || {};
    if (typeof text !== "string" || text.trim().length < 2) return res.json({ success: true, results: [] });
    const results = await forwardMapbox(text, MAPBOX_TOKEN, { proximity });
    return res.json({ success: true, results });
  } catch {
    return res.status(503).json({ success: false, error: "Address search is unavailable. Please retry or place your pin manually." });
  }
});

app.post("/api/delivery/quote", async (req, res) => {
  try {
    const settings = await getSupabaseDeliverySettings();
    return res.json(await createDeliveryQuote(req.body?.address, settings, MAPBOX_TOKEN));
  } catch (error) {
    return res.status(error instanceof DeliveryQuoteError ? error.status : 503).json({ success: false, deliverable: false, error: error instanceof DeliveryQuoteError ? error.message : "Unable to calculate delivery charges. Please try again." });
  }
});

app.post("/api/delivery/calculate-route", async (req, res) => {
  const { latitude, longitude, address } = req.body || {};
  const lat = typeof latitude === "number" ? latitude : Number.NaN;
  const lng = typeof longitude === "number" ? longitude : Number.NaN;
  if (!validCoordinates(lat, lng)) return res.status(400).json({ success: false, error: "Valid latitude and longitude are required." });
  try {
    const settings = await getSupabaseDeliverySettings();
    const [route, geo] = await Promise.all([
      computeMapboxDrivingDistance(settings.storeLatitude, settings.storeLongitude, lat, lng),
      serverReverseGeocode(lat, lng).catch(() => ({ address: "", city: "", area: "", details: undefined })),
    ]);
    const deliverable = route.distanceKm <= settings.maxDeliveryDistanceKm;
    return res.json({
      ...route, deliverable,
      deliveryCharge: deliveryFeeForRoute(route.distanceKm, settings.pricePerKm),
      pricePerKm: settings.pricePerKm, maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
      city: geo.city, area: geo.area, details: geo.details,
      storeLocation: { lat: settings.storeLatitude, lng: settings.storeLongitude, address: settings.storeAddress, name: settings.storeName },
      // Preserve the actual customer pin. Reverse-geocoder centroids never replace it.
      customerLocation: { lat, lng, address: typeof address === "string" && address.trim() ? address.trim() : geo.address, city: geo.city, area: geo.area },
      message: deliverable ? "Driving route verified." : "Delivery is available within " + settings.maxDeliveryDistanceKm + " km by road.",
    });
  } catch (error: any) {
    return res.status(503).json({ success: false, deliverable: false, error: error.message || "Unable to verify delivery charges. Please retry." });
  }
});

// Delivery Areas Management APIs
app.get("/api/delivery-areas", async (req, res) => {
  try {
    if (dbClient) {
      const { data, error } = await dbClient.from("delivery_areas_charges").select("*");
      if (!error && data && data.length > 0) {
        const mappedFromDb: DeliveryAreaRecord[] = data.map((row: any) => {
          const numId = typeof row.id === "number" ? row.id : parseInt(String(row.id).replace(/\D/g, ""), 10) || 1;
          const formattedId = row.id && String(row.id).startsWith("DEL-") ? String(row.id) : `DEL-${String(numId).padStart(3, "0")}`;
          const city = row.City || row.city || "Rawalpindi";
          const areaName = row["Area/Neighborhood/Sector"] || row["Area / Neighborhood / Sector"] || row.area || row.neighborhood || "";
          const cat = row.category || row.Category || "Neighborhood/Society";
          const dist = typeof row.distance_km === "number" ? row.distance_km : parseFloat(row.distance || row.Distance || "5") || 5;
          const rate = typeof row.delivery_rate === "number" ? row.delivery_rate : parseFloat(row["Delivery Rate (Rs/km)"] || "50") || 50;
          const isAvail = row.delivery_available === false || row.delivery_available === "NO" || row.available === false ? false : true;
          const note = row.recommended_pricing_note || row["Recommended Pricing Note"] || "Baseline distance; verify exact address/pin";
          const charge = calculateDeliveryCharge(dist, rate);

          return {
            id: formattedId,
            numericId: numId,
            city,
            area: areaName,
            category: cat,
            distanceKm: dist,
            deliveryRate: rate,
            deliveryCharge: charge,
            available: isAvail,
            pricingNote: note
          };
        });
        return res.json({ success: true, count: mappedFromDb.length, data: mappedFromDb });
      }
    }
  } catch (err) {
    console.warn("Db fetch for delivery areas fallback to in-memory dataset:", err);
  }
  return res.json({ success: true, count: CUSTOM_DELIVERY_AREAS.length, data: CUSTOM_DELIVERY_AREAS });
});

app.post("/api/admin/delivery-areas", (req, res) => {
  try {
    const { city, area, category, distanceKm, deliveryRate, available, pricingNote } = req.body;
    if (!city || !area) {
      return res.status(400).json({ error: "City and Area name are required." });
    }
    const dist = parseFloat(distanceKm) || 0;
    const rate = parseFloat(deliveryRate) || 50;
    const nextNumId = CUSTOM_DELIVERY_AREAS.length > 0 
      ? Math.max(...CUSTOM_DELIVERY_AREAS.map(a => a.numericId)) + 1 
      : 300;
    const newRecord: DeliveryAreaRecord = {
      id: `DEL-${String(nextNumId).padStart(3, "0")}`,
      numericId: nextNumId,
      city: String(city).trim(),
      area: String(area).trim(),
      category: category || "Neighborhood/Society",
      distanceKm: dist,
      deliveryRate: rate,
      deliveryCharge: calculateDeliveryCharge(dist, rate),
      available: available !== false,
      pricingNote: pricingNote || "Custom added area"
    };

    CUSTOM_DELIVERY_AREAS.unshift(newRecord);
    return res.json({ success: true, message: "Delivery area created successfully", data: newRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to add delivery area" });
  }
});

app.put("/api/admin/delivery-areas/:id", (req, res) => {
  try {
    const targetId = req.params.id;
    const index = CUSTOM_DELIVERY_AREAS.findIndex(a => a.id === targetId || String(a.numericId) === targetId);
    if (index === -1) {
      return res.status(404).json({ error: "Delivery area not found." });
    }
    const existing = CUSTOM_DELIVERY_AREAS[index];
    const dist = req.body.distanceKm !== undefined ? parseFloat(req.body.distanceKm) : existing.distanceKm;
    const rate = req.body.deliveryRate !== undefined ? parseFloat(req.body.deliveryRate) : existing.deliveryRate;
    const isAvail = req.body.available !== undefined ? Boolean(req.body.available) : existing.available;

    const updated: DeliveryAreaRecord = {
      ...existing,
      city: req.body.city ? String(req.body.city).trim() : existing.city,
      area: req.body.area ? String(req.body.area).trim() : existing.area,
      category: req.body.category || existing.category,
      distanceKm: dist,
      deliveryRate: rate,
      deliveryCharge: calculateDeliveryCharge(dist, rate),
      available: isAvail,
      pricingNote: req.body.pricingNote || existing.pricingNote
    };

    CUSTOM_DELIVERY_AREAS[index] = updated;
    return res.json({ success: true, message: "Delivery area updated successfully", data: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to update delivery area" });
  }
});

app.delete("/api/admin/delivery-areas/:id", (req, res) => {
  const targetId = req.params.id;
  CUSTOM_DELIVERY_AREAS = CUSTOM_DELIVERY_AREAS.filter(a => a.id !== targetId && String(a.numericId) !== targetId);
  return res.json({ success: true, message: "Delivery area deleted successfully" });
});

app.post("/api/checkout", async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      area,
      subLocation,
      cartItems,
      paymentMethod,
      fulfillmentType = "delivery",
      deliveryDate,
      deliverySlot,
      distanceKm: reqDistanceKm,
      latitude: reqLat,
      longitude: reqLng,
      customerCoordinates
    } = req.body;

    const isPickup = fulfillmentType === "pickup";
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120 || !/^03\d{9}$/.test(normalizePhone(phone)) || (email && (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) || (!isPickup && (typeof address !== 'string' || address.length > 600))) {
      return res.status(400).json({error: 'Please provide valid customer details.'});
    }
    if (!['pickup', 'delivery'].includes(fulfillmentType)) return res.status(400).json({error: 'Invalid fulfillment type.'});

    if (!name || !phone || (!isPickup && !address)) {
      return res.status(400).json({ error: "Customer name, contact phone, and delivery address are required." });
    }

    const settings = await getSupabaseDeliverySettings();
    let quote: ReturnType<typeof verifyDeliveryQuote> | null = null;
    if (!isPickup) {
      try { quote = verifyDeliveryQuote(req.body.deliveryQuoteToken, address, settings); }
      catch (error) { return res.status(409).json({error: "Please calculate delivery charges again before placing your order."}); }
    }
    const validCity = isPickup ? "Rawalpindi" : quote.city;
    const validArea = isPickup ? "Store pickup" : quote.area;
    const custLat = quote?.latitude;
    const custLng = quote?.longitude;
    const hasCoordinates = !isPickup && validCoordinates(custLat, custLng);
    const computedDistanceKm = quote?.distanceKm ?? 0;
    const computedDeliveryFee = quote?.deliveryCharge ?? 0;

    const catalog = await getSupabaseProducts();
    if (!catalog.length) return res.status(503).json({error: 'The catalog is temporarily unavailable. Please try again.'});
    let validCartItems;
    try { validCartItems = priceCart(cartItems || req.body.items, catalog); }
    catch (error: any) { return res.status(400).json({error: error.message}); }
    const subtotal = Math.round(validCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
    
    // Delivery charge is 0 for store pickup, or standard calculated distance fee for delivery
    const finalDeliveryCharge = isPickup ? 0 : computedDeliveryFee;
    const discount = 0;
    const total = subtotal + finalDeliveryCharge;

    const numericId = randomInt(100000000, 2000000000);
    const orderId = "BDEC-" + numericId;
    const newOrder = {
      id: orderId,
      fulfillmentType: isPickup ? "pickup" : "delivery",
      customer: {
        name,
        phone,
        email: email ? String(email).trim() : undefined,
        address: isPickup ? (address || "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Self-Pickup)") : address,
        city: validCity,
        area: validArea,
        latitude: hasCoordinates ? custLat : undefined,
        longitude: hasCoordinates ? custLng : undefined
      },
      deliveryDetails: {
        city: validCity,
        area: validArea,
        distanceKm: computedDistanceKm,
        deliveryRate: isPickup ? 0 : settings.pricePerKm,
        baseDeliveryFee: computedDeliveryFee,
        actualDeliveryFee: finalDeliveryCharge,
        matchedAddress: quote?.matchedAddress,
        locationPrecision: quote?.type,
        latitude: hasCoordinates ? custLat : undefined,
        longitude: hasCoordinates ? custLng : undefined
      },
      items: validCartItems,
      paymentMethod: paymentMethod || "Cash on Delivery",
      subtotal,
      deliveryCharges: finalDeliveryCharge,
      discount,
      total,
      deliveryDate: deliveryDate || undefined,
      deliverySlot: deliverySlot || undefined,
      status: "Order Placed",
      statusHistory: [
        { status: "Order Placed", time: new Date().toLocaleTimeString(), detail: "Order successfully received at Babay Dee central system" }
      ],
      createdAt: new Date().toISOString()
    };

    let orderPersisted = false;

    // Save order data dynamically to the connected Supabase orders database if available
    if (dbClient) {
      try {
        const serializedMetadata = {
          address: newOrder.customer.address,
          fulfillmentType: newOrder.fulfillmentType,
          city: validCity,
          deliveryDetails: newOrder.deliveryDetails,
          area: validArea,
          email: email ? String(email).trim() : undefined,
          paymentMethod: paymentMethod || "Cash on Delivery",
          subtotal,
          deliveryCharges: finalDeliveryCharge,
          discount,
          total,
          deliveryDate: newOrder.deliveryDate,
          deliverySlot: newOrder.deliverySlot,
          status: "Order Placed",
          statusHistory: newOrder.statusHistory,
          latitude: hasCoordinates ? custLat : null,
          longitude: hasCoordinates ? custLng : null,
          distanceKm: computedDistanceKm,
          items: validCartItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit
          }))
        };
        const customerAddressValue = `${newOrder.customer.address} | METADATA:${JSON.stringify(serializedMetadata)}`;
        
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS

        const rawInsertPayload: Record<string, any> = {
          created_at: now.toISOString(),
          "order id": numericId,
          "customer name": name,
          "contact number": phone,
          "customer email": email ? String(email).trim() : null,
          "customer address": customerAddressValue,
          date: dateStr,
          time: timeStr,
          Price: total, // Total order price (including delivery charges)
          "Delivery charges": finalDeliveryCharge, // Delivery charges column
          "Order pricing": subtotal, // Order pricing column (excluding delivery charges)
          "Order status": "order placed", // Default order status column in database
          " order status": "order placed", // Space-padded column variation support
          "order status": "order placed",
          "order_status": "order placed",
          ...(hasCoordinates ? {
            "customer latitude": custLat,
            "customer longitude": custLng,
            "customer Latitude": custLat,
            "customer Longitude": custLng,
            customer_latitude: custLat,
            customer_longitude: custLng,
            latitude: custLat,
            longitude: custLng,
            "delivery latitude": custLat,
            "delivery longitude": custLng,
            delivery_latitude: custLat,
            delivery_longitude: custLng,
            delivery_distance_km: computedDistanceKm,
            delivery_charge: finalDeliveryCharge,
            delivery_address: address
          } : {})
        };

        // Adaptive insert: gracefully strips any unsupported schema columns if not yet created on Supabase
        let insertPayload = { ...rawInsertPayload };
        const maxAttempts = Object.keys(insertPayload).length + 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const { error } = await dbClient.from("orders").insert([insertPayload]);
          if (!error) {
            console.log(`Successfully wrote order BDEC-${numericId} to Supabase orders table! Inserted fields:`, Object.keys(insertPayload));
            orderPersisted = true;
            break;
          }

          const match = error.message.match(/Could not find the '([^']+)' column/i);
          if (match && match[1] in insertPayload && !["order id", "customer name", "contact number", "customer address", "Price"].includes(match[1])) {
            delete insertPayload[match[1]];
          } else {
            console.error("Supabase insert error:", error);
            break;
          }
        }
      } catch (err) {
        console.error("Exception writing order to Supabase:", err);
      }
    }

    if (!orderPersisted) {
      return res.status(503).json({ success: false, error: "Your order could not be saved. Your basket has been kept. Please try again shortly." });
    }
    ACTIVE_ORDERS.push(newOrder);
    if (ACTIVE_ORDERS.length > 500) ACTIVE_ORDERS.shift();

    // Await order notification dispatch (Ntfy push & Twilio SMS confirmation)
    try {
      await triggerOrderNotification(newOrder);
    } catch (ntfyErr) {
      console.error("Notification dispatch error in checkout handler:", ntfyErr);
    }

    let smsResult: any = null;
    try {
      smsResult = await sendOrderConfirmationSMS(newOrder);
      console.log(`[Checkout SMS] Customer confirmation SMS dispatch result for ${newOrder.id}:`, smsResult);
    } catch (smsErr) {
      console.error("SMS notification dispatch error in checkout handler:", smsErr);
    }

    let emailResult: any = null;
    try {
      const targetEmail = (email || req.body?.customerEmail || req.body?.customer?.email || newOrder.customer?.email || "").trim();
      if (targetEmail) {
        emailResult = await sendOrderConfirmationEmail(newOrder, targetEmail);
        console.log(`[Checkout Email] Customer receipt email dispatch result for ${newOrder.id}:`, emailResult);
        (newOrder as any).emailStatus = emailResult;
      }
    } catch (emailErr) {
      console.error("Email receipt notification dispatch error in checkout handler:", emailErr);
    }

    return res.json({
      success: true,
      orderId: orderId,
      order: newOrder,
      smsStatus: smsResult,
      emailStatus: emailResult
    });
  } catch (globalCheckoutErr: any) {
    console.error("Global checkout handler exception:", globalCheckoutErr);
    return res.status(500).json({
      error: "Internal checkout system exception."
    });
  }
});

// Dedicated endpoint to send / resend order confirmation SMS
app.post("/api/notifications/order-sms", async (req, res) => {
  try {
    const { order } = req.body;
    if (!order) {
      return res.status(400).json({ error: "Order object with customer phone number is required." });
    }

    const smsResult = await sendOrderConfirmationSMS(order);
    return res.json({
      success: smsResult.success,
      sms: smsResult,
      isConfigured: isSMSGatewayConfigured(),
      isSMSPKConfigured: isSMSPKConfigured(),
      isTwilioConfigured: isTwilioConfigured()
    });
  } catch (err: any) {
    console.error("API /api/notifications/order-sms error:", err);
    return res.status(500).json({ error: "Failed to dispatch SMS notification" });
  }
});

// Dedicated endpoint to send order status update SMS (e.g. Dispatched / Out for Delivery)
app.post("/api/notifications/order-status-sms", async (req, res) => {
  try {
    const { order, status, notes } = req.body;
    if (!order || !status) {
      return res.status(400).json({ error: "Order and status fields are required." });
    }

    const smsResult = await sendOrderStatusSMS(order, status, notes);
    return res.json({
      success: smsResult.success,
      sms: smsResult,
      isConfigured: isSMSGatewayConfigured()
    });
  } catch (err: any) {
    console.error("API /api/notifications/order-status-sms error:", err);
    return res.status(500).json({ error: "Failed to dispatch status SMS" });
  }
});

// Status check for SMS gateway integrations
app.get("/api/notifications/sms-status", (req, res) => {
  res.json({
    success: true,
    isSMSPKConfigured: isSMSPKConfigured(),
    isTwilioConfigured: isTwilioConfigured(),
    isConfigured: isSMSGatewayConfigured(),
    primaryGateway: isSMSPKConfigured() ? "SMSPK (Direct Pakistan Gateway)" : (isTwilioConfigured() ? "Twilio" : "None")
  });
});

// Dedicated endpoint to proxy Ntfy push notifications without client CORS issues
app.post("/api/notifications/ntfy", async (req, res) => {
  try {
    const { order } = req.body;
    if (!order) {
      return res.status(400).json({ error: "Order payload is required." });
    }
    const success = await triggerOrderNotification(order);
    return res.json({ success });
  } catch (err: any) {
    console.error("API /api/notifications/ntfy error:", err);
    return res.status(500).json({ error: "Failed to dispatch Ntfy notification" });
  }
});

// Helper to resolve an order by ID from memory or Supabase database
async function getOrderById(orderId: string): Promise<any | null> {
  const cleanId = String(orderId).trim();
  let found = ACTIVE_ORDERS.find(o => o.id === cleanId || o.id === `BDEC-${cleanId}`);
  if (found) return found;

  if (dbClient) {
    const numericId = parseInt(cleanId.replace("BDEC-", ""), 10);
    if (!isNaN(numericId)) {
      try {
        const { data } = await dbClient.from("orders").select("*").eq("order id", numericId);
        if (data && data.length > 0) {
          const row = data[0];
          let customAddress = row["customer address"] || "";
          let metadata: any = null;
          if (customAddress.includes("| METADATA:")) {
            const parts = customAddress.split("| METADATA:");
            customAddress = parts[0].trim();
            try {
              metadata = JSON.parse(parts[1]);
            } catch {}
          }
          return {
            id: `BDEC-${row["order id"]}`,
            fulfillmentType: metadata?.fulfillmentType || "delivery",
            deliveryDetails: metadata?.deliveryDetails,
            customer: {
              city: metadata?.city,
              name: row["customer name"] || "Valued Customer",
              phone: row["contact number"] || "",
              email: row["customer email"] || metadata?.email || undefined,
              address: customAddress,
              area: metadata?.area || "Rawalpindi"
            },
            items: metadata?.items || [],
            paymentMethod: metadata?.paymentMethod || "Cash on Delivery",
            subtotal: metadata?.subtotal ?? row["Order pricing"] ?? row.Price ?? 0,
            deliveryCharges: metadata?.deliveryCharges || (typeof row["Delivery charges"] === "number" ? row["Delivery charges"] : 0),
            discount: metadata?.discount || 0,
            total: metadata?.total ?? row.Price ?? 0,
            deliveryDate: metadata?.deliveryDate,
            deliverySlot: metadata?.deliverySlot,
            status: row["order status"] || "order placed",
            createdAt: row.created_at || new Date().toISOString()
          };
        }
      } catch (e) {
        console.error("Error finding order in Supabase for receipt:", e);
      }
    }
  }
  return null;
}

async function requireOrderPhone(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const id = req.params.id || req.body?.orderId;
    const phone = normalizePhone(req.get('X-Order-Phone'));
    if (!phone || !/^03\d{9}$/.test(phone)) return res.status(401).json({error: 'Enter the phone number used for this order.'});
    const order = await getOrderById(String(id || ''));
    if (!order || normalizePhone(order.customer?.phone) !== phone) return res.status(404).json({error: 'Order details could not be verified.'});
    res.locals.verifiedOrder = order;
    next();
  } catch { res.status(503).json({error: 'Order verification temporarily unavailable.'}); }
}

// Dedicated endpoint to send or resend order confirmation receipt email
app.post("/api/order/send-receipt", requireOrderPhone, async (req, res) => {
  try {
    const { orderId, email, order } = req.body;
    let orderToUse = res.locals.verifiedOrder;

    if (!orderToUse && orderId) {
      orderToUse = await getOrderById(orderId);
    }

    if (!orderToUse) {
      return res.status(404).json({
        success: false,
        delivered: false,
        error: "Order could not be located to generate a receipt."
      });
    }

    const targetEmail = (email || orderToUse.customer?.email || orderToUse.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        delivered: false,
        error: "A valid customer email address is required to dispatch the receipt."
      });
    }

    // Attach target email to customer profile for receipt generation
    if (!orderToUse.customer) orderToUse.customer = {};
    orderToUse.customer.email = targetEmail;

    const emailResult = await sendOrderConfirmationEmail(orderToUse, targetEmail);
    return res.json({
      success: emailResult.success,
      delivered: emailResult.delivered,
      configured: emailResult.configured,
      message: emailResult.message,
      error: emailResult.error,
      provider: emailResult.provider,
      recipient: emailResult.recipient,
      messageId: emailResult.messageId,
      emailConfig: isEmailServiceConfigured()
    });
  } catch (err: any) {
    console.error("API /api/order/send-receipt error:", err);
    return res.status(500).json({
      success: false,
      delivered: false,
      error: "Failed to dispatch email receipt"
    });
  }
});

// Dedicated endpoint to test the email dispatch system
app.post("/api/email/test-send", async (req, res) => {
  try {
    const targetEmail = (req.body?.email || "karpeter09@gmail.com").trim();
    console.log(`[Email Test] Initiating test email dispatch to: ${targetEmail}`);
    const result = await sendTestEmail(targetEmail);
    return res.json({
      ...result,
      emailConfig: isEmailServiceConfigured()
    });
  } catch (err: any) {
    console.error("API /api/email/test-send error:", err);
    return res.status(500).json({
      success: false,
      delivered: false,
      configured: isEmailServiceConfigured().configured,
      error: "Exception testing email dispatch",
      recipient: req.body?.email || "karpeter09@gmail.com"
    });
  }
});

// Endpoint to view or print the beautifully rendered HTML receipt directly
app.get("/api/order/:id/receipt-html", requireOrderPhone, async (req, res) => {
  try {
    const orderId = req.params.id;
    let order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).send("Order not found. Please check your order number.");
    }

    const appUrl = "https://babaydeeattachakki.com/?tab=tracker";
    const html = generateOrderReceiptHtml(order, appUrl);

    if (req.query.download === "1" || req.query.download === "true") {
      res.setHeader("Content-Disposition", `attachment; filename="BabayDee_Invoice_${orderId}.html"`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err: any) {
    return res.status(500).send("Unable to generate receipt.");
  }
});

// Endpoint to check email service status and recent receipt dispatch logs
app.get("/api/email/status", (req, res) => {
  const config = isEmailServiceConfigured();
  return res.json({
    success: true,
    configured: config.configured,
    provider: config.provider,
    details: config.details,
    defaultSender: process.env.EMAIL_FROM || "Babay Dee Atta Chakki <onboarding@resend.dev>",
    supportedProviders: [
      { name: "Resend API", envKey: "RESEND_API_KEY", description: "3,000 free emails/mo at resend.com" },
      { name: "Gmail SMTP", envKeys: ["GMAIL_USER", "GMAIL_APP_PASSWORD"], description: "Free with 16-character Google App Password" },
      { name: "Custom SMTP", envKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"], description: "Works with any mail relay (Brevo, SendGrid, etc.)" }
    ],
    totalDispatchedReceipts: EMAIL_RECEIPT_LOGS.length,
    recentReceipts: EMAIL_RECEIPT_LOGS.slice(0, 10).map(l => ({
      id: l.id,
      orderId: l.orderId,
      recipient: l.recipient,
      subject: l.subject,
      sentAt: l.sentAt,
      provider: l.provider,
      status: l.status,
      error: l.error
    }))
  });
});

app.get("/api/order/:id", requireOrderPhone, async (req, res) => {
  const orderId = req.params.id;
  const numericIdStr = String(orderId).replace("BDEC-", "").trim();
  const numericId = parseInt(numericIdStr, 10);

  if (dbClient && !isNaN(numericId)) {
    try {
      const { data } = await dbClient
        .from("orders")
        .select("*")
        .eq("order id", numericId);

      if (data && data.length > 0) {
        const row = data[0];
        let rawAddressStr = row["customer address"] || "";
        let customAddress = rawAddressStr;
        let metadata: any = null;
        let riderName = "Unassigned";
        let riderContact = "N/A";

        if (rawAddressStr.trim().startsWith("{")) {
          try {
            const parsedJSON = JSON.parse(rawAddressStr);
            riderName = parsedJSON.rider_name || "Unassigned";
            riderContact = parsedJSON.rider_contact || "N/A";

            const innerAddress = parsedJSON.address || "";
            customAddress = innerAddress;
            if (innerAddress.includes("| METADATA:")) {
              const parts = innerAddress.split("| METADATA:");
              customAddress = parts[0].trim();
              try {
                metadata = JSON.parse(parts[1]);
              } catch (e) {
                console.error("Error parsing inner metadata:", e);
              }
            }
          } catch (err) {
            console.error("Error parsing address JSON:", err);
          }
        } else {
          if (rawAddressStr.includes("| METADATA:")) {
            const parts = rawAddressStr.split("| METADATA:");
            customAddress = parts[0].trim();
            try {
              metadata = JSON.parse(parts[1]);
            } catch (e) {
              console.error("Error parsing metadata:", e);
            }
          }
        }

        // Connect directly to the database column for order status
        // Check 'Order status', ' order status', 'order status', 'order_status', or any trimmed match
        let dbStatus = "";
        for (const key of Object.keys(row)) {
          const cleanKey = key.trim().toLowerCase();
          if (cleanKey === "order status" || cleanKey === "order_status" || cleanKey === "status") {
            if (row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "") {
              dbStatus = String(row[key]).trim();
              break;
            }
          }
        }

        const createdAt = row.created_at || new Date().toISOString();
        const createdTime = new Date(createdAt).getTime();

        // Strict database status: default to "order placed" if newly created and never auto-advance artificially
        const currentStatus = dbStatus || metadata?.status || "order placed";

        const normalizeStatus = (s: string) => (s || "").toLowerCase().trim();
        const norm = normalizeStatus(currentStatus);

        const stageDefs = [
          { key: "order placed", label: "order placed", detail: "Order successfully placed and logged in Babay Dee central database" },
          { key: "pending", label: "pending", detail: "Order queued and pending preparation at Chakki mill" },
          { key: "dispatch", label: "dispatch", detail: "Packages freshly milled and dispatched from Chakki depot" },
          { key: "out for delivery", label: "out for delivery", detail: `Rider dispatched${riderName !== "Unassigned" ? ` (${riderName})` : ""} and out for delivery to your address` },
          { key: "delivered", label: "delivered", detail: "Order safely delivered to customer. Thank you for choosing Babay Dee Atta Chakki!" },
        ];

        let targetStageIdx = -1;
        if (norm.includes("delivered")) targetStageIdx = 4;
        else if (norm.includes("out for delivery")) targetStageIdx = 3;
        else if (norm.includes("dispatch")) targetStageIdx = 2;
        else if (norm.includes("pending") || norm.includes("milling") || norm.includes("inspected")) targetStageIdx = 1;
        else targetStageIdx = 0;

        const history: Array<{ status: string; time: string; detail: string }> = [];
        for (let i = 0; i <= targetStageIdx; i++) {
          const stage = stageDefs[i];
          const isCurrent = i === targetStageIdx;
          history.push({
            status: isCurrent ? currentStatus : stage.label,
            time: new Date(createdTime + i * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            detail: stage.detail
          });
        }

        const order = {
          id: `BDEC-${row["order id"]}`,
          customer: {
            name: row["customer name"] || "Valued Customer",
            phone: row["contact number"] || "",
            email: row["customer email"] || metadata?.email || undefined,
            address: customAddress,
            area: metadata?.area || "Islamabad"
          },
          items: metadata?.items || [{ name: "Chakki Atta (Kg)", price: 170, quantity: 10 }],
          paymentMethod: metadata?.paymentMethod || "Cash on Delivery",
          subtotal: metadata?.subtotal || 0,
          deliveryCharges: metadata?.deliveryCharges || 0,
          discount: metadata?.discount || 0,
          total: metadata?.total || 0,
          deliveryDate: metadata?.deliveryDate,
          deliverySlot: metadata?.deliverySlot,
          status: currentStatus,
          statusHistory: history,
          createdAt: createdAt
        };

        return res.json(order);
      }
    } catch (err) {
      console.error("Exception loading order from Supabase:", err);
    }
  }

  const order = ACTIVE_ORDERS.find(o => o.id === orderId);
  if (!order) {
    const tempOrder = {
      id: orderId,
      customer: { name: "Valued Customer", phone: "+92 3** *******", address: "G-11 Islamabad", area: "Islamabad" },
      items: [{ name: "Chakki Atta (Kg)", price: 170, quantity: 10 }],
      paymentMethod: "Cash on Delivery",
      subtotal: 1700,
      deliveryCharges: 180,
      total: 1880,
      status: "Order Placed",
      statusHistory: [
        { status: "Order Placed", time: new Date(Date.now() - 3600000).toLocaleTimeString(), detail: "Order successfully received at Babay Dee Central system" }
      ],
      createdAt: new Date(Date.now() - 3600000).toISOString()
    };
    return res.json(tempOrder);
  }

  res.json(order);
});

// Update order status in Supabase database column
app.post("/api/order/:id/status", async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "status is required" });
  }

  const numericIdStr = String(orderId).replace("BDEC-", "").trim();
  const numericId = parseInt(numericIdStr, 10);
  if (isNaN(numericId)) {
    return res.status(400).json({ error: "Invalid numeric order ID" });
  }

  if (!dbClient) {
    return res.status(500).json({ error: "Database client is not connected" });
  }

  try {
    let updatePayload: Record<string, any> = {
      "Order status": status,
      " order status": status,
      "order status": status,
      "order_status": status
    };

    let updated = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await dbClient
        .from("orders")
        .update(updatePayload)
        .eq("order id", numericId)
        .select();

      if (!error) {
        console.log(`[Status Update] Successfully updated order BDEC-${numericId} status to '${status}' in database! Fields:`, Object.keys(updatePayload));
        updated = true;
        break;
      }

      const match = error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        delete updatePayload[match[1]];
      } else {
        console.error("Database status update error:", error);
        return res.status(500).json({ error: "Failed to update order status in database" });
      }
    }

    return res.json({ success: true, orderId: `BDEC-${numericId}`, status, updated });
  } catch (err: any) {
    console.error("Exception updating order status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/support/message", (req, res) => {
  const { sessionId, username, phone, text } = req.body;
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{12,100}$/.test(sessionId) || typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return res.status(400).json({ error: "SessionID and text is mandatory." });
  }

  if (Object.keys(CHAT_SESSIONS).length >= 1000 && !CHAT_SESSIONS[sessionId]) return res.status(503).json({error: 'Support is busy. Please call us.'});
  if (!CHAT_SESSIONS[sessionId]) {
    CHAT_SESSIONS[sessionId] = {
      username: username || "Guest customer",
      phone: phone || "Not Provided",
      messages: []
    };
  }

  const session = CHAT_SESSIONS[sessionId];
  const userMsg = {
    sender: "user",
    text: text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  session.messages.push(userMsg);
  if (session.messages.length > 100) session.messages.splice(0, session.messages.length - 100);

  setTimeout(() => {
    let responseText = "Assalam-o-Alaikum! Thanks for contacting Babay Dee Atta Chakki support. Our team is available. Let us know if you need help with Atta, Rice and Herbs.";
    const lowText = text.toLowerCase();
    
    if (lowText.includes("atta") || lowText.includes("chakki") || lowText.includes("flour")) {
      responseText = "Our Chakki Atta is 100% pure stone-ground whole wheat, ground fresh daily at our Gulrez Gulberg Rawalpindi mill. It has zero additives. Would you like to know our bulk ordering rates?";
    } else if (lowText.includes("delivery") || lowText.includes("rawalpindi") || lowText.includes("islamabad") || lowText.includes("pindi")) {
      responseText = "We deliver to all sectors of Islamabad and areas of Rawalpindi. Rawalpindi delivery charge is Rs 120 and Islamabad is Rs 180. Delivery is completed within 3 to 4 hours of ordering!";
    } else if (lowText.includes("track") || lowText.includes("order") || lowText.includes("status")) {
      responseText = "You can easily track your order live using the 'Track Order' option in the navbar simply by entering your BDEC order code!";
    } else if (lowText.includes("rice") || lowText.includes("kainat") || lowText.includes("basmati")) {
      responseText = "Our Basmati Kainat (430) is 2-years wood-aged premium rice with incredible elongated grains. We sort every single batch to ensure pristine quality!";
    } else if (lowText.includes("whatsapp") || lowText.includes("phone") || lowText.includes("call")) {
      responseText = "You can reach our manager directly at +92 321 5010846 or tap the green 'Chat on WhatsApp' button on the screen to talk on WhatsApp instantly.";
    }

    const supportMsg = {
      sender: "operator",
      text: responseText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    session.messages.push(supportMsg);
  }, 1000);

  res.json({ success: true, messages: session.messages });
});

app.get("/api/support/messages/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  if (CHAT_SESSIONS[sessionId]) {
    res.json(CHAT_SESSIONS[sessionId].messages);
  } else {
    res.json([]);
  }
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://babaydeeattachakki.com";
    const today = new Date().toISOString().split("T")[0];

    const staticPaths = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/?tab=shop", priority: "0.9", changefreq: "daily" },
      { path: "/?tab=categories", priority: "0.8", changefreq: "weekly" },
      { path: "/?tab=about", priority: "0.7", changefreq: "monthly" },
      { path: "/?tab=contact", priority: "0.7", changefreq: "monthly" }
    ];

    const pList = await getSupabaseProducts();
    const dynamicPaths = pList.map((prod) => ({
      path: `/?product=${encodeURIComponent(prod.id)}`,
      priority: "0.85",
      changefreq: "weekly"
    }));

    const allUrls = [...staticPaths, ...dynamicPaths];

    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xmlContent += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    allUrls.forEach((entry) => {
      xmlContent += `  <url>\n`;
      xmlContent += `    <loc>${baseUrl}${entry.path}</loc>\n`;
      xmlContent += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      xmlContent += `    <priority>${entry.priority}</priority>\n`;
      xmlContent += `  </url>\n`;
    });

    xmlContent += `</urlset>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(xmlContent);
  } catch (err: any) {
    res.header("Content-Type", "text/plain");
    return res.status(500).send("Unable to compile sitemap xml catalog right now.");
  }
});

export default app;
