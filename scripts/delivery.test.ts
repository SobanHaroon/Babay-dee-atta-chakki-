import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryQuote, matchAddress, matchLocality, matchNeighborhood, localityQuery, signDeliveryQuote, verifyDeliveryQuote, withoutHouse, type AddressMatch } from '../api/addressDelivery.js';
import { pakistanDateKey, orderProgress } from '../src/lib/commerce.js';
import { generateOrderReceiptHtml, generateOrderReceiptPlainText } from '../src/lib/orderReceipt.js';
import { correctAddressText, lookupQueries, houseNumber } from '../api/addressText.js';
const settings = {storeLatitude:33.567348,storeLongitude:73.104510,pricePerKm:50,maxDeliveryDistanceKm:45};
const address = 'House 14, Main Gulraiz Road, Rawalpindi';
const match: AddressMatch = {latitude:33.586714,longitude:73.101111,matchedAddress:'Main Gulraiz Road, Khayaban-e-Tanveer, Rawalpindi, Pakistan',city:'Rawalpindi',area:'Khayaban-e-Tanveer',street:'Main Gulraiz Road',type:'street',confidence:1,provider:'Geoapify'};

test('address matching rejects city centres and conflicting sectors, streets and societies',()=>{
 assert.equal(matchAddress(address,match),true);
 assert.equal(withoutHouse(address),'Main Gulraiz Road, Rawalpindi');
 assert.equal(matchAddress(address,{...match,type:'city'}),false);
 assert.equal(matchAddress('House 14, Gulraiz Phase 3, Rawalpindi',{...match,matchedAddress:'Phase 3, Bahria Town, Rawalpindi'}),false);
 const sectorMatch={...match,city:'Islamabad',street:'Street 25',matchedAddress:'14, Street 25, F-10/2, Islamabad'};
 assert.equal(matchAddress('House 14 Street 25 F-10/2 Islamabad',sectorMatch),true);
 assert.equal(matchAddress('House 14 Street 25 F-10/2 Islamabad',{...sectorMatch,matchedAddress:'Street 25, G-10, Islamabad'}),false);
 assert.equal(matchAddress('House 14 Street 25 F-10/2 Islamabad',{...sectorMatch,street:'Street 14'}),false);
 assert.equal(matchAddress('House 14 Street 25 F-10/2 Islamabad',{...sectorMatch,type:'amenity'}),false);
});
test('quotes bind address, coordinates, actual road distance, pricing settings and expiry',()=>{
 const quote={...match,distanceKm:5.25675,deliveryCharge:263};
 const token=signDeliveryQuote(quote,address,settings,1000);
 assert.equal(verifyDeliveryQuote(token,address,settings,2000).deliveryCharge,263);
 for(const [t,a,s,now] of [[token,address+' block B',settings,2000],[token,address,{...settings,pricePerKm:70},2000],[token,address,settings,1801000],[token+'x',address,settings,2000]])assert.throws(()=>verifyDeliveryQuote(t,a as string,s as typeof settings,now as number));
 const [body,signature]=token.split('.');const tampered=JSON.parse(Buffer.from(body,'base64url').toString());tampered.deliveryCharge=0;
 assert.throws(()=>verifyDeliveryQuote(Buffer.from(JSON.stringify(tampered)).toString('base64url')+'.'+signature,address,settings,2000));
});
test('address quote uses geocoded coordinates and road metres, rejects out of range and routing failures',async t=>{
 process.env.GEOAPIFY_GEOCODING_KEY='test-private-geocoding-key';
 let mode='ok';const urls:string[]=[];
 t.mock.method(globalThis,'fetch',async(input: any)=>{
   const u=new URL(String(input));urls.push(u.toString());
   if(u.hostname.includes('geoapify'))return Response.json({results:[{lat:match.latitude,lon:match.longitude,formatted:match.matchedAddress,city:match.city,suburb:match.area,street:match.street,result_type:'street',rank:{confidence:1}}]});
   return Response.json(mode==='failure'?{code:'NoRoute',routes:[]}:{code:'Ok',routes:[{distance:mode==='far'?46000:5256.75,duration:900,geometry:{coordinates:[[73.104510,33.567348],[match.longitude,match.latitude]]}}]});
 });
 const quote=await createDeliveryQuote(address,settings,'test-token');
 assert.equal(quote.distanceKm,5.25675);assert.equal(quote.deliveryCharge,263);
 assert.equal(verifyDeliveryQuote(quote.quoteToken,address,settings).latitude,match.latitude);
 assert.ok(urls.some(url=>url.includes('73.101111,33.586714')));
 mode='far';await assert.rejects(createDeliveryQuote(address,settings,'test-token'),/within 45 km/);
 mode='failure';await assert.rejects(createDeliveryQuote(address,settings,'test-token'),/driving distance/);
 await assert.rejects(createDeliveryQuote('',settings,'test-token'),/complete address/);
});
test('Pakistan dates and cancelled tracking do not display misleading progression',()=>{
 assert.equal(pakistanDateKey(new Date('2026-09-24T20:00:00Z')),'2026-09-25');
 assert.equal(orderProgress('Cancelled').index,-1);assert.equal(orderProgress('Out for Delivery').index,3);
 assert.equal(orderProgress('Delivered',true).steps[4],'Collected');
});
test('receipts preserve detailed address and charged fee, escape HTML and link the specific order',()=>{
 const order={id:'BDEC-123',customer:{name:'<script>alert(1)</script>',address,phone:'03211234567'},items:[{name:'Atta',quantity:2,price:100}],subtotal:200,deliveryCharges:263,discount:10,total:453,createdAt:'2026-09-25T00:00:00Z'};
 const html=generateOrderReceiptHtml(order);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes(address));assert.ok(html.includes('Rs. 263'));assert.ok(html.includes('order=BDEC-123'));
 const text=generateOrderReceiptPlainText({...order,total:undefined});assert.ok(text.includes('Rs. 453'));
});
test('checkout API rejects absent, changed and forged delivery quotes before saving an order',async t=>{
 const {default:app}=await import('../api/index.js');const realFetch=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(input:any,init:any)=>new URL(String(input)).hostname==='127.0.0.1'?realFetch(input,init):Response.json([]));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try {
 const base='http://127.0.0.1:'+(server.address() as any).port;
 const quote=signDeliveryQuote({...match,distanceKm:5.25675,deliveryCharge:263},address,settings);
 for(const body of [{},{deliveryQuoteToken:'forged'},{deliveryQuoteToken:quote,address:address+' changed'}]) {
 const response=await fetch(base+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test Customer',phone:'03211234567',address,fulfillmentType:'delivery',...body})});assert.equal(response.status,409);assert.match((await response.json()).error,/calculate delivery/);
 }
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test('Gulrez addresses use the explicitly approved neighbourhood estimate, preserving the whole address',async t=>{
 const input='64 Street 5\nPhase 3 Gulrez Housing Scheme rawalpindi';
 assert.equal(withoutHouse(input),'Street 5\nPhase 3 Gulrez Housing Scheme rawalpindi');
 assert.equal(localityQuery(input),'gulrez Phase 3');
 assert.equal(localityQuery(input.replace('Gulrez','Gulraiz')),'gulrez Phase 3');
 const area={...match,type:'city',matchedAddress:'Gulrez Housing, Zaildar House, Bahria Town, PB, Pakistan',name:'Gulrez Housing',city:'Bahria Town',county:'Rawalpindi District',area:'',street:'',confidence:1};
 assert.equal(matchLocality(input,area),false,'a society is not mislabelled as a phase');
 assert.equal(matchNeighborhood(input,area),true);
 assert.equal(matchLocality(input,{...area,name:'Rawalpindi',matchedAddress:'Rawalpindi, Pakistan'}),false);
 assert.equal(matchLocality(input,{...area,name:'Gulrez Masjid',type:'amenity',matchedAddress:'Gulrez Masjid, Gulrez, Rawalpindi'}),false);
 assert.equal(matchLocality(input,{...area,name:'Bahria Town Phase 3',matchedAddress:'Bahria Town Phase 3, Rawalpindi'}),false);
 assert.equal(matchAddress(input,{...match,street:'Street 5',matchedAddress:'Street 5, Gulraiz, Chaklala Cantonment',confidence:1}),true,'missing phase and alternative spelling are accepted');
 let localityCalls=0;
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.hostname.includes('geoapify')){
   if(u.searchParams.get('type')==='locality'){localityCalls++;assert.ok(['gulrez Phase 3','gulrez'].includes(u.searchParams.get('text')!));return Response.json({results:[{lat:33.5618388,lon:73.105382,formatted:area.matchedAddress,city:area.city,county:area.county,result_type:'city',rank:{confidence:1}}]});}
   return Response.json({results:[{lat:33.537315,lon:73.063345,formatted:'64 St-64, Rah-e-Skoon Colony, Rawalpindi',street:'St-64',city:'Rawalpindi',result_type:'building',rank:{confidence:.11}}]});
  }
  if(u.pathname.includes('directions'))return Response.json({code:'Ok',routes:[{distance:1100,duration:180,geometry:{coordinates:[[73.104510,33.567348],[73.105382,33.5618388]]}}]});
  return Response.json({features:[]});
 });
 const quote=await createDeliveryQuote(input,settings,'test-token');assert.equal(quote.type,'neighborhood');assert.equal(quote.deliveryCharge,55);assert.equal(quote.distanceKm,1.1);assert.equal(localityCalls,2);
 assert.equal(verifyDeliveryQuote(quote.quoteToken,input,settings).address,input);
});

