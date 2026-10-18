import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import express from 'express';
import {installSecurity,databaseRateStore} from '../server/security.js';

test('Vercel deploys one function; helper modules are outside the API directory',async()=>{
 assert.deepEqual((await readdir('api')).sort(),['index.ts']);
 const config=JSON.parse(await readFile('vercel.json','utf8'));assert.deepEqual(Object.keys(config.functions),['api/index.ts']);
 const {default:app}=await import('../api/index.js');assert.equal(typeof app,'function');
});
test('production middleware reports missing signing configuration, and uses the database limiter when configured',async()=>{
 const saved={RATE_LIMIT_SECRET:process.env.RATE_LIMIT_SECRET,ORDER_ACCESS_SECRET:process.env.ORDER_ACCESS_SECRET};
 const logs:string[]=[];const warn=console.warn;console.warn=(value)=>logs.push(String(value));
 let calls=0;const db={rpc(name:string,args:any){assert.equal(name,'consume_api_rate_limit');assert.equal(args.p_limit,8);calls++;return {abortSignal:async()=>({data:{allowed:true,retry_after:60},error:null})};}};
 const app=express();installSecurity(app,{production:true,rateStore:databaseRateStore(db)});app.post('/api/checkout',(_req,res)=>res.status(400).json({code:'VALIDATION_REACHED'}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port+'/api/checkout';
 try{
  delete process.env.RATE_LIMIT_SECRET;delete process.env.ORDER_ACCESS_SECRET;
  const blocked=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,503);assert.equal(calls,0);assert.match(logs.join(''),/RATE_LIMIT_CONFIGURATION/);
  process.env.RATE_LIMIT_SECRET='synthetic-production-rate-secret-at-least-32-characters';
  const allowed=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(allowed.status,400);assert.equal(calls,1);
  assert.doesNotMatch(logs.join(''),/synthetic-production-rate-secret/);
 }finally{
  console.warn=warn;for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await new Promise<void>(r=>server.close(()=>r()));
 }
});
