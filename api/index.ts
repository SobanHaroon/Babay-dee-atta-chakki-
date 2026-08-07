import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// Initialize Supabase Client
const dbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://dlinknypnlmcrhgbediu.supabase.co";
const dbKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_KkOjGDoE3yq7tKIKzIfajg_sIoyPlUT";
const dbClient = createClient(dbUrl, dbKey);

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
  const ntfyTopic = process.env.NTFY_TOPIC || "baby_dee_chakki_orders_0c518";
  const itemsText = order.items
    .map((item: any) => `• ${item.name} (${item.quantity} ${item.unit || "unit"}) @ Rs.${item.price} = Rs.${item.price * item.quantity}`)
    .join("\n");
  const formattedDateTime = new Date(order.createdAt).toLocaleString("en-US", { timeStyle: "medium", dateStyle: "long" });

  const deliverySummaryText = order.deliveryCharges === 0 ? "🌾 FREE SHIPPING milestone earned!" : `Rs. ${order.deliveryCharges}`;

  const ntfyBody = `🌾 NEW CHAKKI ORDER RECEIVED!
-------------------------------
Order Code: ${order.id}
Milled Date & Time: ${formattedDateTime}

[Customer Coordinates]
Name: ${order.customer.name}
Contact Number: ${order.customer.phone}
Address: ${order.customer.address}, ${order.customer.area}

[Basket Ledger Summary]
${itemsText}

Sourced Subtotal: Rs. ${order.subtotal}
Express Delivery Fee: ${deliverySummaryText}
${order.discount > 0 ? `Milestone Discount: Rs. ${order.discount}\n` : ""}-------------------------------
Grand Total Ledger: Rs. ${order.total}
Settlement Method: ${order.paymentMethod || "Cash on Delivery"}`;

  try {
    const titleText = `New Order Received: ${order.id}`;
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
    console.error("Ntfy notification dispatch exception error:", err);
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

app.post("/api/checkout", async (req, res) => {
  try {
    const { name, phone, address, neighborhood, city, area, cartItems, paymentMethod, deliveryDate, deliverySlot } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ error: "Customer name, contact phone, and complete address are required." });
    }

    const validCartItems = Array.isArray(cartItems) && cartItems.length > 0 ? cartItems : [];
    if (validCartItems.length === 0) {
      return res.status(400).json({ error: "Your basket is empty. Please add items to your basket before placing an order." });
    }

    const rawArea = String(area || city || "Rawalpindi").trim();
    const cleanArea = rawArea.toLowerCase();
    const isIslamabad = cleanArea.includes("islamabad") || cleanArea === "isb" || cleanArea.includes("islo");
    const validatedArea = isIslamabad ? "Islamabad" : (rawArea || "Rawalpindi");
    const cleanNeighborhood = String(neighborhood || "").trim();
    const fullAddress = [String(address || "").trim(), cleanNeighborhood, validatedArea].filter(Boolean).join(", ");

    const subtotal = validCartItems.reduce((acc: number, item: any) => {
      const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
      const qty = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 1;
      return acc + (price * qty);
    }, 0);
    
    const distanceKm = typeof req.body.distanceKm === "number" && !isNaN(req.body.distanceKm) && req.body.distanceKm > 0 
      ? req.body.distanceKm 
      : (validatedArea === "Islamabad" ? 12 : 6);
    const rawDeliveryCharges = Math.round(distanceKm * 50);
    const deliveryCharges = subtotal >= 3000 ? 0 : rawDeliveryCharges;
    const discount = 0;
    const total = subtotal + deliveryCharges;

    const numericId = Math.floor(100000 + Math.random() * 900000);
    const orderId = "BDEC-" + numericId;
    const newOrder = {
      id: orderId,
      customer: { name, phone, address: fullAddress, area: validatedArea, neighborhood: cleanNeighborhood },
      items: validCartItems,
      paymentMethod: paymentMethod || "Cash on Delivery",
      subtotal,
      deliveryCharges,
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
          address: fullAddress,
          area: validatedArea,
          neighborhood: cleanNeighborhood,
          paymentMethod: paymentMethod || "Cash on Delivery",
          subtotal,
          deliveryCharges,
          discount,
          total,
          deliveryDate: newOrder.deliveryDate,
          deliverySlot: newOrder.deliverySlot,
          status: "Order Placed",
          statusHistory: newOrder.statusHistory,
          items: validCartItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        };
        const customerAddressValue = `${fullAddress} | METADATA:${JSON.stringify(serializedMetadata)}`;
        
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0]; // HH:MM:SS

        const insertPayload = {
          id: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
          created_at: now.toISOString(),
          "order id": numericId,
          "customer name": name,
          "contact number": phone,
          "customer address": customerAddressValue,
          date: dateStr,
          time: timeStr,
          Price: total
        };

        const { error } = await dbClient.from("orders").insert([insertPayload]);
        if (error) {
          console.error("Error inserting order to Supabase:", error);
        } else {
          console.log(`Successfully wrote order BDEC-${numericId} to Supabase!`);
        }
      } catch (err) {
        console.error("Exception writing order to Supabase:", err);
      }
    }

    // Await order notification dispatch
    try {
      await triggerOrderNotification(newOrder);
    } catch (ntfyErr) {
      console.error("Notification dispatch error in checkout handler:", ntfyErr);
    }

    return res.json({
      success: true,
      orderId: orderId,
      order: newOrder
    });
  } catch (globalCheckoutErr: any) {
    console.error("Global checkout handler exception:", globalCheckoutErr);
    return res.status(500).json({
      error: "Internal checkout system exception."
    });
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
