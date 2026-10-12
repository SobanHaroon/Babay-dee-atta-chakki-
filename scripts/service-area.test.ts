import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeliveryQuote,verifyDeliveryQuote} from '../api/addressDelivery.js';
const settings={storeLatitude:33.567341,storeLongitude:73.1044791,pricePerKm:50,minDeliveryFee:50,maxDeliveryDistanceKm:30,serviceAreas:['Rawalpindi','Islamabad']};
const context={checkoutContext:'11111111-1111-4111-8111-111111111111',addressVersion:1,confirmedPin:{latitude:33.58,longitude:73.1}};
test('owner service areas are verified from the pin, bound into quotes and limited to 30 road kilometres',async()=>{
 const originalFetch=globalThis.fetch;const oldKey=process.env.GEOAPIFY_API_KEY;process.env.GEOAPIFY_API_KEY='synthetic';
 let area:any={country_code:'pk',city:'Rawalpindi'},distance=30000;const calls:string[]=[];
 globalThis.fetch=async(input:any)=>{const u=new URL(input);calls.push(u.pathname);if(u.pathname.endsWith('/reverse')){
  assert.equal(u.searchParams.get('lat'),String(context.confirmedPin.latitude));assert.equal(u.searchParams.get('lon'),String(context.confirmedPin.longitude));assert.equal(u.searchParams.get('type'),'city');
  return new Response(JSON.stringify({results:area?[area]:[]}));
 }return new Response(JSON.stringify({features:[{properties:{distance,time:500,distance_units:'meters'}}]}));};
 try{
  const quote:any=await createDeliveryQuote('Synthetic house and street',settings,'',context);assert.equal(quote.deliveryCharge,1500);assert.equal(quote.distanceKm,30);assert.equal(quote.serviceArea,'Rawalpindi');
  assert.equal(verifyDeliveryQuote(quote.quoteToken,'Synthetic house and street',settings,context).serviceArea,'Rawalpindi');
  assert.throws(()=>verifyDeliveryQuote(quote.quoteToken,'Synthetic house and street',{...settings,serviceAreas:['Islamabad']},context));
  distance=30001;await assert.rejects(createDeliveryQuote('Synthetic house and street',settings,'',context),(e:any)=>e.code==='DISTANCE_LIMIT');
  area={country_code:'pk',state:'Islamabad Capital Territory'};distance=200;const nearby:any=await createDeliveryQuote('Different house instructions',settings,'',context);assert.equal(nearby.deliveryCharge,50);
  const routeCalls=calls.filter(x=>x.endsWith('/routing')).length;
  for(const denied of [{country_code:'pk',city:'Lahore'},{country_code:'us',city:'Rawalpindi'}]){area=denied;await assert.rejects(createDeliveryQuote('Synthetic house and street',settings,'',context),(e:any)=>e.code==='OUT_OF_AREA');}
  assert.equal(calls.filter(x=>x.endsWith('/routing')).length,routeCalls);
  area=null;await assert.rejects(createDeliveryQuote('Synthetic house and street',settings,'',context),(e:any)=>e.code==='SERVICE_AREA_UNVERIFIED');
 }finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.GEOAPIFY_API_KEY;else process.env.GEOAPIFY_API_KEY=oldKey;}
});
