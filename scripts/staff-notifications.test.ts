import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseStaffQueue,formatStaffOrder,dispatchStaffNotification,staffNotificationsEnabled,validWorkerAuthorization,type StaffQueue} from '../server/staffNotifications.js';

const env={ENABLE_STAFF_NOTIFICATIONS:'true',NTFY_TOPIC:'synthetic_topic',NTFY_ACCESS_TOKEN:'synthetic-secret',APP_ENV:'development'};
const job={orderId:'BDEC-synthetic',legacyOrderId:123456,leaseToken:'synthetic-lease',total:600,fulfillmentType:'delivery',deliveryDate:'2026-10-20',deliverySlot:'Morning',details:{customer:{name:'Synthetic Customer',phone:'03000000000',email:'synthetic@example.test',address:'House 14, Street 5, Gulraiz Rawalpindi'},items:[{name:'Chakki Atta',quantity:1,unit:'Kg',price:180},{name:'Mota Atta',quantity:2,unit:'Kg',price:180}],subtotal:540,deliveryCharges:60,discount:0}};
function queue(){let sent=false;const errors:(string|null)[]=[];return {errors,queue:{async claim(){return sent?null:job;},async finish(_job:any,error:string|null){errors.push(error);sent=!error;return true;}} satisfies StaffQueue};}
test('ntfy includes every requested customer, item and pricing field; a completed job is not resent',async()=>{
 const q=queue();let requests=0;
 const fetcher:typeof fetch=async(url,init)=>{
  requests++;assert.equal(String(url),'https://ntfy.sh/');assert.equal(init?.redirect,'error');
  assert.equal((init?.headers as any).Authorization,'Bearer synthetic-secret');
  const payload=JSON.parse(String(init?.body));assert.equal(payload.topic,'synthetic_topic');assert.match(payload.title,/123456/);assert.match(payload.message,/Rs. 600/);
  for(const expected of ['Customer: Synthetic Customer','Phone: 03000000000','Email: synthetic@example.test','Address: House 14, Street 5, Gulraiz Rawalpindi','Fulfillment: Delivery','1. Chakki Atta — 1 Kg × Rs. 180 = Rs. 180','2. Mota Atta — 2 Kg × Rs. 180 = Rs. 360','subtotal): Rs. 540','Delivery charges: Rs. 60','Order total: Rs. 600'])assert.ok(payload.message.includes(expected),expected);
  assert.doesNotMatch(payload.message,/access=|synthetic-lease|synthetic-secret/);
  return new Response('{}',{status:200});
 };
 assert.equal(await dispatchStaffNotification(q.queue,{env,fetcher}),'sent');
 assert.equal(await dispatchStaffNotification(q.queue,{env,fetcher}),'empty');assert.equal(requests,1);assert.deepEqual(q.errors,[null]);
});
test('ntfy HTTP failures and timeouts stay retryable with redacted diagnostics',async()=>{
 for(const status of [401,403,429,500,503,0]){
  const q=queue(),logs:any[]=[];
  const fetcher:typeof fetch=async()=>{if(!status)throw new DOMException('private URL with token','TimeoutError');return new Response('private provider body',{status});};
  assert.equal(await dispatchStaffNotification(q.queue,{env,fetcher,log:data=>logs.push(data)}),'deferred');
  assert.deepEqual(q.errors,[status?`NTFY_HTTP_${status}`:'NTFY_NETWORK_OR_TIMEOUT']);
  assert.doesNotMatch(JSON.stringify(logs),/private|synthetic-secret|synthetic_topic|Synthetic Customer|03000000000|Gulraiz/);
  assert.equal(await dispatchStaffNotification(q.queue,{env,fetcher:async()=>new Response('{}')}),'sent');
 }
});
test('staff alerts require explicit opt in and are disabled in tests, staging and previews',async()=>{
 for(const overrides of [{ENABLE_STAFF_NOTIFICATIONS:'false'},{NTFY_TOPIC:''},{NODE_ENV:'test'},{APP_ENV:'test'},{APP_ENV:'staging'},{VERCEL:'1',VERCEL_ENV:'preview'}]){
  const blocked={...env,...overrides};assert.equal(staffNotificationsEnabled(blocked),false);
  assert.equal(await dispatchStaffNotification({claim:async()=>{throw Error('must not claim');},finish:async()=>false},{env:blocked}),'disabled');
 }
 assert.equal(staffNotificationsEnabled(env),true);
});
test('retry worker uses a server secret and rejects missing/wrong authorization',()=>{
 const secret='s'.repeat(48),config={CRON_SECRET:secret};
 assert.equal(validWorkerAuthorization(undefined,config),false);assert.equal(validWorkerAuthorization('Bearer wrong',config),false);
 assert.equal(validWorkerAuthorization('Bearer '+secret,config),true);assert.equal(validWorkerAuthorization('Bearer short',{CRON_SECRET:'short'}),false);
});
test('queue failures do not turn a committed checkout into a failed order',async()=>{
 const result=await dispatchStaffNotification({claim:async()=>{throw Error('private database detail');},finish:async()=>false},{env,log:()=>{}});
 assert.equal(result,'deferred');
});

