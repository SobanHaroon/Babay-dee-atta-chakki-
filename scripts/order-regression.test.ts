import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../api/index.js';
import {checkout,authorizeOrder,parseReview,CommerceError,type CommerceRepository,type StoredOrder} from '../api/commerce.js';
import {signDeliveryQuote,verifyDeliveryQuote} from '../api/addressDelivery.js';
import {memoryRateStore} from '../api/security.js';
import {upcomingDeliveryDays} from '../src/lib/commerce.js';
process.env.NODE_ENV='test';process.env.ORDER_ACCESS_SECRET='synthetic-order-access-secret-with-over-32-characters';process.env.DELIVERY_QUOTE_SECRET='synthetic-quote-secret-with-over-32-characters';
process.env.ENABLE_CUSTOMER_NOTIFICATIONS='false';process.env.APP_ENV='test';
const settings={storeLatitude:33.567348,storeLongitude:73.10451,pricePerKm:50,maxDeliveryDistanceKm:45};
const product={id:'1',name:'Synthetic Atta',price:170,unit:'Kg',saleUnit:'kg',stockQuantity:10,quantityStep:.1,purchasable:true};
function repository(){
 const rows=new Map<string,StoredOrder>();let stock=10,inserts=0,receipts=0;const reviews:any[]=[];
 const repo:CommerceRepository={
  async findRetry(context){return [...rows.values()].find(r=>r.checkout_context===context)||null;},
  async place(record){const existing=[...rows.values()].find(r=>r.checkout_context===record.checkout_context);if(existing){if(existing.request_hash!==record.request_hash||existing.idempotency_key!==record.idempotency_key)throw new CommerceError('Conflicting retry',409);return {record:existing,created:false};}
   const needed=record.document.items.reduce((sum:number,item:any)=>sum+item.quantity,0);if(needed>stock)throw new CommerceError('Stock changed while checking out.',409,'STOCK_CHANGED');stock-=needed;inserts++;rows.set(record.id,structuredClone(record));return {record,created:true};},
  async findOrder(id){return rows.get(id)||null;},async claimReceipt(){return ++receipts<=1;},async reviews(){return reviews.filter(r=>r.status==='approved');},async saveReview(review){reviews.push(review);}
 };return {repo,rows,reviews,get inserts(){return inserts;},get stock(){return stock;}};
}
function body(overrides:any={}){return {checkoutContext:randomUUID(),addressVersion:1,fulfillmentType:'pickup',name:'Synthetic Customer',phone:'03000000000',address:'House 14 Street 5 Gulraiz Rawalpindi',email:'synthetic@example.test',deliveryDate:upcomingDeliveryDays()[0].value,deliverySlot:'Morning',cartItems:[{id:'1',quantity:2,price:.01,name:'Manipulated'}],subtotal:.02,deliveryCharges:0,discount:999,total:0,status:'Delivered',paymentStatus:'paid',...overrides};}
const dependencies=(repo:CommerceRepository)=>({repository:repo,catalog:async()=>[product],quote:async(input:any)=>verifyDeliveryQuote(input.quoteToken,input.address,settings,{checkoutContext:input.checkoutContext,addressVersion:input.addressVersion})});
test('trusted catalog rebuilds price, name, total and unpaid order state',async()=>{
 const r=repository(),input=body(),result=await checkout(input,input.checkoutContext,dependencies(r.repo));
 assert.equal(result.order.subtotal,340);assert.equal(result.order.total,340);assert.equal(result.order.discount,0);assert.equal(result.order.items[0].price,170);assert.equal(result.order.items[0].name,'Synthetic Atta');assert.equal(result.order.paymentStatus,'unpaid');assert.equal(result.order.status,'Order Placed');assert.equal(r.stock,8);
});
test('concurrent retries return one order/token and inventory decrement through atomic repository contract',async()=>{
 const r=repository(),input=body(),results=await Promise.all(Array.from({length:5},()=>checkout(input,input.checkoutContext,dependencies(r.repo))));
 const renewed=await checkout({...input,addressVersion:input.addressVersion+1},input.checkoutContext,dependencies(r.repo));assert.equal(renewed.orderId,results[0].orderId);
 assert.equal(r.inserts,1);assert.equal(r.stock,8);assert.equal(new Set(results.map(r=>r.orderId)).size,1);assert.equal(new Set(results.map(r=>r.orderAccessToken)).size,1);
 await assert.rejects(checkout({...input,name:'Different Customer'},input.checkoutContext,dependencies(r.repo)),(e:any)=>e.code==='IDEMPOTENCY_CONFLICT');
});
test('stock changes at persistence do not return a successful order',async()=>{
 const r=repository();for(let i=0;i<5;i++){const input=body();await checkout(input,input.checkoutContext,dependencies(r.repo));}
 const input=body();await assert.rejects(checkout(input,input.checkoutContext,dependencies(r.repo)),(e:any)=>e.code==='STOCK_CHANGED');assert.equal(r.inserts,5);
});
test('delivery checkout rejects missing/tampered/expired quotes and preserves original address separately',async()=>{
 const r=repository(),input=body({fulfillmentType:'delivery'});const claims={latitude:33.56,longitude:73.1,distanceKm:5.25675,deliveryCharge:263,type:'pin',matchedAddress:'Customer-confirmed map pin'};
 await assert.rejects(checkout(input,input.checkoutContext,dependencies(r.repo)),/Calculate delivery/);
 input.deliveryQuoteToken=signDeliveryQuote(claims,input.address,settings,Date.now()-601000,input);await assert.rejects(checkout(input,input.checkoutContext,dependencies(r.repo)),/calculate delivery/);
 input.deliveryQuoteToken=signDeliveryQuote(claims,input.address,settings,Date.now(),input)+'x';await assert.rejects(checkout(input,input.checkoutContext,dependencies(r.repo)),/calculate delivery/);
 input.deliveryQuoteToken=signDeliveryQuote(claims,input.address,settings,Date.now(),input);const result=await checkout(input,input.checkoutContext,dependencies(r.repo));
 assert.equal(result.order.total,603);assert.equal(result.order.customer.address,input.address);assert.equal(result.order.deliveryDetails.matchedAddress,claims.matchedAddress);
});
test('order access tokens isolate customers; order ID and phone never authorize reads',async()=>{
 const r=repository(),a=body(),b=body(),first=await checkout(a,a.checkoutContext,dependencies(r.repo)),second=await checkout(b,b.checkoutContext,dependencies(r.repo));
 assert.equal((await authorizeOrder(r.repo,first.orderId.toUpperCase(),first.orderAccessToken)).id,first.orderId);
 await assert.rejects(authorizeOrder(r.repo,first.orderId,a.phone),/private order link/);
 await assert.rejects(authorizeOrder(r.repo,second.orderId,first.orderAccessToken),/could not be verified/);
 r.rows.get(first.orderId)!.access_expires_at=new Date(0).toISOString();await assert.rejects(authorizeOrder(r.repo,first.orderId,first.orderAccessToken),/could not be verified/);
});
test('review qualification comes from a completed owned order and submissions stay pending',()=>{
 const data={name:'Synthetic Reviewer',rating:5,review:'Synthetic review fixture text',verifiedPurchase:true,status:'approved'};
 assert.equal(parseReview(data).verified_purchase,false);assert.equal(parseReview(data).status,'pending');
 const order={id:'test',document:{status:'Delivered'}} as StoredOrder;assert.equal(parseReview(data,order).verified_purchase,true);
 assert.equal(parseReview(data,{...order,document:{status:'Order Placed'}}).verified_purchase,false);
 for(const invalid of [{rating:0},{review:'short'},{review:'Visit https://spam.example.test'}])assert.throws(()=>parseReview({...data,...invalid}));
});
test('public HTTP operations deny removed admin routes, isolate tracking and restrict receipt recipients',async()=>{
 const r=repository(),input=body(),created=await checkout(input,input.checkoutContext,dependencies(r.repo));let sent=0;
 const app=createApplication({repository:r.repo,catalog:async()=>[product],settings:async()=>settings,rateStore:memoryRateStore(),production:false,sendReceipt:async()=>{sent++;return {delivered:true};}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as any).port;
 const headers={'Content-Type':'application/json','X-Order-Access-Token':created.orderAccessToken};
 try{
  for(const url of ['/api/admin/products','/api/admin/delivery-areas','/api/email/status','/api/notifications/order-sms'])assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base+'/api/order/'+created.orderId+'?phone='+input.phone)).status,401);
  assert.equal((await fetch(base+'/api/order/'+created.orderId,{headers})).status,200);
  const html=await (await fetch(base+'/api/order/'+created.orderId+'/receipt-html',{headers})).text();assert.match(html,/#access=/);
  assert.equal((await fetch(base+'/api/order/send-receipt',{method:'POST',headers,body:JSON.stringify({orderId:created.orderId,email:'recipient@example.test'})})).status,400);assert.equal(sent,0);
  assert.equal((await fetch(base+'/api/order/send-receipt',{method:'POST',headers,body:JSON.stringify({orderId:created.orderId})})).status,200);assert.equal(sent,1);
  assert.equal((await fetch(base+'/api/order/send-receipt',{method:'POST',headers,body:JSON.stringify({orderId:created.orderId})})).status,429);
  const missingContext=await fetch(base+'/api/delivery/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:input.address})});assert.equal(missingContext.status,400);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
import {databaseCommerceRepository} from '../api/commerce.js';
test('missing database tables/functions report setup failure separately from transient storage errors',async()=>{
 for(const code of ['42P01','42883','PGRST202','PGRST205','08006']){
  const db={from(){return {select(){return this;},eq(){return this;},maybeSingle(){return this;},async abortSignal(){return {data:null,error:{code}};}};}};
  await assert.rejects(databaseCommerceRepository(db).findRetry('synthetic','key'),(e:any)=>e.code===(code==='08006'?'DATABASE_UNAVAILABLE':'DATABASE_SETUP_REQUIRED'));
 }
});

test('HTTP checkout sends staff alerts after persistence and tolerates ntfy failure',async()=>{
 const r=repository();let calls=0;
 const app=createApplication({repository:r.repo,catalog:async()=>[product],rateStore:memoryRateStore(),production:false,
  staffDispatch:async id=>{calls++;assert.ok(id&&r.rows.has(id));throw Error('Synthetic ntfy outage');}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const input=body(),headers={'Content-Type':'application/json','Idempotency-Key':input.checkoutContext};
 try{
  const first=await fetch(base+'/api/checkout',{method:'POST',headers,body:JSON.stringify(input)});assert.equal(first.status,200);
  const saved=await first.json();assert.ok(saved.orderId);assert.equal(calls,1);
  const retry=await fetch(base+'/api/checkout',{method:'POST',headers,body:JSON.stringify(input)});assert.equal(retry.status,200);
  assert.equal((await retry.json()).orderId,saved.orderId);assert.equal(r.inserts,1);
  const invalid=body({cartItems:[{id:'missing',quantity:1}]});const before=calls;
  const failed=await fetch(base+'/api/checkout',{method:'POST',headers:{...headers,'Idempotency-Key':invalid.checkoutContext},body:JSON.stringify(invalid)});
  assert.notEqual(failed.status,200);assert.equal(calls,before);
  assert.equal((await fetch(base+'/api/internal/order-alerts')).status,401);assert.equal(calls,before);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