const jinnah='plaza 47 jinnah boulevard sector E DHA 2 islamabad';
const jinnahStreet:AddressMatch={latitude:33.5311245,longitude:73.146962,matchedAddress:'Jinnah Boulevard, DHA Phase II, Rawat 45730, Pakistan',city:'Rawat',area:'DHA Phase II',street:'Jinnah Boulevard',type:'street',confidence:.63,provider:'Geoapify'};
const providerResult=(m:AddressMatch)=>({lat:m.latitude,lon:m.longitude,formatted:m.matchedAddress,city:m.city,suburb:m.area,county:m.county,street:m.street,housenumber:m.houseNumber,result_type:m.type,rank:{confidence:m.confidence,confidence_building_level:1}});
const mapboxRoute={code:'Ok',routes:[{distance:8200,duration:900,geometry:{coordinates:[[73.104510,33.567348],[73.146962,33.5311245]]}}]};

test('building labels, minor typos and Roman phases normalize without changing address numbers',()=>{
 for(const label of ['Plaza','House','Plot','Building','Flat','Apartment','Shop','Office'])assert.equal(withoutHouse(`${label} No. 47, Jinnah Boulevard`),'Jinnah Boulevard');
 assert.equal(houseNumber('Flat 2B, Plaza #47, Jinnah Boulevard'),'47');
 assert.equal(localityQuery('House H-15 Street 3 Sector F-10/2 Islamabad'),'F-10/2','house identifier is not treated as a sector');
 assert.equal(lookupQueries('House 47 Street 999 sector F-10/2 Islamabad').detailed,'Street 999 sector F-10/2 Islamabad');
 assert.equal(lookupQueries('House 47 Street 999 sector F-10/2 Islamabad').specific,'F-10/2');
 assert.equal(lookupQueries(jinnah).detailed,'jinnah boulevard DHA Phase 2 islamabad');
 assert.equal(lookupQueries('plaza 47 Jinna bouleverd secter E DHA2 Islmabad').detailed.toLowerCase(),'jinnah boulevard dha phase 2 islamabad');
 assert.equal(localityQuery('64 Streat 5 Phaze 3 Gulraizz Hosing Scheem Rawalpndi'),'gulrez Phase 3');
 assert.match(correctAddressText('House 47 Street 51 sector F 10/2 Phase II'),/47 Street 51 sector F-10\/2 Phase 2/);
 assert.equal(matchAddress(jinnah,jinnahStreet),true);
 assert.equal(matchAddress(jinnah,{...jinnahStreet,matchedAddress:'Jinnah Boulevard, DHA Phase III, Rawat',area:'DHA Phase III'}),false);
 assert.equal(matchAddress(jinnah,{...jinnahStreet,street:'Iqbal Boulevard',matchedAddress:'Iqbal Boulevard, DHA Phase II, Rawat'}),false);
 assert.equal(matchAddress(jinnah,{...jinnahStreet,city:'Lahore',matchedAddress:'Jinnah Boulevard, DHA Phase II, Lahore'}),false);
});

