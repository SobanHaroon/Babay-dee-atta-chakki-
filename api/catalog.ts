/** The only conversion from database catalog rows to the public storefront model.
 * `quantity` is legacy inventory, never a sale unit or a pack weight.
 * New nullable fields require an owner-confirmed backfill before a row can sell.
 */
export const PRODUCT_PUBLIC_COLUMNS = 'id,"product name",price,quantity,place,"Product Category","Product Images",sale_unit,stock_quantity,pack_weight_kg,variant_label';

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const firstText = (...values: unknown[]) => values.map(text).find(Boolean) || '';
export function catalogNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const normalized = typeof value === 'string' ? value.trim().replace(/,/g, '') : value;
  if (normalized === '' || (typeof normalized === 'string' && !/^\d+(?:\.\d+)?$/.test(normalized))) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function categoryFor(p: Row, id: string) {
  const raw = firstText(p['Product Category'], p.product_category, p['product category'], p.category).toLowerCase();
  if (/flour|atta/.test(raw)) return 'flour';
  if (/rice|chawal/.test(raw)) return 'rice';
  if (/lentil|daal|pulse/.test(raw)) return 'lentils';
  if (/dry|fruit/.test(raw)) return 'dry_fruits';
  if (/herb|supplement|spice/.test(raw)) return 'herbs';
  if (raw) return raw;
  // Existing category assignments are retained; they do not determine pricing units.
  const n = Number(id);
  if (n >= 1 && n <= 15 || n >= 42 && n <= 44) return 'flour';
  if (n >= 16 && n <= 25) return 'rice';
  if (n >= 26 && n <= 41) return 'lentils';
  if (n >= 45 && n <= 94) return 'dry_fruits';
  return 'herbs';
}

function imageFor(name: string, category: string) {
  const value = name.toLowerCase();
  if (category === 'rice') return 'basmati_kainat_340.png';
  if (category === 'lentils') return 'daal_mong.png';
  const map = category === 'flour'
    ? {makai:'makai_atta_yellow.png',diet:'diet_atta_multigrain.png',multi:'diet_atta_multigrain.png',jo:'jo_atta.png',suji:'suji.png',maida:'maida.png',besan:'besan.png',bajra:'bajra_atta.png'}
    : category === 'dry_fruits'
      ? {badaam:'badaam_giri.png',kishmish:'sugi_gol_kishmish.png',kaju:'kaju_roasted.png',akhrot:'akhrot_giri.png',khajoor:'khajoor_rabi_irani.png'}
      : {ispaghol:'ispaghol_husk.png'};
  return Object.entries(map).find(([word]) => value.includes(word))?.[1] || (category === 'flour' ? 'chakki_atta.png' : category === 'dry_fruits' ? 'badaam_giri.png' : 'herbal_supplement.png');
}

function imageUrl(value: unknown) {
  const source = text(value);
  if (!source || source.length > 2048) return undefined;
  if (source.startsWith('/') && !source.startsWith('//')) return source;
  try { const parsed = new URL(source); return parsed.protocol === 'https:' ? parsed.href : undefined; } catch { return undefined; }
}

export function normalizeCatalogProduct(p: Row) {
  const id = String(p.id ?? '').trim();
  const name = firstText(p['product name'], p.name);
  const price = catalogNumber(p.price);
  const category = categoryFor(p, id);
  // Accept only explicitly recorded sale units, never numbers from quantity.
  const rawUnit = firstText(p.sale_unit, p.saleUnit, p.unit).toLowerCase();
  const saleUnit: 'kg' | 'pack' | null = /^(kg|kgs|kilogram|kilograms)$/.test(rawUnit) ? 'kg' : /^(pack|packs|packet|packets)$/.test(rawUnit) ? 'pack' : null;
  const stockQuantity = catalogNumber(p.stock_quantity ?? p.stockQuantity);
  const legacyStockQuantity = catalogNumber(p.quantity);
  const packWeightKg = catalogNumber(p.pack_weight_kg ?? p.packWeightKg);
  const catalogIssues: string[] = [];
  if (!id || !name) catalogIssues.push('missing_identity');
  if (!price || price <= 0) catalogIssues.push('invalid_price');
  if (!saleUnit) catalogIssues.push('unconfirmed_sale_unit');
  if (stockQuantity === null) catalogIssues.push('unconfirmed_stock');
  if (saleUnit === 'pack' && (!packWeightKg || packWeightKg <= 0)) catalogIssues.push('unconfirmed_pack_weight');
  if (saleUnit === 'pack' && stockQuantity !== null && !Number.isInteger(stockQuantity)) catalogIssues.push('invalid_pack_stock');
  const unavailableText = [p.quantity, p.place, p.status, name].map(text).join(' ').toLowerCase();
  const flagged = p.out_of_stock === true || p.out_of_stock === 'true' || p.outOfStock === true || p.is_out_of_stock === true || /out[ -]of[ -]stock|sold out/.test(unavailableText);
  const outOfStock = flagged || stockQuantity === 0 || catalogIssues.length > 0;
  const code = firstText(p.product_code, p.sku) || text(p.place).match(/\bCode:\s*([^\s|]+)/i)?.[1] || id;
  const variantLabel = firstText(p.variant_label, p.variantLabel, p.grade, p.variant) || undefined;
  const unit = saleUnit === 'kg' ? 'Kg' : saleUnit === 'pack' ? 'Pack' : 'Unit unconfirmed';
  return {
    id, name, price: price ?? 0, unit, saleUnit, stockQuantity, legacyStockQuantity, packWeightKg, quantityStep: saleUnit === 'kg' ? 0.1 : 1,
    catalogIssues, purchasable: !outOfStock, outOfStock, variantLabel,
    desc: firstText(p.desc, p.description) || name,
    img: imageFor(name, category),
    productImage: imageUrl(p['Product Images'] ?? p.product_image ?? p.productImage),
    category, featured: Number(id) <= 15 || id === '45' || id === '631', popular: Number(id) <= 10 || id === '61' || id === '631',
    specs: {'Product Code': code, ...(variantLabel ? {'Variant': variantLabel} : {}), ...(packWeightKg && saleUnit === 'pack' ? {'Pack weight': `${packWeightKg} Kg`} : {})},
  };
}

export function normalizeCatalog(rows: Row[]) {
  const products = rows.map(normalizeCatalogProduct).sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric:true}));
  const duplicates = new Map<string, number>();
  for (const product of products) { const key = product.name.toLowerCase(); duplicates.set(key, (duplicates.get(key) || 0) + 1); }
  const seenIds = new Set<string>();
  return products.filter(product => {
    // A duplicate database identity cannot be made orderable with a fabricated ID.
    if (!product.id || seenIds.has(product.id)) return false;
    seenIds.add(product.id);
    if ((duplicates.get(product.name.toLowerCase()) || 0) > 1 && !product.variantLabel) {
      product.variantLabel = `Product code ${product.specs['Product Code']}`;
      product.specs.Variant = product.variantLabel;
      product.catalogIssues.push('variant_description_needed');
      // Product codes distinguish existing rows without inventing a grade.
    }
    return true;
  });
}
