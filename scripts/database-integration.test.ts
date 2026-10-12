import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {checkout,authorizeOrder,databaseCommerceRepository} from '../api/commerce.js';
import {normalizeCatalog} from '../api/catalog.js';
import {upcomingDeliveryDays} from '../src/lib/commerce.js';

process.env.ORDER_ACCESS_SECRET='synthetic-postgres-test-secret-at-least-32-characters';
const migrations=['scripts/20261002_catalog_access.sql','scripts/20261002_secure_commerce.sql','scripts/20261011_confirm_kg_catalog.sql'];

test('real PostgreSQL migrations, checkout persistence, atomic stock, retries and table isolation', async t=>{
 const db=new PGlite();
 const query=(sql:string,args:any[]=[])=>db.query<any>(sql,args);
 const scalar=async(sql:string,args:any[]=[])=>Object.values((await query(sql,args)).rows[0])[0];
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table products(id bigint primary key,"product name" text,price text,quantity text);
    create table delivery_location(id bigint primary key,address text);
    grant select on delivery_location to anon;
    insert into products values(1,'Synthetic Atta','180','100000'),(2,'Synthetic Besan','380','0'),(3,'Synthetic Pack','500','2');`);
  for(const file of migrations)await db.exec(await readFile(file,'utf8'));
  await t.test('legacy stock backfill has the confirmed scale, preserves zero and supports future pack metadata',async()=>{
   assert.equal(await scalar('select stock_quantity::float8 from products where id=1'),10000);
   assert.equal(await scalar('select stock_quantity::float8 from products where id=2'),0);
   await query("update products set sale_unit='pack',stock_quantity=2,pack_weight_kg=1 where id=3");
  });
  const client={
   from(table:string){return {select(_columns:string){let field='',value:any;return {eq(f:string,v:any){field=f;value=v;return this;},maybeSingle(){return this;},async abortSignal(){
    assert.equal(table,'secure_orders');assert.ok(['checkout_context','id'].includes(field));
    return {data:(await query(`select * from secure_orders where ${field}=$1`,[value])).rows[0]||null,error:null};
   }};}};},
   rpc(name:string,args:any){return {async abortSignal(){assert.equal(name,'place_secure_order');try{return {data:await scalar('select place_secure_order($1::jsonb)',[JSON.stringify(args.p_order)]),error:null};}catch(e:any){return {data:null,error:{code:e.code,message:e.message}};}}};}
  };
  const repository=databaseCommerceRepository(client);
  const deps={repository,catalog:async()=>normalizeCatalog((await query('select * from products')).rows),quote:async()=>{throw Error('Pickup fixture must not request a route');}};
  const input=()=>({checkoutContext:randomUUID(),addressVersion:1,fulfillmentType:'pickup',name:'Synthetic Customer',phone:'03000000000',deliveryDate:upcomingDeliveryDays()[0].value,deliverySlot:'Morning',cartItems:[{id:'1',quantity:1.5,price:.01}],total:.01,discount:500,paymentStatus:'paid'});
  const body=input();let order:any;
  await db.exec('set role service_role');
  await t.test('checkout uses actual SQL, rebuilds totals, persists unpaid state and deducts kilograms',async()=>{
   order=await checkout(body,body.checkoutContext,deps);
   assert.equal(order.order.total,270);assert.equal(order.order.discount,0);assert.equal(order.order.paymentStatus,'unpaid');
   assert.equal(await scalar('select stock_quantity::float8 from products where id=1'),9998.5);
   assert.equal(Number(await scalar('select quantity from products where id=1')),99985);
   assert.equal(await scalar('select count(*)::int from secure_orders'),1);
   assert.equal((await authorizeOrder(repository,order.orderId,order.orderAccessToken)).id,order.orderId);
   await assert.rejects(authorizeOrder(repository,order.orderId,'x'.repeat(43)),/could not be verified/);
  });
  await t.test('retries produce one order and one inventory deduction',async()=>{
   const results=await Promise.all(Array.from({length:4},()=>checkout(body,body.checkoutContext,deps)));
   assert.ok(results.every(r=>r.orderId===order.orderId&&!r.created));
   assert.equal(await scalar('select count(*)::int from secure_orders'),1);
   assert.equal(await scalar('select stock_quantity::float8 from products where id=1'),9998.5);
   await assert.rejects(checkout({...body,name:'Other Synthetic Customer'},body.checkoutContext,deps),(e:any)=>e.code==='IDEMPOTENCY_CONFLICT');
  });
  const record=async(items:any[])=>({...(await repository.findOrder(order.orderId))!,id:'BDEC-'+randomUUID().replaceAll('-',''),checkout_context:randomUUID(),document:{...order.order,items}});
  await t.test('stock change in a later bundle item rolls back every deduction and order insert',async()=>{
   const r=await record([{id:'1',quantity:2,price:180},{id:'2',quantity:1,price:380}]);
   await assert.rejects(repository.place(r),(e:any)=>e.code==='STOCK_CHANGED');
   assert.equal(await scalar('select stock_quantity::float8 from products where id=1'),9998.5);
   assert.equal(await scalar('select count(*)::int from secure_orders'),1);
  });
  await t.test('database rejects stale prices, absent quantity and fractional packs without changing stock',async()=>{
   for(const [item,code] of [[{id:'1',quantity:1,price:1},'PRICE_CHANGED'],[{id:'1',price:180},'STOCK_CHANGED'],[{id:'3',quantity:.5,price:500},'STOCK_CHANGED'],[{id:'1',quantity:.15,price:180},'STOCK_CHANGED']] as const){
    await assert.rejects(repository.place(await record([item])),(e:any)=>e.code===code);
   }
   assert.equal(await scalar('select count(*)::int from secure_orders'),1);
  });
  await t.test('inventory edits synchronize in both directions and conflicting changes are rejected',async()=>{
   await query("update products set quantity='150' where id=2");assert.equal(await scalar('select stock_quantity::float8 from products where id=2'),15);
   await query('update products set stock_quantity=12.5 where id=2');assert.equal(Number(await scalar('select quantity from products where id=2')),125);
   await assert.rejects(query("update products set quantity='200',stock_quantity=19 where id=2"),/CONFLICTING_INVENTORY/);
   await assert.rejects(query("update products set quantity='garbage' where id=2"),/INVALID_INVENTORY/);
  });
  await t.test('database receipt claims and shared request limits are enforced',async()=>{
   assert.equal(await scalar('select claim_order_receipt($1)',[order.orderId]),true);
   assert.equal(await scalar('select claim_order_receipt($1)',[order.orderId]),false);
   for(let i=0;i<3;i++)assert.equal((await scalar("select consume_api_rate_limit('synthetic',2,60)") as any).allowed,i<2);
  });
  await db.exec('reset role');
  await t.test('repeat migrations preserve orders and already-decremented stock',async()=>{
   for(const file of migrations)await db.exec(await readFile(file,'utf8'));
   assert.equal(await scalar('select stock_quantity::float8 from products where id=1'),9998.5);
   assert.equal(await scalar('select count(*)::int from secure_orders'),1);
  });
  await t.test('anonymous and authenticated roles cannot read customer data, mutate catalog or call order RPCs',async()=>{
   for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role}`);
    for(const sql of ['select * from secure_orders','select * from delivery_location','select * from customer_reviews','update products set price=\'1\'','delete from products',"select place_secure_order('{}'::jsonb)","select claim_order_receipt('id')","select consume_api_rate_limit('key',1,60)"]){await assert.rejects(query(sql),(e:any)=>e.code==='42501');}
    await db.exec('reset role');
   }
  });
 }finally{await db.close();}
});
