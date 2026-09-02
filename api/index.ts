import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { INITIAL_DELIVERY_AREAS, calculateDeliveryCharge, findDeliveryArea, DeliveryAreaRecord } from "../src/deliveryData";
import { extractCityAndArea, findClosestTwinCityZone } from "../src/lib/mapUtils";
import { sendOrderConfirmationSMS, sendOrderStatusSMS, isSMSGatewayConfigured, isSMSPKConfigured, isTwilioConfigured } from "./smsService";

const app = express();

// Enable universal CORS and Preflight handling for dev, preview iframe, and external callers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize Supabase Client
const dbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://dlinknypnlmcrhgbediu.supabase.co";
const dbKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_KkOjGDoE3yq7tKIKzIfajg_sIoyPlUT";
const dbClient = createClient(dbUrl, dbKey);

// Dynamic delivery areas store initialized with 299 baseline records
let CUSTOM_DELIVERY_AREAS: DeliveryAreaRecord[] = [...INITIAL_DELIVERY_AREAS];

// In-memory data structures
const ACTIVE_ORDERS: any[] = [];
const CHAT_SESSIONS: Record<string, { username: string; phone: string; messages: any[] }> = {};

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
    const ntfyTopic = process.env.NTFY_TOPIC || "baby_dee_chakki_orders_0c518";
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
  if (!name || !rating || !review) {
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
  res.json({ success: true, review: newObj });
});