test('exact customer plaza address and typo variant calculate to Jinnah Boulevard and preserve original detail',async t=>{
 process.env.GEOAPIFY_GEOCODING_KEY='test-private-geocoding-key';
 const queries:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.hostname.includes('geoapify')){const query=u.searchParams.get('text')||'';queries.push(query);return Response.json({results:!query.toLowerCase().includes('plaza')?[providerResult(jinnahStreet)]:[]});}
  return Response.json(mapboxRoute);
 });
 for(const input of [jinnah,'plaza 47 Jinna bouleverd secter E DHA2 Islmabad']){
  const quote=await createDeliveryQuote(input,settings,'test-token');
  assert.equal(quote.type,'street');assert.equal(quote.distanceKm,8.2);assert.equal(quote.deliveryCharge,410);
  assert.equal(verifyDeliveryQuote(quote.quoteToken,input,settings).address,input);
 }
 assert.ok(queries.some(q=>q.toLowerCase()==='jinnah boulevard dha phase 2 islamabad'));
});

test('fallback requires the matching sector or phase, never a city, town or conflicting phase',async t=>{
 process.env.GEOAPIFY_GEOCODING_KEY='test-private-geocoding-key';
 const phase:AddressMatch={...jinnahStreet,type:'suburb',street:'',name:'DHA Phase II',matchedAddress:'DHA Phase II, Rawat, Sector G, Islamabad',confidence:1};
 assert.equal(matchLocality(jinnah,phase),true);
 assert.equal(matchLocality(jinnah,{...phase,name:'DHA Phase III',matchedAddress:'DHA Phase III, Rawat',area:'DHA Phase III'}),false);
 assert.equal(matchLocality(jinnah,{...phase,name:'DHA',matchedAddress:'DHA, Rawat',area:'DHA'}),false);
 assert.equal(matchLocality(jinnah,{...phase,type:'amenity',name:'Masjid DHA Phase II'}),false);
 const sector={...phase,name:'Sector F-10',matchedAddress:'Sector F-10, Islamabad',city:'Islamabad',area:'F-10'};
 assert.equal(matchLocality('House 1 Street 3 F-10/2 Islamabad',sector),true);
 assert.equal(matchLocality('House 1 Street 3 F-10/2 Islamabad',{...sector,confidence:0}),true,'explicit provider sector identity is more reliable than query confidence');
 assert.equal(matchLocality('House 1 Street 3 F-10/2 Islamabad',{...sector,name:'Sector F-10/3',matchedAddress:'Sector F-10/3, Islamabad'}),false);
 assert.equal(matchLocality('House 4 Street 6 I-8/2 Islamabad',{...sector,name:'I-8 Markaz Ground',matchedAddress:'I-8 Markaz Ground, Islamabad',area:'I-8 Markaz Ground'}),false,'a landmark cannot be labelled as the sector');
 const askari={...sector,name:'Askari Sector 1',matchedAddress:'Askari Sector 1, Rawalpindi',area:'Askari Sector 1',city:'Rawalpindi'};
 assert.equal(matchLocality('Flat 4 Street 999 Askari Sector 1 Rawalpindi',askari),true);
 assert.equal(matchLocality('Flat 4 Street 999 Askari Sector 2 Rawalpindi',askari),false);
 let routing=false;
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.hostname.includes('geoapify'))return Response.json({results:[{...providerResult(phase),name:'Sector G, DHA Phase 2, Islamabad'}]});
  if(u.pathname.includes('directions')){routing=true;assert.equal(u.searchParams.get('radiuses'),'100;1000');return Response.json(mapboxRoute);}
  return Response.json({features:[]});
 });
 const quote=await createDeliveryQuote(jinnah,settings,'test-token');assert.equal(quote.type,'phase');assert.equal(quote.matchedAddress,'DHA Phase II, Rawat');assert.ok(routing);
});

