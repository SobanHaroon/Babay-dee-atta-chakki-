import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolveDeliveryCandidates,createDeliveryQuote,clearAddressCache,deliverySearchSequence} from '../api/addressDelivery.js';
import {randomUUID} from 'node:crypto';
import {getDeliverySettings} from '../api/deliverySettings.js';
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
// Owner-provided store place pin and approved pricing/service-area environment.
const settings=await getDeliverySettings();
const results=[];
const selected=process.argv.slice(2).map(Number).filter(Number.isInteger);
for(const [index,address] of fixtures.entries()){
 if(selected.length&&!selected.includes(index+1))continue;
 const start=Date.now(); const entry:any={fixture:index+1,address,queries:deliverySearchSequence(address),status:'pending'};
 try{
  if(index<4){
   const url=new URL('https://api.geoapify.com/v1/geocode/search');
   url.search=new URLSearchParams({text:address,format:'json',limit:'8',apiKey:key}).toString();
   try {
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    entry.playgroundEquivalent={parameters:{text:address,format:'json',limit:8},status:response.status,response:await response.json()};
   } catch { entry.playgroundEquivalent={status:'timeout-or-network-error'}; }
   // Never store a provider URL containing credentials.
  }
  const candidates=await resolveDeliveryCandidates(address,settings,'',randomUUID());
  entry.candidates=candidates;entry.status='matched';
  if(index<5){
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
await writeFile(`artifacts/audit/provider-fixtures-2026-10-12${selected.length?'-'+selected.join('-'):''}.json`,JSON.stringify({testedAt:new Date().toISOString(),note:'Equivalent unfiltered API query, not a captured playground request. All addresses synthetic. Store coordinates verified from the owner-provided Google Maps place link; house positions are NOT verified. Area-centre routes are test pins only.',results},null,2));
console.log(JSON.stringify({matched:results.filter(r=>r.status==='matched').length,total:results.length}));


