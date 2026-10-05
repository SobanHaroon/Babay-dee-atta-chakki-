import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogNumber, normalizeCatalog, normalizeCatalogProduct } from '../api/catalog.js';

const base = {id: '4', 'product name': 'CHAKKI ATTA', price: '180', quantity: '200', stock_quantity:200, sale_unit: 'kg'};
test('stock counts never become sale units or pack weights', () => {
  for (const quantity of ['0', '00000', '50', '500']) {
    const row = normalizeCatalogProduct({...base, quantity, stock_quantity:Number(quantity)});
    assert.equal(row.unit, 'Kg'); assert.equal(row.stockQuantity, Number(quantity)); assert.equal(row.packWeightKg, null);
    assert.equal(row.outOfStock, Number(quantity) === 0);
  }
  const ambiguous = normalizeCatalogProduct({...base, sale_unit: undefined});
  assert.equal(ambiguous.saleUnit, null); assert.equal(ambiguous.purchasable, false);
  assert.ok(ambiguous.catalogIssues.includes('unconfirmed_sale_unit'));
  assert.equal(normalizeCatalogProduct({...base,stock_quantity:undefined}).purchasable,false);
});
test('pack units and pack weight require explicit source values', () => {
  const pack = normalizeCatalogProduct({...base, sale_unit:'pack', stock_quantity:10, pack_weight_kg:0.5});
  assert.equal(pack.unit, 'Pack'); assert.equal(pack.quantityStep, 1); assert.equal(pack.packWeightKg, 0.5); assert.equal(pack.purchasable, true);
  assert.equal(normalizeCatalogProduct({...base,sale_unit:'pack'}).purchasable, false);
  assert.equal(normalizeCatalogProduct({...base,sale_unit:'pack',stock_quantity:1.5,pack_weight_kg:1}).purchasable, false);
});
test('invalid price and inventory values are rejected rather than parsed partially', () => {
  for (const value of ['180abc', 'Infinity', -1, '', null, '1,00bad']) assert.equal(catalogNumber(value), null);
  assert.equal(catalogNumber('1,200.50'),1200.5);
  assert.equal(normalizeCatalogProduct({...base,price:'180abc'}).purchasable,false);
  assert.equal(normalizeCatalogProduct({...base,quantity:'sold out'}).outOfStock,true);
  assert.equal(normalizeCatalogProduct({...base,stock_quantity:'unknown'}).purchasable,false);
});
test('rice variants use recorded grade or product codes without guessed quality claims', () => {
  const rows = normalizeCatalog([{...base,id:'16','product name':'Basmati Kainat',variant_label:'1121 Steam'}, {...base,id:'17','product name':'Basmati Kainat'}, {...base,id:'18','product name':'Basmati Kainat'}]);
  assert.equal(rows[0].variantLabel,'1121 Steam'); assert.equal(rows[1].variantLabel,'Product code 17'); assert.equal(rows[2].variantLabel,'Product code 18');
  assert.equal('nutrition' in rows[0],false); assert.equal('Purity Grade' in rows[0].specs,false);
});
test('public catalog is projected and image protocols constrained', () => {
  const row = normalizeCatalogProduct({...base,customer_phone:'private',supplier_cost:20,productImage:'javascript:alert(1)'});
  assert.equal('customer_phone' in row,false); assert.equal('supplier_cost' in row,false); assert.equal(row.productImage,undefined);
  assert.equal(normalizeCatalogProduct({...base,productImage:'https://example.com/product.png'}).productImage,'https://example.com/product.png');
});
test('duplicate identities never turn into fabricated orderable product IDs', () => {
  assert.deepEqual(normalizeCatalog([base,base]).map(row=>row.id),['4']);
});
