import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {orderWhatsAppUrl, DELIVERY_CHARGES_NOTE} from '../src/lib/orderWhatsApp.js';
import {generateOrderReceiptHtml, generateOrderReceiptPlainText} from '../src/lib/orderReceipt.js';
import {OrderReceiptSummary} from '../src/components/OrderReceiptSummary.js';
import {formatStaffOrder} from '../server/staffNotifications.js';
import type {Order} from '../src/types.js';

const order: Order = {
  id:'BDEC-11111111111111111111111111111111', fulfillmentType:'delivery',
  customer:{name:'Sana & Ali',phone:'03211234567',address:'House #14, Flat 2 & 3\nGulraiz, راولپنڈی',area:''},
  items:[{id:'1',name:'Chakki Atta',quantity:2,unit:'Kg',price:170,img:''}],
  subtotal:340,deliveryCharges:0,deliveryChargeStatus:'pending',total:340,paymentMethod:'Cash on Delivery',
  status:'Order Placed',statusHistory:[],createdAt:'2026-11-11T09:00:00Z',
};

test('WhatsApp uses the business number and safely encodes each saved order',()=>{
  for (const saved of [order,{...order,id:'BDEC-22222222222222222222222222222222',customer:{...order.customer,name:'Different Customer',phone:'03351234567',address:'House 88, Islamabad'}}]) {
    const url=new URL(orderWhatsAppUrl(saved));
    assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/923215010846');assert.equal(url.hash,'');
    assert.equal([...url.searchParams.keys()].length,1);
    const text=url.searchParams.get('text')!;
    for (const value of [saved.id,saved.customer.name,saved.customer.address,saved.customer.phone]) assert.ok(text.includes(value));
    assert.match(text,/total price including delivery charges/);
    assert.doesNotMatch(text,/orderAccessToken|access=/);
  }
});

test('pickup message uses the store address instead of a previous delivery address',()=>{
  const text=new URL(orderWhatsAppUrl({...order,fulfillmentType:'pickup'})).searchParams.get('text')!;
  assert.match(text,/Store pickup.*Main Gulraiz Phase 3/);assert.match(text,/pickup details/);
  assert.ok(!text.includes(order.customer.address));assert.doesNotMatch(text,/including delivery charges/);
});

test('on-screen, HTML and plain text invoices clearly exclude pending delivery',()=>{
  const outputs=[renderToStaticMarkup(React.createElement(OrderReceiptSummary,{order})),generateOrderReceiptHtml(order),generateOrderReceiptPlainText(order)];
  for(const output of outputs){
    assert.match(output,/total before delivery/i);assert.ok(output.includes(DELIVERY_CHARGES_NOTE));
    assert.match(output,/Confirmed on WhatsApp/);assert.doesNotMatch(output,/Grand Total Payable|GRAND TOTAL:|FREE \(Rs\. 0\)/);
  }
});

test('pickup and existing priced orders keep their original receipt totals',()=>{
  for (const saved of [{...order,fulfillmentType:'pickup' as const,deliveryChargeStatus:'confirmed' as const},{...order,deliveryChargeStatus:undefined,deliveryCharges:60,total:400}]) {
    const html=generateOrderReceiptHtml(saved),plain=generateOrderReceiptPlainText(saved);
    assert.ok(!html.includes(DELIVERY_CHARGES_NOTE));assert.ok(!plain.includes(DELIVERY_CHARGES_NOTE));
    assert.match(html,/Grand Total Payable/);
    if(saved.fulfillmentType==='pickup')assert.match(html,/FREE \(Rs\. 0\)/);
    else {assert.match(html,/Rs\. 60/);assert.match(html,/Rs\. 400/);}
  }
});

test('staff order alerts explain that delivery is pending instead of calling it free',()=>{
  const text=formatStaffOrder({orderId:order.id,legacyOrderId:123,leaseToken:'synthetic',total:order.total,fulfillmentType:'delivery',deliveryDate:'2026-11-11',deliverySlot:'Morning',details:order}).join('\n');
  assert.match(text,/Delivery charges: Confirmed on WhatsApp/);assert.match(text,/Order total before delivery: Rs\. 340/);
  assert.ok(text.includes(DELIVERY_CHARGES_NOTE));
});
