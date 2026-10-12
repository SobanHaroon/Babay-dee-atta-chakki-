import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogLoader} from '../api/catalogRepository.js';
import {databaseClients} from '../api/database.js';
import {createApplication} from '../api/index.js';
const row={id:'1','product name':'Synthetic Atta',price:170,quantity:'00000'};
function database(available:string[],rows:any[]=[row],failure?:any){
  const calls:string[]=[];
  const db={from(table:string){assert.equal(table,'products');return {select(columns:string){calls.push(columns);const selected=columns.split(',').map(x=>x.replaceAll('"',''));return {order(){return this;},limit(){return this;},async abortSignal(){const missing=selected.find(x=>!available.includes(x));return failure?{data:null,error:failure}:missing?{data:null,error:{code:'42703',message:`column products.${missing} does not exist`}}:{data:rows.map(r=>Object.fromEntries(selected.map(k=>[k,r[k]]))),error:null};}};}};}};
  return {db,calls};
}
const base=['id','product name','price','quantity','place','Product Category','Product Images'];
const full=[...base,'sale_unit','stock_quantity','pack_weight_kg','variant_label'];
test('legacy schema applies owner-confirmed kg units and caches only column compatibility',async()=>{
  const d=database(base);const load=createCatalogLoader(d.db);const products=await load();assert.equal(products.length,1);assert.equal(products[0].name,'Synthetic Atta');assert.equal(products[0].purchasable,false);assert.equal(products[0].unit,'Kg');assert.equal(d.calls.length,5);
  row.price=180;assert.equal((await load())[0].price,180);row.price=170;assert.equal(d.calls.length,6);assert.ok(d.calls.every(c=>!c.includes('*')));
});
test('partial migration preserves explicitly recorded sale units and stock',async()=>{
  const d=database(full.filter(c=>c!=='variant_label'),[{...row,sale_unit:'kg',stock_quantity:20}]);const products=await createCatalogLoader(d.db)();assert.equal(products[0].purchasable,true);assert.equal(products[0].unit,'Kg');assert.equal(d.calls.length,2);
});
test('missing required columns and permission errors never become empty success or schema bypass',async()=>{
  for(const failure of [{code:'42501',message:'permission denied'},{code:'42703',message:'column products.price does not exist'},{code:'PGRST301',message:'invalid credential'}]){
    const d=database(base,[row],failure);await assert.rejects(createCatalogLoader(d.db)(),(e:any)=>e.code==='CATALOG_UNAVAILABLE');assert.equal(d.calls.length,1);
  }
  await assert.rejects(createCatalogLoader(null)(),(e:any)=>e.code==='CATALOG_CONFIGURATION');
});
test('empty database is a valid empty catalog and schema cache errors only drop allowlisted fields',async()=>{
  assert.deepEqual(await createCatalogLoader(database(full,[]).db)(),[]);
  const d=database(full);const original=d.db.from;let first=true;d.db.from=(table)=>{if(!first)return original(table);first=false;return {select(){return {order(){return this;},limit(){return this;},async abortSignal(){return {data:null,error:{code:'PGRST204',message:"Could not find the 'variant_label' column of 'products' in the schema cache"}};}};}};};
  assert.equal((await createCatalogLoader(d.db)()).length,1);
});
test('legacy public configuration aliases work without turning a public key into a privileged client',()=>{
  const clients=databaseClients({VITE_SUPABASE_URL:' https://example.supabase.co ',VITE_SUPABASE_ANON_KEY:'synthetic-public-key'});assert.ok(clients.catalog);assert.equal(clients.privileged,null);
  assert.equal(databaseClients({SUPABASE_URL:'bad-url',SUPABASE_SECRET_KEY:'synthetic-private-key'}).privileged,null);
});
test('catalog and health remain available without commerce rate RPC while protected endpoints fail closed',async()=>{
  let rateCalls=0;const app=createApplication({production:true,catalog:async()=>[{id:'1',name:'Synthetic Atta',price:170}],rateStore:{async consume(){rateCalls++;throw Error('Missing rate RPC');}}});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as any).port}`;
  try{for(const path of ['/api/health','/api/categories','/api/products','/api/product/1'])assert.equal((await fetch(url+path)).status,200,path);assert.equal(rateCalls,0);
    assert.equal((await fetch(url+'/api/delivery/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
    assert.equal((await fetch(url+'/api/order/BDEC-test')).status,503);
    assert.equal((await fetch(url+'/api/products',{headers:{origin:'https://evil.example'}})).status,403);
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
