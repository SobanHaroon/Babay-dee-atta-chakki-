import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installSecurity, normalizePhone, priceCart } from '../api/security.js';
import app from '../api/index.js';

test('checkout ignores caller-supplied prices and product names', () => {
  const result=priceCart([{id:'1',price:0.01,name:'tampered',quantity:2}], [{id:'1',price:170,name:'Chakki Atta',unit:'Kg'}]);
  assert.equal(result[0].price,170); assert.equal(result[0].name,'Chakki Atta');
});
test('checkout rejects unknown products, invalid quantities and unavailable stock', () => {
  const catalog=[{id:'1',price:170}];
  for(const quantity of [-1,0,101,NaN,Infinity,'2',0.001]) assert.throws(()=>priceCart([{id:'1',quantity}],catalog));
  assert.throws(()=>priceCart([{id:'x',quantity:1}],catalog));
  assert.throws(()=>priceCart([{id:'1',quantity:1}],[{id:'1',price:170,outOfStock:true}]));
  assert.throws(()=>priceCart([],catalog));
});
test('normalizes Pakistani order phone formats',()=>{ assert.equal(normalizePhone('+92 321 5010846'),'03215010846'); assert.equal(normalizePhone('0321-5010846'),'03215010846'); assert.equal(normalizePhone({}), ''); });
test('sensitive routes fail closed and reject foreign origins',async()=>{
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address() as {port:number}; const base=`http://127.0.0.1:${address.port}`;
  try {
    for(const [url,method] of [['/api/admin/delivery-areas','POST'],['/api/email/status','GET'],['/api/notifications/order-sms','POST'],['/api/order/BDEC-123/status','POST']]) {
      const res=await fetch(base+url,{method}); assert.equal(res.status,401,url);
    }
    const foreign=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example'}});assert.equal(foreign.status,403);
    for(const url of ['/api/order/BDEC-123','/api/order/BDEC-123/receipt-html']) assert.equal((await fetch(base+url)).status,401);
    const receipt=await fetch(base+'/api/order/send-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:{customer:{email:'spam@example.com'}}})});assert.equal(receipt.status,401);
    const invalid=await fetch(base+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:{},phone:'x'})});assert.equal(invalid.status,400);
    const malformed=await fetch(base+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(malformed.status,400);assert.equal((await malformed.text()).includes('stack'),false);
    const oversized=await fetch(base+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:'x'.repeat(70000)})});assert.equal(oversized.status,413);
    const health=await fetch(base+'/api/health'); assert.equal(health.headers.get('x-powered-by'),null);assert.equal(health.headers.get('x-content-type-options'),'nosniff');assert.equal(health.headers.get('cache-control'),'no-store');
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
test('rate limits are enforced',async()=>{
  const limited=express();installSecurity(limited);limited.post('/api/reviews',(_req,res)=>res.json({ok:true}));
  const server=limited.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/reviews`;let response;for(let i=0;i<13;i++)response=await fetch(url,{method:'POST'});assert.equal(response!.status,429);assert.ok(response!.headers.get('retry-after'));}
  finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