app.post("/api/order/feedback", (req, res) => {
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

// Geoapify API Keys for Map Tiles, Driving Road Routing, and Forward/Reverse Geocoding
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || "443a4948e9f344ceb1d25b7ac672fabe";
const GEOAPIFY_ROUTING_KEY = process.env.GEOAPIFY_ROUTING_KEY || process.env.GEOAPIFY_API_KEY || "807f1c518966416380a21121a25c2dcc";
const GEOAPIFY_GEOCODING_KEY = process.env.GEOAPIFY_GEOCODING_KEY || process.env.GEOAPIFY_API_KEY || "6887f82b4326475e9039f018774f97fb";
const GEOAPIFY_MAP_TILES_KEY = process.env.GEOAPIFY_MAP_TILES_KEY || process.env.GEOAPIFY_API_KEY || "443a4948e9f344ceb1d25b7ac672fabe";

// Server-side robust reverse geocoding (Geoapify Geocoding API + OSM Nominatim fallback + Twin Cities sector resolver)
export async function serverReverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string; area: string }> {
  let address = "";
  const closestData = findClosestTwinCityZone(lat, lng);
  let city = closestData ? closestData.zone.city : (lat > 33.655 ? "Islamabad" : "Rawalpindi");
  let area = closestData ? closestData.zone.name : "Gulraiz Phase 3";

  // 1. Geoapify Reverse Geocoding API
  if (GEOAPIFY_GEOCODING_KEY) {
    try {
      const geoapifyUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${GEOAPIFY_GEOCODING_KEY}`;
      const res = await fetch(geoapifyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          address = item.formatted || item.address_line1 || "";
          if (item.city) city = item.city;
          if (item.suburb || item.district || item.neighbourhood) {
            area = item.suburb || item.district || item.neighbourhood;
          }
        }
      }
    } catch (err) {
      console.warn("Server Geoapify reverse geocode warning:", err);
    }
  }

  // 2. Fallback: OpenStreetMap Nominatim with proper server User-Agent header
  if (!address) {
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(osmUrl, {
        headers: {
          "User-Agent": "BabayDeeChakkiStore/1.0 (contact: info@babaydee.com)",
          "Accept-Language": "en"
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          address = data.display_name;
        }
      }
    } catch (err) {
      console.warn("Server OSM reverse geocode warning:", err);
    }
  }

  // 3. Fallback to Sector/Society & City if geocoder failed (never output raw coordinates as address)
  if (!address) {
    address = `${area}, ${city}, Pakistan`;
  }

  const parsed = extractCityAndArea(address, lat, lng);
  return {
    address,
    city: parsed.city || city,
    area: parsed.area || area
  };
}

// Server-side robust forward geocoding (Address -> Coordinates) via Geoapify Geocoding API
export async function serverGeocodeAddress(query: string): Promise<{ lat: number; lng: number; address: string; city: string; area: string } | null> {
  const clean = query.trim();
  if (!clean) return null;

  // 1. Geoapify Geocoding API
  if (GEOAPIFY_GEOCODING_KEY) {
    try {
      const geoapifyUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(clean)}&filter=countrycode:pk&bias=proximity:73.104510,33.567348&format=json&apiKey=${GEOAPIFY_GEOCODING_KEY}`;
      const res = await fetch(geoapifyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            const formatted = item.formatted || clean;
            const parsed = extractCityAndArea(formatted, lat, lng);
            return {
              lat,
              lng,
              address: formatted,
              city: parsed.city || item.city || (lat > 33.655 ? "Islamabad" : "Rawalpindi"),
              area: parsed.area || item.suburb || item.district || "Gulraiz Phase 3"
            };
          }
        }
      }
    } catch (err) {
      console.warn("Server Geoapify geocode warning:", err);
    }
  }

  // 2. OpenStreetMap Nominatim with server headers
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=pk&q=${encodeURIComponent(clean)}&limit=1`;
    const res = await fetch(osmUrl, {
      headers: {
        "User-Agent": "BabayDeeChakkiStore/1.0 (contact: info@babaydee.com)",
        "Accept-Language": "en"
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const formatted = data[0].display_name;
        const parsed = extractCityAndArea(formatted, lat, lng);
        return {
          lat,
          lng,
          address: formatted,
          city: parsed.city,
          area: parsed.area
        };
      }
    }
  } catch (err) {
    console.warn("Server Nominatim geocode warning:", err);
  }

  return null;
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
    const { data, error } = await dbClient.from("delivery_settings").select("*").limit(1);
    if (!error && data && data.length > 0) {
      const row = data[0];
      const lat = parseFloat(row.store_latitude ?? row.store_lat ?? row.latitude ?? row.lat ?? row["Store Latitude"] ?? row["store latitude"]);
      const lng = parseFloat(row.store_longitude ?? row.store_lng ?? row.longitude ?? row.lng ?? row["Store Longitude"] ?? row["store longitude"]);
      const price = parseFloat(row.price_per_km ?? row.price_per_kilometer ?? row.delivery_rate ?? row.rate_per_km ?? row.rate ?? row["Price Per KM"] ?? row["Price per km"]);
      const maxDist = parseFloat(row.max_delivery_distance ?? row.max_delivery_distance_km ?? row.max_distance_km ?? row.max_distance ?? row.maximum_delivery_distance ?? row["Max Delivery Distance"]);

      if (!isNaN(lat) && lat !== 0) fallbackSettings.storeLatitude = lat;
      if (!isNaN(lng) && lng !== 0) fallbackSettings.storeLongitude = lng;
      if (!isNaN(price) && price > 0) fallbackSettings.pricePerKm = price;
      if (!isNaN(maxDist) && maxDist > 0) fallbackSettings.maxDeliveryDistanceKm = Math.max(45, maxDist);
      if (row.store_address || row.address) fallbackSettings.storeAddress = row.store_address || row.address;
      if (row.store_name || row.name) fallbackSettings.storeName = row.store_name || row.name;
    }
  } catch (err) {
    console.warn("Could not query delivery_settings from Supabase, using defaults:", err);
  }

  return fallbackSettings;
}

// Helper: Compute real driving road distance via Geoapify Routing API with OSRM & interpolated mathematical fallback
export async function computeGeoapifyDrivingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{
  success: boolean;
  distanceMeters: number;
  distanceKm: number;
  durationMinutes: number;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  polyline?: string;
}> {
  // 1. Try Geoapify Routing API (driving mode)
  if (GEOAPIFY_ROUTING_KEY) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `https://api.geoapify.com/v1/routing?waypoints=${originLat},${originLng}|${destLat},${destLng}&mode=drive&apiKey=${GEOAPIFY_ROUTING_KEY}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const props = feature.properties || {};
          const distanceMeters = Math.round(props.distance || 0);
          const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
          const durationMinutes = Math.ceil((props.time || 0) / 60) || Math.max(15, Math.ceil(distanceKm * 2.2));

          const routeCoordinates: Array<{ lat: number; lng: number }> = [];
          if (feature.geometry?.coordinates) {
            const coords = feature.geometry.coordinates;
            if (Array.isArray(coords)) {
              if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
                for (const pt of coords) {
                  if (Array.isArray(pt) && pt.length >= 2) {
                    routeCoordinates.push({ lat: pt[1], lng: pt[0] });
                  }
                }
              } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                for (const seg of coords) {
                  if (Array.isArray(seg)) {
                    for (const pt of seg) {
                      if (Array.isArray(pt) && pt.length >= 2) {
                        routeCoordinates.push({ lat: pt[1], lng: pt[0] });
                      }
                    }
                  }
                }
              }
            }
          }

          if (routeCoordinates.length > 0) {
            return {
              success: true,
              distanceMeters,
              distanceKm,
              durationMinutes,
              routeCoordinates
            };
          }
        }
      }
    } catch (geoapifyErr) {
      console.warn("Geoapify Routing API warning, attempting secondary OSRM routing:", geoapifyErr);
    }
  }

  // 2. Secondary fallback: OpenStreetMap / OSRM Public Routing API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BabayDeeChakkiApp/1.0",
        "Accept": "application/json"
      }
    });
    clearTimeout(timeoutId);

    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distMeters = Math.round(route.distance || 0);
        const distKm = Math.round((distMeters / 1000) * 100) / 100;
        const durMins = Math.ceil((route.duration || 0) / 60) || Math.max(15, Math.ceil(distKm * 2.2));
        const coords: Array<{ lat: number; lng: number }> = [];

        if (route.geometry?.coordinates && Array.isArray(route.geometry.coordinates)) {
          for (const pt of route.geometry.coordinates) {
            if (Array.isArray(pt) && pt.length >= 2) {
              coords.push({ lat: pt[1], lng: pt[0] });
            }
          }
        }

        if (coords.length > 0) {
          return {
            success: true,
            distanceMeters: distMeters,
            distanceKm: distKm,
            durationMinutes: durMins,
            routeCoordinates: coords
          };
        }
      }
    }
  } catch (osrmErr) {
    console.warn("OSRM routing API fallback warning:", osrmErr);
  }

  // 3. Fallback: High-precision Haversine with 1.28x road curvature multiplier & interpolated road waypoints
  const R = 6371;
  const dLat = (destLat - originLat) * (Math.PI / 180);
  const dLon = (destLng - originLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat * (Math.PI / 180)) *
      Math.cos(destLat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directKm = R * c;
  const roadKm = Math.max(0.5, Math.round(directKm * 1.28 * 100) / 100);

  // Generate realistic curved waypoint coordinates along the road vector
  const waypoints: Array<{ lat: number; lng: number }> = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curveFactor = Math.sin(t * Math.PI) * 0.0025;
    const lat = originLat + (destLat - originLat) * t + curveFactor;
    const lng = originLng + (destLng - originLng) * t + curveFactor * 0.5;
    waypoints.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }

  return {
    success: true,
    distanceMeters: Math.round(roadKm * 1000),
    distanceKm: roadKm,
    durationMinutes: Math.max(15, Math.ceil(roadKm * 2.2)),
    routeCoordinates: waypoints
  };
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
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
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
      area: geoResult.area
    });
  } catch (err: any) {
    console.error("Geocode endpoint exception:", err);
    return res.status(500).json({ error: err?.message || "Failed to geocode address." });
  }
});

