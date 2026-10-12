import type { Product, CartItem } from '../types';

export function hasUnconfirmedSaleDetails(product: Product): boolean {
  return !!product.catalogIssues?.some(issue => issue !== 'variant_description_needed');
}

export function isPurchasable(product: Product): boolean {
  return !product.outOfStock && product.purchasable !== false && Number.isFinite(product.price) && product.price > 0;
}

export function isWeightUnit(unit: string = ''): boolean { return /^(kg|kilograms?)$/i.test(unit.trim()); }
export function productLabel(product: Pick<Product, 'name' | 'variantLabel'>): string {
  return product.variantLabel ? `${product.name} · ${product.variantLabel}` : product.name;
}
export function quantityIsAllowed(quantity: number, product: Pick<Product, 'unit' | 'quantityStep' | 'stockQuantity'>): boolean {
  const step = product.quantityStep || (isWeightUnit(product.unit) ? 0.1 : 1);
  return Number.isFinite(quantity) && quantity >= step && quantity <= 100 &&
    Math.abs(quantity / step - Math.round(quantity / step)) < 1e-7 &&
    (product.stockQuantity == null || quantity <= product.stockQuantity);
}
export function availableBundle(products: Product[]): Product[] {
  const available = products.filter(p => isPurchasable(p) && (p.stockQuantity == null || p.stockQuantity >= 1));
  const groups = [/\b(atta|wheat)\b/i, /\b(besan|gram flour)\b/i, /\b(suji|semolina|maida)\b/i];
  const result: Product[] = [];
  for (const group of groups) {
    const item = available.find(p => group.test(p.name) && !result.some(chosen => chosen.id === p.id));
    if (!item) return [];
    result.push(item);
  }
  return result;
}
export function cartFromProduct(product: Product, quantity: number): CartItem {
  return { id: product.id, name: product.name, variantLabel: product.variantLabel, price: product.price,
    unit: product.unit, saleUnit: product.saleUnit, quantityStep: product.quantityStep, packWeightKg: product.packWeightKg,
    img: product.img, productImage: product.productImage, quantity, unavailable: !isPurchasable(product) };
}
