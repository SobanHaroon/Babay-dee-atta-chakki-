import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolveDeliveryCandidates,createDeliveryQuote,clearAddressCache,deliverySearchSequence} from '../api/addressDelivery.js';
import {randomUUID} from 'node:crypto';
// Synthetic fixtures only: this script never creates an order or sends a notification.
const fixtures=[
 'House 14, Street 5, Gulraiz Phase 3, Rawalpindi',
 'House 14, Street 5, Sector C, Bahria Town Phase 8, Rawalpindi',
 'Bahria Town Phase 8, Rawalpindi',
 'House 14, Street 5, Sector G-13/1, Islamabad',
 'plaza 47 jinnah bolevard sector E DHA 2 islamabad',
 'Flat 4 Street 9 Sector F-10/2 Islamabad',
 'Plot 20 Street 4 Soan Garden Islamabad',
 'House 10 Saidpur Road Satellite Town Rawalpindi',
 'مکان ۱۴ گلی ۵ گلریز فیز ۳ راولپنڈی',
 'House 99 Street 999 Imaginary Sector ZZZ Rawalpindi'
];
const key=process.env.GEOAPIFY_GEOCODING_KEY||process.env.GEOAPIFY_API_KEY;
if(!key)throw new Error('A private Geoapify key is required.');
// Existing published coordinates and rates used as test fixtures only; physical store pin unverified.
const settings={storeLatitude:33.567348,storeLongitude:73.10451,pricePerKm:50,minDeliveryFee:50,maxDeliveryDistanceKm:45,serviceRegion:{south:33.3,west:72.8,north:33.9,east:73.5}};
const results=[];
for(const [index,address] of fixtures.entries()){
 const start=Date.now(); const entry:any={fixture:index+1,address,queries:deliverySearchSequence(address),status:'pending'};
 try{
  if(index<4){
   const url=new URL('https://api.geoapify.com/v1/geocode/search');
   url.search=new URLSearchParams({text:address,format:'json',limit:'8',apiKey:key}).toString();
   const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
   entry.playgroundEquivalent={parameters:{text:address,format:'json',limit:8},status:response.status,response:await response.json()};
   // Never store a provider URL containing credentials.
  }
  const candidates=await resolveDeliveryCandidates(address,settings,'',randomUUID());
  entry.candidates=candidates;entry.status='matched';
  if(index<4){
   // Routing to the area centre is measured only as a synthetic confirmed pin, never an exact house claim.
   const c=candidates[0],context={checkoutContext:randomUUID(),addressVersion:1,confirmedPin:{latitude:c.latitude,longitude:c.longitude}};
   const quote=await createDeliveryQuote(address,settings,'',context);
   if(!('distanceKm' in quote))throw new Error('Synthetic pin unexpectedly unconfirmed');
   entry.syntheticPinRoute={distanceKm:quote.distanceKm,fee:quote.deliveryCharge,provider:'Geoapify drive metric',isHouseLocationVerified:false};
  }
 }catch(error){entry.status='error';entry.error={code:error.code||'NETWORK',status:error.status||0,message:error.message};}
 entry.elapsedMs=Date.now()-start;results.push(entry);
 console.log(JSON.stringify({fixture:entry.fixture,status:entry.status,precision:entry.candidates?.[0]?.type,errorCode:entry.error?.code,elapsedMs:entry.elapsedMs}));
 clearAddressCache();
}
await mkdir('artifacts/audit',{recursive:true});
await writeFile('artifacts/audit/provider-fixtures.json',JSON.stringify({testedAt:new Date().toISOString(),note:'Equivalent unfiltered API query, not a captured playground request. All addresses synthetic. Store pin and house positions not physically verified.',results},null,2));
console.log(JSON.stringify({matched:results.filter(r=>r.status==='matched').length,total:results.length}));


