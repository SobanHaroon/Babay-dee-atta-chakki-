import test from 'node:test';
import assert from 'node:assert/strict';
import {getDeliverySettings} from '../api/deliverySettings.js';
const keys=['NODE_ENV','STORE_LATITUDE','STORE_LONGITUDE','DELIVERY_RATE_PER_KM','DELIVERY_MAX_DISTANCE_KM','DELIVERY_MIN_FEE','DELIVERY_SERVICE_BOUNDS','DELIVERY_SERVICE_AREAS'];
function isolated(fn:()=>Promise<void>){return async()=>{const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));keys.forEach(k=>delete process.env[k]);process.env.NODE_ENV='test';try{await fn();}finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}};}
function database(responses:any[]){const calls:string[]=[];return {calls,client:{from(table:string){assert.equal(table,'delivery_settings');return {select(columns:string){calls.push(columns);return {limit(){return this;},async abortSignal(){return responses.shift();}};}};}}};}
const row={store_latitude:'33.5',store_longitude:'73.1',price_per_km:50,max_delivery_distance_km:45,store_name:'Synthetic Store'};
test('delivery settings use actual legacy column aliases and retain a configured zero minimum',isolated(async()=>{
 const db=database([{error:{code:'42703'}},{data:[{...row,minimum_delivery_charge:0}]}]);const settings=await getDeliverySettings(db.client);
 assert.equal(settings.storeLatitude,33.5);assert.equal(settings.storeLongitude,73.1);assert.equal(settings.minDeliveryFee,0);assert.match(db.calls[1],/store_latitude:"store latitude"/);assert.equal(db.calls.length,2);
}));
test('empty settings and permission failures never invent a store location',isolated(async()=>{
 for(const response of [{data:[]},{error:{code:'42501'}}]){const db=database([response]);await assert.rejects(getDeliverySettings(db.client),(e:any)=>e.code==='DELIVERY_CONFIGURATION');assert.equal(db.calls.length,1);}
}));
test('trusted environment settings preserve existing rate and limit; production requires service bounds',isolated(async()=>{
 Object.assign(process.env,{STORE_LATITUDE:'33.5',STORE_LONGITUDE:'73.1',DELIVERY_RATE_PER_KM:'50',DELIVERY_MAX_DISTANCE_KM:'45',DELIVERY_MIN_FEE:'50',NODE_ENV:'production'});
 await assert.rejects(getDeliverySettings(),(e:any)=>e.code==='DELIVERY_CONFIGURATION');process.env.DELIVERY_SERVICE_BOUNDS='33,72,34,74';
 const settings=await getDeliverySettings();assert.equal(settings.pricePerKm,50);assert.equal(settings.maxDeliveryDistanceKm,45);assert.equal(settings.minDeliveryFee,50);
 process.env.DELIVERY_SERVICE_BOUNDS='34,72,35,74';await assert.rejects(getDeliverySettings(),(e:any)=>e.code==='DELIVERY_CONFIGURATION');
}));