// Server-side Route & Delivery Charge Calculation API Endpoint (Infallible)
app.post("/api/delivery/calculate-route", async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body || {};

    let custLat = parseFloat(latitude);
    let custLng = parseFloat(longitude);

    // If coordinates are missing or invalid, default to central twin cities coordinate
    if (isNaN(custLat) || isNaN(custLng) || custLat === 0 || custLng === 0) {
      custLat = 33.6007;
      custLng = 73.0679;
    }

    let storeLatitude = 33.567348;
    let storeLongitude = 73.104510;
    let pricePerKm = 50;
    let maxDeliveryDistanceKm = 30;
    let storeAddress = "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi";
    let storeName = "Babay Dee Atta Chakki";

    try {
      const settings = await getSupabaseDeliverySettings();
      storeLatitude = settings.storeLatitude || storeLatitude;
      storeLongitude = settings.storeLongitude || storeLongitude;
      pricePerKm = settings.pricePerKm || pricePerKm;
      maxDeliveryDistanceKm = settings.maxDeliveryDistanceKm || maxDeliveryDistanceKm;
      storeAddress = settings.storeAddress || storeAddress;
      storeName = settings.storeName || storeName;
    } catch (settingsErr) {
      console.warn("Could not fetch delivery settings, using default store constants:", settingsErr);
    }

    let resolvedAddress = address || "";
    let detectedCity = custLat > 33.655 ? "Islamabad" : "Rawalpindi";
    let detectedArea = "Gulraiz Phase 3";

    try {
      if (!resolvedAddress || resolvedAddress.trim().length < 5 || resolvedAddress.startsWith("Location (") || resolvedAddress.startsWith("Pinned Location") || resolvedAddress.startsWith("Delivery Pin") || resolvedAddress === "GPS Device Pin") {
        const geo = await serverReverseGeocode(custLat, custLng);
        resolvedAddress = geo.address;
        detectedCity = geo.city;
        detectedArea = geo.area;
      } else {
        const parsed = extractCityAndArea(resolvedAddress, custLat, custLng);
        detectedCity = parsed.city;
        detectedArea = parsed.area;
      }
    } catch (geoErr) {
      console.warn("Geocoding address resolution error, fallback to area tag:", geoErr);
      const parsed = extractCityAndArea(resolvedAddress || "", custLat, custLng);
      detectedCity = parsed.city;
      detectedArea = parsed.area;
      if (!resolvedAddress || resolvedAddress.startsWith("Pinned Location") || resolvedAddress.startsWith("Delivery Pin") || resolvedAddress.startsWith("Location (")) {
        resolvedAddress = `${detectedArea}, ${detectedCity}, Pakistan`;
      }
    }

    let distanceKm = 1;
    let distanceMeters = 1000;
    let durationMinutes = 20;
    let routeCoordinates: Array<{ lat: number; lng: number }> = [
      { lat: storeLatitude, lng: storeLongitude },
      { lat: custLat, lng: custLng }
    ];

    try {
      const routeRes = await computeGeoapifyDrivingDistance(
        storeLatitude,
        storeLongitude,
        custLat,
        custLng
      );
      distanceKm = routeRes.distanceKm;
      distanceMeters = routeRes.distanceMeters;
      durationMinutes = routeRes.durationMinutes;
      if (routeRes.routeCoordinates && routeRes.routeCoordinates.length > 0) {
        routeCoordinates = routeRes.routeCoordinates;
      }
    } catch (routeErr) {
      console.warn("Driving distance computation fallback:", routeErr);
      // Haversine fallback calculation
      const R = 6371;
      const dLat = (custLat - storeLatitude) * (Math.PI / 180);
      const dLon = (custLng - storeLongitude) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(storeLatitude * (Math.PI / 180)) *
          Math.cos(custLat * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = Math.max(0.5, Math.round(R * c * 1.25 * 10) / 10);
      distanceMeters = Math.round(distanceKm * 1000);
      durationMinutes = Math.max(15, Math.ceil(distanceKm * 2.2));
    }

    const isDeliverable = distanceKm <= maxDeliveryDistanceKm;
    const deliveryCharge = Math.max(50, Math.round(distanceKm * pricePerKm));

    return res.json({
      success: true,
      deliverable: isDeliverable,
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationText: `${durationMinutes} mins`,
      deliveryCharge,
      pricePerKm,
      maxDeliveryDistanceKm,
      routeCoordinates,
      polyline: "",
      city: detectedCity,
      area: detectedArea,
      storeLocation: {
        lat: storeLatitude,
        lng: storeLongitude,
        address: storeAddress,
        name: storeName
      },
      customerLocation: {
        lat: custLat,
        lng: custLng,
        address: resolvedAddress,
        city: detectedCity,
        area: detectedArea
      },
      message: isDeliverable
        ? "Location is within delivery zone."
        : `Sorry, we currently don't deliver to this location. (Maximum delivery radius is ${maxDeliveryDistanceKm} km)`
    });
  } catch (masterErr: any) {
    console.error("Master calculate-route error, delivering resilient fallback:", masterErr);
    return res.json({
      success: true,
      deliverable: true,
      distanceKm: 5,
      distanceMeters: 5000,
      durationMinutes: 20,
      durationText: "20 mins",
      deliveryCharge: 250,
      pricePerKm: 50,
      maxDeliveryDistanceKm: 30,
      routeCoordinates: [
        { lat: 33.567348, lng: 73.104510 },
        { lat: 33.6007, lng: 73.0679 }
      ],
      polyline: "",
      city: "Rawalpindi",
      area: "Gulraiz Phase 3",
      storeLocation: {
        lat: 33.567348,
        lng: 73.104510,
        address: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
        name: "Babay Dee Atta Chakki"
      },
      customerLocation: {
        lat: 33.6007,
        lng: 73.0679,
        address: "Gulraiz Phase 3, Rawalpindi, Pakistan",
        city: "Rawalpindi",
        area: "Gulraiz Phase 3"
      },
      message: "Location is within delivery zone."
    });
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

    if (!name || !phone || (!isPickup && !address)) {
      return res.status(400).json({ error: "Customer name, contact phone, and delivery address are required." });
    }

    const validCity = String(city || req.body.deliveryCity || "Rawalpindi").trim();
    let validArea = String(subLocation || area || req.body.deliveryArea || req.body.neighborhood || (isPickup ? "Depot Pickup" : "Gulraiz Phase 3")).trim();

    if (validArea.toLowerCase() === validCity.toLowerCase()) {
      validArea = String(subLocation || (isPickup ? "Depot Pickup" : "Gulraiz Phase 3")).trim();
    }

    const custLat = parseFloat(reqLat ?? customerCoordinates?.lat ?? customerCoordinates?.latitude);
    const custLng = parseFloat(reqLng ?? customerCoordinates?.lng ?? customerCoordinates?.longitude);
    const hasCoordinates = !isPickup && !isNaN(custLat) && !isNaN(custLng);

    // Fetch dynamic store delivery settings
    const settings = await getSupabaseDeliverySettings();

    let computedDistanceKm = isPickup ? 0 : (typeof reqDistanceKm === "number" && reqDistanceKm > 0 ? reqDistanceKm : 5);
    let computedDeliveryFee = isPickup ? 0 : Math.round(computedDistanceKm * settings.pricePerKm);
    let isDeliverable = true;

    if (!isPickup && hasCoordinates) {
      // Re-verify driving distance server-side via Geoapify Routing API to prevent frontend tampering
      const verifiedRoute = await computeGeoapifyDrivingDistance(
        settings.storeLatitude,
        settings.storeLongitude,
        custLat,
        custLng
      );

      computedDistanceKm = verifiedRoute.distanceKm;
      isDeliverable = computedDistanceKm <= settings.maxDeliveryDistanceKm;

      if (!isDeliverable) {
        return res.status(400).json({
          error: `Sorry, we currently don't deliver to this location. (Maximum delivery radius is ${settings.maxDeliveryDistanceKm} km, detected: ${computedDistanceKm} km)`
        });
      }

      computedDeliveryFee = Math.round(computedDistanceKm * settings.pricePerKm);
    } else if (!isPickup) {
      // Lookup delivery area record from server database / memory
      let matchedRecord = findDeliveryArea(validCity, validArea, CUSTOM_DELIVERY_AREAS);
      if (matchedRecord) {
        if (!matchedRecord.available) {
          return res.status(400).json({
            error: "Sorry, we currently don't deliver to this area."
          });
        }
        computedDistanceKm = matchedRecord.distanceKm;
        computedDeliveryFee = calculateDeliveryCharge(computedDistanceKm, matchedRecord.deliveryRate || settings.pricePerKm);
      }
    }

    const validCartItems = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : [];
    if (validCartItems.length === 0) {
      return res.status(400).json({ error: "Your basket is empty. Please add items to your basket before placing an order." });
    }

    const subtotal = validCartItems.reduce((acc: number, item: any) => {
      const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
      const qty = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 1;
      return acc + (price * qty);
    }, 0);
    
    // Delivery charge is 0 for store pickup, or standard calculated distance fee for delivery
    const finalDeliveryCharge = isPickup ? 0 : computedDeliveryFee;
    const discount = 0;
    const total = subtotal + finalDeliveryCharge;

    const numericId = Math.floor(100000 + Math.random() * 900000);
    const orderId = "BDEC-" + numericId;
    const newOrder = {
      id: orderId,
      fulfillmentType: isPickup ? "pickup" : "delivery",
      customer: {
        name,
        phone,
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

    ACTIVE_ORDERS.push(newOrder);

    // Save order data dynamically to the connected Supabase orders database if available
    if (dbClient) {
      try {
        const serializedMetadata = {
          address,
          area: validArea,
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
            quantity: item.quantity
          }))
        };
        const customerAddressValue = `${address} | METADATA:${JSON.stringify(serializedMetadata)}`;
        
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS

        const rawInsertPayload: Record<string, any> = {
          id: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
          created_at: now.toISOString(),
          "order id": numericId,
          "customer name": name,
          "contact number": phone,
          "customer address": customerAddressValue,
          date: dateStr,
          time: timeStr,
          Price: total, // Total order price (including delivery charges)
          "Delivery charges": finalDeliveryCharge, // Delivery charges column
          "Order pricing": subtotal, // Order pricing column (excluding delivery charges)
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
        let insertedSuccessfully = false;

        for (let attempt = 0; attempt < 20; attempt++) {
          const { error } = await dbClient.from("orders").insert([insertPayload]);
          if (!error) {
            console.log(`Successfully wrote order BDEC-${numericId} to Supabase orders table! Inserted fields:`, Object.keys(insertPayload));
            insertedSuccessfully = true;
            break;
          }

          const match = error.message.match(/Could not find the '([^']+)' column/i);
          if (match && match[1]) {
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

    return res.json({
      success: true,
      orderId: orderId,
      order: newOrder,
      smsStatus: smsResult
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
    return res.status(500).json({ error: err.message || "Failed to dispatch SMS notification" });
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
    return res.status(500).json({ error: err.message || "Failed to dispatch status SMS" });
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
    return res.status(500).json({ error: err.message || "Failed to dispatch Ntfy notification" });
  }
});

app.get("/api/order/:id", async (req, res) => {
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
        let dbStatus = "Order Placed";
        let riderName = "Unassigned";
        let riderContact = "N/A";

        if (rawAddressStr.trim().startsWith("{")) {
          try {
            const parsedJSON = JSON.parse(rawAddressStr);
            dbStatus = parsedJSON.status || "Order Placed";
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

        const createdAt = row.created_at || new Date().toISOString();
        const createdTime = new Date(createdAt).getTime();
        const elapsedSecs = (Date.now() - createdTime) / 1000;

        let currentStatus = dbStatus || metadata?.status || "Order Placed";
        const history = metadata?.statusHistory || [
          { status: "Order Placed", time: new Date(createdAt).toLocaleTimeString(), detail: "Order successfully received at Babay Dee central system" }
        ];

        if (dbStatus && dbStatus !== "Order Placed") {
          const statusLevels = ["In Milling", "Quality Inspected", "Out for Delivery", "Delivered"];
          const targetIdx = statusLevels.indexOf(dbStatus);
          if (targetIdx !== -1) {
            for (let i = 0; i <= targetIdx; i++) {
              const s = statusLevels[i];
              if (!history.find((h: any) => h.status === s)) {
                let detail = "";
                if (s === "In Milling") detail = "Stone-milling fresh Atta and sealing packages at Gulrez Chakki";
                else if (s === "Quality Inspected") detail = "Aromatic grains sifted and moisture checks completed";
                else if (s === "Out for Delivery") {
                  detail = `Dispatched safely. Rider ${riderName !== "Unassigned" ? riderName : ""} (${riderContact !== "N/A" ? riderContact : "on their way"}) is heading to your area.`;
                }
                else if (s === "Delivered") detail = "Order safely handed over. Thank you for choosing Babay Dee Atta Chakki!";

                history.push({
                  status: s,
                  time: new Date(createdTime + (i + 1) * 30000).toLocaleTimeString(),
                  detail
                });
              }
            }
          }
        } else {
          if (elapsedSecs >= 20 && currentStatus === "Order Placed") {
            currentStatus = "In Milling";
            if (!history.find((h: any) => h.status === "In Milling")) {
              history.push({ status: "In Milling", time: new Date(createdTime + 20000).toLocaleTimeString(), detail: "Stone-milling fresh Atta and sealing packages at Gulrez Chakki" });
            }
          }
          if (elapsedSecs >= 50 && (currentStatus === "In Milling" || currentStatus === "Order Placed")) {
            currentStatus = "Quality Inspected";
            if (!history.find((h: any) => h.status === "Quality Inspected")) {
              history.push({ status: "Quality Inspected", time: new Date(createdTime + 50000).toLocaleTimeString(), detail: "Aromatic grains sifted and moisture checks completed" });
            }
          }
          if (elapsedSecs >= 90 && (currentStatus === "Quality Inspected" || currentStatus === "In Milling" || currentStatus === "Order Placed")) {
            currentStatus = "Out for Delivery";
            if (!history.find((h: any) => h.status === "Out for Delivery")) {
              history.push({ status: "Out for Delivery", time: new Date(createdTime + 90000).toLocaleTimeString(), detail: "Dispatched safely. Delivery agent heading towards your area." });
            }
          }
          if (elapsedSecs >= 140 && (currentStatus === "Out for Delivery" || currentStatus === "Quality Inspected" || currentStatus === "In Milling" || currentStatus === "Order Placed")) {
            currentStatus = "Delivered";
            if (!history.find((h: any) => h.status === "Delivered")) {
              history.push({ status: "Delivered", time: new Date(createdTime + 140000).toLocaleTimeString(), detail: "Order safely handed over. Thank you for choosing Babay Dee Atta Chakki!" });
            }
          }
        }

        const order = {
          id: `BDEC-${row["order id"]}`,
          customer: {
            name: row["customer name"] || "Valued Customer",
            phone: row["contact number"] || "",
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

app.post("/api/support/message", (req, res) => {
  const { sessionId, username, phone, text } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: "SessionID and text is mandatory." });
  }

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
      { path: "/?tab=contact", priority: "0.7", changefreq: "monthly" },
      { path: "/?tab=tracker", priority: "0.8", changefreq: "daily" }
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
      xmlContent += `    <lastmod>${today}</lastmod>\n`;
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
