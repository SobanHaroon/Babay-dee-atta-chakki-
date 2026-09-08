import { Product } from "../types";
import { supabase } from "./supabaseClient";

export { supabase };

export function mapSupabaseProduct(p: any): Product {
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
    // Fallback ID range mapping
    if (numId >= 1 && numId <= 15) {
      category = "flour";
    } else if (numId >= 16 && numId <= 25) {
      category = "rice";
    } else if (numId >= 26 && numId <= 41) {
      category = "lentils";
    } else if (numId >= 42 && numId <= 44) {
      category = "flour";
    } else if (numId >= 45 && numId <= 94) {
      category = "dry_fruits";
    } else if (numId >= 622 && numId <= 724) {
      category = "herbs";
    }
  }

  let unit = "Kg";
  let outOfStock = false;
  const rawQty = String(p.quantity || "").trim();
  const parsedQty = parseFloat(rawQty.replace(/,/g, ""));

  if (!isNaN(parsedQty)) {
    if (parsedQty <= 0) {
      outOfStock = true;
    }
  } else {
    if (rawQty.toLowerCase().includes("out of stock") || rawQty.toLowerCase().includes("sold out") || rawQty === "0") {
      outOfStock = true;
    }
  }
  unit = "Kg";

  let code = pId;
  if (p.place) {
    const codeMatch = p.place.match(/Code:\s*([^\s|]+)/);
    if (codeMatch) code = codeMatch[1];
  }

  const specs: Record<string, string> = {
    "Product Code": code,
  };
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
  } else if (category === "rice") {
    img = "basmati_kainat_340.png";
  } else if (category === "lentils") {
    img = "daal_mong.png";
  } else if (category === "dry_fruits") {
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
    p.out_of_stock === true || 
    p.out_of_stock === "true" || 
    p.outOfStock === true || 
    p.is_out_of_stock === true ||
    p.status === "out of stock" ||
    p.status === "out-of-stock" ||
    qtyStr === "0" || 
    qtyStr === "out of stock" || 
    qtyStr === "out-of-stock" || 
    qtyStr === "sold out" ||
    placeStr.includes("out of stock") || 
    placeStr.includes("out-of-stock") || 
    placeStr.includes("sold out") ||
    nameStr.includes("out of stock") ||
    nameStr.includes("out-of-stock")
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
  };
}

/**
 * Direct client-side fetch from Supabase table if express /api endpoint fails or on Vercel
 */
export async function fetchProductsFromSupabaseDirectly(): Promise<Product[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("products").select("*");
    if (error || !data || data.length === 0) {
      console.warn("Direct Supabase query empty or returned error:", error);
      return [];
    }
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
  } catch (err) {
    console.error("Direct Supabase fetch exception:", err);
    return [];
  }
}
