import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {availableBundle, cartFromProduct, isPurchasable, productLabel, quantityIsAllowed} from '../src/lib/catalogPresentation';
import {WeightQtyEditor, displayFormattedQty} from '../src/components/WeightQtyEditor';
import {ReviewsSection} from '../src/components/ReviewsSection';
import {generateOrderReceiptHtml} from '../src/lib/orderReceipt';
import {orderTrackingUrl} from '../src/lib/orderAccess';
import type {Product} from '../src/types';

const product = (id:string,name:string,overrides:Partial<Product> = {}):Product => ({id,name,price:170,unit:'Kg',saleUnit:'kg',quantityStep:.1,stockQuantity:10,purchasable:true,desc:'Synthetic fixture',img:'',category:'flour',...overrides});

test('sale units control quantity and pack quantities never become kilograms', () => {
  assert.equal(displayFormattedQty(2,'Pack'),'2 Packs');
  assert.equal(displayFormattedQty(.5,'Kg'),'500g');
  const packs = renderToStaticMarkup(React.createElement(WeightQtyEditor,{quantity:2,unit:'Pack',onChange:()=>{}}));
  assert.match(packs,/Quantity in Pack/); assert.doesNotMatch(packs,/500g|1 Kg/);
  const pack = product('pack','Test pack',{unit:'Pack',saleUnit:'pack',quantityStep:1});
  assert.equal(quantityIsAllowed(.5,pack),false); assert.equal(quantityIsAllowed(2,pack),true);
  assert.equal(quantityIsAllowed(.15,product('1','Atta')),false);
  assert.equal(quantityIsAllowed(Infinity,pack),false); assert.equal(quantityIsAllowed(11,pack),false);
});

test('bundles omit unavailable components and never replace them with arbitrary products', () => {
  const products = [product('1','Chakki Atta'),product('2','Besan'),product('3','Suji')];
  assert.equal(availableBundle(products).length,3);
  assert.deepEqual(availableBundle(products.map(p => p.id === '2' ? {...p,outOfStock:true} : p)),[]);
  assert.deepEqual(availableBundle([products[0],products[2],product('4','Rice')]),[]);
  assert.deepEqual(availableBundle(products.map(p => ({...p,stockQuantity:.5}))),[]);
  assert.equal(isPurchasable({...products[0],purchasable:false}),false);
});

test('the same explicit variant and unit survive cart and receipt presentation', () => {
  const p=product('r1','Rice',{variantLabel:'Owner supplied grade',unit:'Pack',saleUnit:'pack',quantityStep:1,packWeightKg:2});
  assert.match(productLabel(p),/Owner supplied grade/);
  const item=cartFromProduct(p,2);
  assert.equal(item.unit,'Pack'); assert.equal(item.packWeightKg,2); assert.equal(item.variantLabel,p.variantLabel);
});

test('only backend-qualified reviews receive the purchase badge; pending/synthetic reviews stay hidden', () => {
  const base={rating:5,city:'Rawalpindi',review:'Synthetic test text',date:'2026-10-02'};
  const html=renderToStaticMarkup(React.createElement(ReviewsSection,{isLoading:false,onAddReview:()=>{},reviews:[
    {...base,id:'a',name:'Ordinary fixture',verifiedPurchase:false},
    {...base,id:'b',name:'Qualifying fixture',verifiedPurchase:true,status:'approved'},
    {...base,id:'c',name:'Pending fixture',status:'pending'},
    {...base,id:'d',name:'Dummy fixture',isSynthetic:true},
  ]}));
  assert.match(html,/Ordinary fixture/); assert.match(html,/Qualifying fixture/);
  assert.doesNotMatch(html,/Pending fixture|Dummy fixture|Verified Customer Reviews|100% authentic/);
  assert.equal((html.match(/Verified purchase<\/span>/g)||[]).length,1);
});

test('tracking tokens are in URL fragments; escaped receipts retain access without exposing token in query', () => {
  const url=new URL(orderTrackingUrl('BDEC-FIXTURE','opaque-synthetic-token','https://example.test'));
  assert.equal(url.searchParams.get('order'),'BDEC-FIXTURE'); assert.equal(url.searchParams.has('access'),false);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('access'),'opaque-synthetic-token');
  const html=generateOrderReceiptHtml({id:'BDEC-FIXTURE',orderAccessToken:'opaque-synthetic-token',customer:{name:'<script>test</script>',address:'Original house and street'},items:[],total:0,createdAt:'2026-10-02T00:00:00Z'},'https://example.test');
  assert.match(html,/#access=opaque-synthetic-token/); assert.match(html,/Original house and street/);
  assert.doesNotMatch(html,/<script>test<\/script>/); assert.match(html,/&lt;script&gt;/);
});