test('pickup, missing email and fractional kilogram items have clear complete labels',()=>{
 const pickup=structuredClone(job);pickup.fulfillmentType='pickup';pickup.details.customer.email='';pickup.details.customer.address='';pickup.details.deliveryCharges=0;pickup.total=540;
 pickup.details.items=[{name:'Fine flour',quantity:1.5,unit:'Kg',price:360}];
 const text=formatStaffOrder(pickup).join('\n');
 assert.match(text,/Fulfillment: Store pickup/);assert.match(text,/Email: Not provided/);assert.match(text,/no delivery address/);
 assert.match(text,/1.5 Kg × Rs. 360 = Rs. 540/);assert.match(text,/Delivery charges: Rs. 0/);assert.match(text,/Order total: Rs. 540/);
});
test('long multilingual orders preserve every item in numbered messages below the UTF-8 byte limit',async()=>{
 const big=structuredClone(job);big.details.items=Array.from({length:50},(_,i)=>({name:'Item '+i+' گندم آٹا 🌾 '.repeat(12),quantity:1,unit:'Kg',price:10}));big.details.subtotal=500;big.total=560;
 const parts=formatStaffOrder(big);assert.ok(parts.length>1);
 for(const [i,part]of parts.entries()){assert.ok(Buffer.byteLength(part)<=4096);assert.match(part,new RegExp('part '+(i+1)+'/'+parts.length));assert.doesNotMatch(part,/\uFFFD/);}
 for(const item of big.details.items)assert.ok(parts.join('\n').includes(item.name));
 let calls=0,acknowledged=false;
 const q:StaffQueue={claim:async()=>big,finish:async(_j,error)=>{assert.equal(error,null);assert.equal(calls,parts.length);acknowledged=true;return true;}};
 assert.equal(await dispatchStaffNotification(q,{env,fetcher:async(_u,init)=>{const payload=JSON.parse(String(init?.body));assert.equal(payload.message,parts[calls++]);return new Response('{}');}}),'sent');
 assert.equal(acknowledged,true);
});
test('partial multipart failure leaves the order alert retryable rather than marking it sent',async()=>{
 const big=structuredClone(job);big.details.items=Array.from({length:50},(_,i)=>({name:'Item '+i+' X'.repeat(120),quantity:1,unit:'Kg',price:10}));big.details.subtotal=500;big.total=560;
 let calls=0;const errors:any[]=[];
 const q:StaffQueue={claim:async()=>big,finish:async(_j,error)=>{errors.push(error);return true;}};
 assert.equal(await dispatchStaffNotification(q,{env,fetcher:async()=>new Response('{}',{status:++calls===2?503:200}),log:()=>{}}),'deferred');
 assert.equal(calls,2);assert.deepEqual(errors,['NTFY_HTTP_503']);
});
test('server queue loads persisted details and excludes tracking tokens and internal fields',async()=>{
 const rpcCalls:any[]=[];const db={rpc(name:string,args:any){rpcCalls.push({name,args});return {abortSignal:async()=>({data:{...job,details:undefined},error:null})};},
 from(table:string){assert.equal(table,'secure_orders');return {select(columns:string){assert.equal(columns,'document');return {eq(field:string,id:string){assert.equal(field,'id');assert.equal(id,job.orderId);return {single(){return {abortSignal:async()=>({data:{document:{...job.details,orderAccessToken:'private-tracking-token',secret:'internal'}},error:null})};}};}};}};}};
 const result=await databaseStaffQueue(db).claim(job.orderId);assert.deepEqual(result?.details,job.details);
 assert.doesNotMatch(JSON.stringify(result),/private-tracking-token|internal/);assert.equal(rpcCalls[0].name,'claim_staff_notification');
});
test('missing persisted details release the lease as a retryable failure without publishing',async()=>{
 const rpcCalls:any[]=[];const db={rpc(name:string,args:any){rpcCalls.push({name,args});return {abortSignal:async()=>({data:name==='claim_staff_notification'?job:true,error:null})};},
 from(){return {select(){return {eq(){return {single(){return {abortSignal:async()=>({data:null,error:{code:'synthetic'}})};}};}};}};}};
 await assert.rejects(databaseStaffQueue(db).claim(job.orderId),/ORDER_DETAILS_UNAVAILABLE/);
 assert.equal(rpcCalls[1].name,'finish_staff_notification');assert.equal(rpcCalls[1].args.p_error,'ORDER_DETAILS_UNAVAILABLE');
});
test('invalid order details cannot send an incomplete or inconsistent receipt',async()=>{
 const invalid={...job,details:undefined};let published=false;const errors:any[]=[];
 assert.equal(await dispatchStaffNotification({claim:async()=>invalid,finish:async(_j,error)=>{errors.push(error);return true;}},{env,fetcher:async()=>{published=true;return new Response('{}');},log:()=>{}}),'deferred');
 assert.equal(published,false);assert.deepEqual(errors,['INVALID_ORDER_DETAILS']);
});