test('neighbourhood matching covers local schemes, provider city labels and typos without accepting cities or POIs',()=>{
 const cases=[
  ['House 10 Saidpur Road Satellite Town Rawalpindi','Satellite Town','Chah Sultan','Rawalpindi District',''],
  ['House 15 Street 6 PWD Housing Society Islamabad','PWD Society','Rawalpindi','Rawalpindi',''],
  ['Plot 20 Street 4 Soan Garden Islamabad','Soan Garden','Zone V','','Islamabad'],
  ['House 4 Street 9 Sector A Bahria Enclave Islamabad','Bahria Enclave','Jagiot','','Islamabad'],
  ['house 64 streat 5 gulraizz phaze 3 rawalpndi','Gulrez Housing','Bahria Town','Rawalpindi District',''],
 ];
 for(const [input,name,city,county,region] of cases){
  const candidate={...match,type:'suburb',name,matchedAddress:[name,city].join(', '),area:name,city,county,region,street:'',confidence:0};
  assert.equal(matchNeighborhood(input,candidate),true,input);
  assert.equal(matchNeighborhood(input,{...candidate,name:name+' Mosque'}),false);
  assert.equal(matchNeighborhood(input,{...candidate,name:'Rawalpindi',matchedAddress:'Rawalpindi',area:'',city:'Rawalpindi',confidence:1}),false);
 }
 assert.equal(matchNeighborhood('House 99 Street 999 Imaginary Sector ZZZ Rawalpindi',{...match,name:'Rawalpindi',type:'city'}),false);
 const ghauri={...match,type:'suburb',name:'Ghauri Town Phase 4-A',matchedAddress:'Ghauri Town Phase 4-A, Islamabad',area:'Ghauri Town Phase 4-A',city:'Islamabad'};
 assert.equal(matchLocality('House 1 Ghauri Town Phase 4 Islamabad',ghauri),true);
 assert.equal(matchLocality('House 1 Ghauri Town Phase 4-B Islamabad',ghauri),false,'different lettered phases must not be confused');
});

