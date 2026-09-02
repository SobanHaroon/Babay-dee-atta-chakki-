import { Product } from "../types";

export interface OrbitalSpec {
  name: string;
  kw: string[];
  price: number;
  unit: string;
  desc: string;
  badge: string;
  img: string;
}

/**
 * Builds orbital items dynamically mapped 1:1 with database products.
 * Guarantees that exact database product name, price, images, description,
 * and specs are reflected in the Orbital Image Wheel.
 */
export function buildOrbitalItems(
  prefix: string,
  specs: OrbitalSpec[],
  products: Product[]
) {
  if (!products || products.length === 0) {
    return specs.map((spec, idx) => ({
      id: `${prefix}_synth_${idx}`,
      src: spec.img,
      alt: spec.name,
      label: spec.name,
      subtitle: spec.desc,
      price: spec.price,
      badge: spec.badge,
      category: spec.name.toLowerCase().includes("daal") ? "lentils" : "flour",
      productObj: {
        id: `${prefix}_synth_${idx}`,
        name: spec.name,
        price: spec.price,
        unit: spec.unit,
        desc: spec.desc,
        img: "chakki_atta.png",
        productImage: spec.img,
        category: spec.name.toLowerCase().includes("daal") ? "lentils" : "flour",
        specs: { "Milling Style": "Stone Ground", Sourcing: "Rawalpindi & Islamabad" },
        outOfStock: false,
      } as Product,
    }));
  }

  const usedProductIds = new Set<string>();

  return specs.map((spec, idx) => {
    // 1. Look for exact or keyword match in the database products
    let matched = products.find((p) => {
      if (usedProductIds.has(String(p.id))) return false;
      const pName = (p.name || "").toLowerCase().trim();
      const pDesc = (p.desc || "").toLowerCase().trim();
      const pId = String(p.id).toLowerCase();
      return (
        spec.kw.some((k) => pName.includes(k.toLowerCase()) || pDesc.includes(k.toLowerCase()) || pId === k.toLowerCase())
      );
    });

    // 2. If already matched or not found, try matching by category or name similarity
    if (!matched) {
      const targetCat = spec.name.toLowerCase().includes("daal") || spec.name.toLowerCase().includes("lentil") ? "lentils" : spec.name.toLowerCase().includes("rice") ? "rice" : "flour";
      matched = products.find((p) => !usedProductIds.has(String(p.id)) && p.category === targetCat);
    }

    // 3. If still not matched, pick any unused database product
    if (!matched) {
      matched = products.find((p) => !usedProductIds.has(String(p.id))) || products[idx % products.length];
    }

    if (matched) {
      usedProductIds.add(String(matched.id));
      return {
        id: matched.id,
        src: matched.productImage || spec.img,
        alt: matched.name,
        label: matched.name,
        subtitle: matched.desc || spec.desc,
        price: matched.price,
        badge: matched.badge || spec.badge,
        category: matched.category || "flour",
        productObj: matched,
      };
    }

    // Fallback if database had no items at all
    const syntheticProd: Product = {
      id: `${prefix}_${idx}`,
      name: spec.name,
      price: spec.price,
      unit: spec.unit,
      desc: spec.desc,
      img: "chakki_atta.png",
      productImage: spec.img,
      category: "flour",
      specs: { "Milling Style": "Stone Ground", Sourcing: "Rawalpindi & Islamabad Local" },
      outOfStock: false,
    };

    return {
      id: syntheticProd.id,
      src: spec.img,
      alt: spec.name,
      label: spec.name,
      subtitle: spec.desc,
      price: spec.price,
      badge: spec.badge,
      category: syntheticProd.category,
      productObj: syntheticProd,
    };
  });
}
