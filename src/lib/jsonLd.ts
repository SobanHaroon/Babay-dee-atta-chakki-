import { Product } from "../types";

export const BASE_URL = "https://babaydeeattachakki.com";

/**
 * Generates Schema.org Product structured data for Google Search rich snippets
 */
export function generateProductJsonLd(product: Product) {
  const isAvailable = !product.outOfStock;
  const productImageUrl = product.productImage || product.img || `${BASE_URL}/logo.jpg`;

  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": [
      productImageUrl.startsWith("http") ? productImageUrl : `${BASE_URL}${productImageUrl}`
    ],
    "description": product.desc || `${product.name} - 100% Pure, Milled Fresh by Babay Dee Atta Chakki.`,
    "sku": product.specs?.["Product Code"] || product.id,
    "mpn": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Babay Dee Atta Chakki"
    },
    "category": product.category,
    "offers": {
      "@type": "Offer",
      "url": `${BASE_URL}/?product=${product.id}`,
      "priceCurrency": "PKR",
      "price": product.price,
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Babay Dee Atta Chakki"
      }
    },
    ...(product.nutrition
      ? {
          "nutrition": {
            "@type": "NutritionInformation",
            "calories": product.nutrition.calories,
            "proteinContent": product.nutrition.protein,
            "fiberContent": product.nutrition.fiber
          }
        }
      : {})
  };
}

/**
 * Generates BreadcrumbList Schema.org structured data
 */
export function generateBreadcrumbJsonLd(crumbs: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url.startsWith("http") ? crumb.url : `${BASE_URL}${crumb.url}`
    }))
  };
}

/**
 * Dynamically injects or updates a JSON-LD script tag in document.head
 */
export function injectJsonLdScript(data: object, scriptId: string = "dynamic-jsonld") {
  if (typeof document === "undefined") return;

  let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement("script");
    scriptEl.id = scriptId;
    scriptEl.type = "application/ld+json";
    document.head.appendChild(scriptEl);
  }

  scriptEl.textContent = JSON.stringify(data, null, 2);
}

/**
 * Removes a injected JSON-LD script tag from document.head
 */
export function removeJsonLdScript(scriptId: string = "dynamic-jsonld") {
  if (typeof document === "undefined") return;
  const scriptEl = document.getElementById(scriptId);
  if (scriptEl) {
    scriptEl.remove();
  }
}