test('mapped house is preferred and an incorrect house can only be priced as its matching street',async t=>{
 process.env.GEOAPIFY_GEOCODING_KEY='test-private-geocoding-key';
 let number='47';
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.hostname.includes('geoapify'))return Response.json({results:[providerResult({...jinnahStreet,type:'building',houseNumber:number,confidence:1})]});
  return Response.json(mapboxRoute);
 });
 assert.equal((await createDeliveryQuote(jinnah,settings,'test-token')).type,'building');
 number='48';assert.equal((await createDeliveryQuote(jinnah,settings,'test-token')).type,'street');
});

test('Geoapify driving route recovers from Mapbox failure; no route never produces a quote',async t=>{
 process.env.GEOAPIFY_GEOCODING_KEY='test-private-geocoding-key';
 let available=true;
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const u=new URL(String(input));
  if(u.pathname==='/v1/geocode/search')return Response.json({results:[providerResult(jinnahStreet)]});
  if(u.pathname==='/v1/routing'){
   assert.equal(u.searchParams.get('mode'),'drive');assert.equal(u.searchParams.get('units'),'metric');assert.equal(u.searchParams.get('waypoints'),'33.567348,73.10451|33.5311245,73.146962');
   return Response.json(available?{features:[{properties:{distance:8567,time:910}}]}:{features:[]});
  }
  return Response.json({code:'NoRoute',routes:[]});
 });
 const quote=await createDeliveryQuote(jinnah,settings,'test-token');assert.equal(quote.distanceKm,8.567);assert.equal(quote.deliveryCharge,428);
 available=false;await assert.rejects(createDeliveryQuote(jinnah,settings,'test-token'),/driving distance/);
});
