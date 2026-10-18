import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDeliveryQuote,deliverySearchSequence,resolveDeliveryCandidates,matchAddress,matchLocality,matchNeighborhood,signDeliveryQuote,verifyDeliveryQuote,deliveryFee,clearAddressCache,type AddressMatch} from '../server/addressDelivery.js';
import {parseGeocodingResponse,geoapifySearch} from '../server/geoapify.js';
import {correctAddressText,lookupQueries,withoutHouse,sectorId} from '../server/addressText.js';
import {deliveryReducer,initialDeliveryState} from '../src/lib/deliveryCheckout.js';
import {getDeliverySettings} from '../server/deliverySettings.js';
process.env.NODE_ENV='test';
process.env.GEOAPIFY_GEOCODING_KEY='synthetic-geocoding-key';
process.env.GEOAPIFY_ROUTING_KEY='synthetic-routing-key';
process.env.DELIVERY_QUOTE_SECRET='synthetic-quote-secret-at-least-32-characters';
const settings={storeLatitude:33.567348,storeLongitude:73.104510,pricePerKm:50,maxDeliveryDistanceKm:45,minDeliveryFee:50,serviceRegion:{south:33.3,west:72.8,north:33.9,east:73.5}};
const context=()=>({checkoutContext:randomUUID(),addressVersion:1});
const address='House 14 Street 5 Gulraiz Phase 3 Rawalpindi';
const street:AddressMatch={latitude:33.56,longitude:73.10,matchedAddress:'Street 5, Gulrez, Rawalpindi',city:'Rawalpindi',area:'Gulrez',street:'Street 5',type:'street',confidence:0.7,provider:'Geoapify'};
const neighborhood:AddressMatch={...street,street:'',name:'Gulrez Housing',type:'city',matchedAddress:'Gulrez Housing, Bahria Town, Rawalpindi District',city:'Bahria Town',county:'Rawalpindi District',area:'',confidence:0};
const raw=(p:AddressMatch)=>({lat:p.latitude,lon:p.longitude,formatted:p.matchedAddress,name:p.name,city:p.city,suburb:p.area,county:p.county,state:p.region,street:p.street,housenumber:p.houseNumber,result_type:p.type,rank:{confidence:p.confidence,confidence_building_level:p.buildingConfidence}});

test('premise removal preserves street, sector, phase and Islamabad subdivision identifiers',()=>{
 for(const premise of ['House','Flat','Plot','Plaza','Apartment','Shop'])assert.equal(withoutHouse(`${premise} 14, Street 5 Sector C Bahria Town Phase 8 Rawalpindi`),'Street 5 Sector C Bahria Town Phase 8 Rawalpindi');
 const a='House 14, Street 5, Sector G-13/1, Islamabad';
 assert.match(lookupQueries(a).detailed,/G-13\/1/);assert.equal(sectorId(a),'G-13/1');
 assert.match(lookupQueries('House 14 Street 5 Sector C Bahria Town Phase 8 Rawalpindi').detailed,/Sector C.*Phase 8/);
 assert.equal(deliverySearchSequence(a)[0].text,a);
 for(const input of [address,'House 14 Street 5 Sector C Bahria Town Phase 8 Rawalpindi',a]){const q=deliverySearchSequence(input);assert.ok(q.length<=6);assert.ok(q.every(p=>!/^Rawalpindi$|^Islamabad$/i.test(p.text)));}
});
test('Urdu, numeric scripts, abbreviations, spelling variants and punctuation retain meaning',()=>{
 assert.equal(correctAddressText('مکان ۱۴ گلی ۵ گلریز فیز ۳ راولپنڈی'),'House 14 Street 5 Gulrez Phase 3 Rawalpindi');
 assert.match(correctAddressText('House 14 st. 5 sec. G 13/1 Islamabad'),/Street 5 Sector G-13\/1/);
 assert.match(correctAddressText('plasa 47 Jinna bolevard secter E DHA2 Islmabad'),/plaza 47 jinnah boulevard sector E DHA Phase 2 islamabad/i);
 assert.equal(lookupQueries(address).locality,lookupQueries(address.replace('Gulraiz','Gulrez')).locality);
});
test('GeoJSON and JSON parsing preserve actual confidence and lon/lat order without inventing scores',()=>{
 const p=raw(street),json=parseGeocodingResponse({results:[p]})[0];
 const geo=parseGeocodingResponse({features:[{properties:{...p,lat:undefined,lon:undefined,rank:{}},geometry:{type:'Point',coordinates:[73.10,33.56]}}]})[0];
 assert.equal(json.latitude,33.56);assert.equal(geo.longitude,73.10);assert.equal(geo.confidence,undefined);
 assert.throws(()=>parseGeocodingResponse({data:[]}));assert.throws(()=>parseGeocodingResponse({results:[{lat:NaN,lon:73}]}));
});
test('provider request encodes text once and uses country search plus bias without locality/circle exclusions',async t=>{
 t.mock.method(globalThis,'fetch',async(input:any)=>{const u=new URL(String(input));assert.equal(u.searchParams.get('text'),'Flat 2 & House 14, G-13/1 اسلام آباد');assert.equal(u.searchParams.get('filter'),'countrycode:pk');assert.equal(u.searchParams.get('type'),null);assert.equal(u.searchParams.get('bias'),'proximity:73.10451,33.567348');assert.equal(u.searchParams.get('format'),'json');return Response.json({results:[]});});
 await geoapifySearch('Flat 2 & House 14, G-13/1 اسلام آباد','fixture',settings,'full');
});
test('full address is attempted first and broad matches require a pin without a fee or token',async t=>{
 clearAddressCache();const queries:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any)=>{const u=new URL(String(input));assert.equal(u.pathname,'/v1/geocode/search');queries.push(u.searchParams.get('text')!);return Response.json({results:queries.length===1?[]:[raw(neighborhood)]});});
 const result=await createDeliveryQuote(address,settings,'',context());
 assert.equal(queries[0],address);assert.ok(queries.length<=6);assert.equal(result.requiresPinConfirmation,true);
 assert.equal('quoteToken' in result,false);assert.equal('deliveryCharge' in result,false);
 if(result.requiresPinConfirmation){assert.equal(result.candidate.precision,'neighborhood');assert.equal(result.candidate.confidence,0);}
});
test('specific candidates outrank provider ordering, parent sectors never become the requested subdivision',async t=>{
 clearAddressCache();
 const input='House 14 Street 5 Sector G-13/1 Islamabad';
 const parent={...neighborhood,name:'G-13',matchedAddress:'G-13, Islamabad',city:'Islamabad',county:'',area:'G-13',type:'suburb'};
 const subdivision={...parent,name:'G-13/1',matchedAddress:'G-13/1, Islamabad',area:'G-13/1',latitude:33.57};
 t.mock.method(globalThis,'fetch',async()=>Response.json({results:[raw(parent),raw(subdivision)]}));
 const candidates=await resolveDeliveryCandidates(input,settings);assert.match(candidates[0].matchedAddress,/G-13\/1/);
 assert.equal(matchLocality(input,parent),true);assert.equal(matchLocality(input,{...parent,name:'G-13/2',matchedAddress:'G-13/2, Islamabad'}),false);
 assert.equal(matchLocality(input,{...parent,name:'G-13 Markaz Ground',matchedAddress:'G-13 Markaz Ground, Islamabad',type:'amenity'}),false);
});
test('streets, sectors, phases and neighborhoods must agree geographically',()=>{
 assert.equal(matchAddress(address,street),true);assert.equal(matchAddress(address,{...street,street:'Street 6'}),false);
 assert.equal(matchNeighborhood(address,neighborhood),true);
 assert.equal(matchNeighborhood(address,{...neighborhood,matchedAddress:'Zaildar House, Bahria Town, PB, Pakistan'}),true,'provider name remains usable when formatted text omits the neighborhood');
 assert.equal(matchNeighborhood(address,{...neighborhood,name:'Rawalpindi',matchedAddress:'Rawalpindi',area:'',city:'Rawalpindi'}),false);
 const phase={...neighborhood,name:'Bahria Town Phase 8',matchedAddress:'Bahria Town Phase 8, Rawalpindi',city:'Rawalpindi',area:'Bahria Town Phase 8',type:'suburb'};
 assert.equal(matchLocality('House 14 Street 5 Sector C Bahria Town Phase 8 Rawalpindi',phase),true);
 assert.equal(matchLocality('House 14 Street 5 Sector C Bahria Town Phase 7 Rawalpindi',phase),false);
 assert.equal(matchAddress(address,{...street,city:'Lahore',matchedAddress:'Street 5 Gulrez Lahore'}),false);
});
test('a matching mapped building is distinguished from unsupported house coverage',async t=>{
 let p={...street,type:'building',houseNumber:'14',buildingConfidence:1};
 t.mock.method(globalThis,'fetch',async(input:any)=>new URL(String(input)).pathname==='/v1/routing'?Response.json({features:[{properties:{distance:2000,time:400,distance_units:'meters'}}]}):Response.json({results:[raw(p)]}));
 const result=await createDeliveryQuote(address,settings,'',context());assert.equal(result.requiresPinConfirmation,false);
 p={...p,buildingConfidence:0.2};assert.equal((await createDeliveryQuote(address,settings,'',context())).requiresPinConfirmation,true);
});
test('confirmed pin routing uses latitude,longitude and metric metres once; original address remains bound',async t=>{
 const ctx={...context(),confirmedPin:{latitude:33.56,longitude:73.10}};
 t.mock.method(globalThis,'fetch',async(input:any)=>{const u=new URL(String(input));assert.equal(u.pathname,'/v1/routing');assert.equal(u.searchParams.get('waypoints'),'33.567348,73.10451|33.56,73.1');assert.equal(u.searchParams.get('units'),'metric');assert.equal(u.searchParams.get('mode'),'drive');return Response.json({features:[{properties:{distance:5256.75,time:400,distance_units:'meters'}}]});});
 const result=await createDeliveryQuote(address,settings,'',ctx);assert.equal(result.requiresPinConfirmation,false);
 if(!result.requiresPinConfirmation){assert.equal(result.distanceKm,5.25675);assert.equal(result.deliveryCharge,263);assert.equal(result.type,'pin');assert.equal(verifyDeliveryQuote(result.quoteToken,address,settings,ctx).longitude,73.1);}
 assert.equal(deliveryFee(.2,settings),50);assert.equal(deliveryFee(1.01,settings),51);
});
test('server region and road-distance limit are enforced; routing failures never use straight-line fees',async t=>{
 let calls=0,mode='far';const ctx={...context(),confirmedPin:{latitude:33.56,longitude:73.1}};
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(mode==='far'?{features:[{properties:{distance:46000,time:500}}]}:{features:[]});});
 await assert.rejects(createDeliveryQuote(address,settings,'',{...ctx,confirmedPin:{latitude:31.5,longitude:74.3}}),/outside/);assert.equal(calls,0);
 await assert.rejects(createDeliveryQuote(address,settings,'',ctx),/within 45/);mode='missing';await assert.rejects(createDeliveryQuote(address,settings,'',ctx),/driving distance/);
});
test('401,403,429,5xx,timeouts and malformed responses remain distinct from empty address results',async t=>{
 let code=401;
 t.mock.method(globalThis,'fetch',async()=>{if(code===0)throw new DOMException('timeout','TimeoutError');if(code===200)return Response.json({unexpected:true});if(code===201)return Response.json({results:[]});return Response.json({}, {status:code});});
 for(const [status,expected] of [[401,'PROVIDER_AUTH'],[403,'PROVIDER_AUTH'],[429,'PROVIDER_RATE_LIMIT'],[500,'PROVIDER_UNAVAILABLE'],[0,'PROVIDER_TIMEOUT'],[200,'PROVIDER_RESPONSE'],[201,'ADDRESS_NOT_FOUND']]){
  code=status as number;clearAddressCache();await assert.rejects(createDeliveryQuote(address,settings,'',context()),(error:any)=>error.code===expected);
 }
});
test('signed quotes bind checkout context, address version, destination, pricing version, minimum and expiry',()=>{
 const ctx=context(),q={...street,distanceKm:5.25675,deliveryCharge:263};const token=signDeliveryQuote(q,address,settings,1000,ctx);
 assert.equal(verifyDeliveryQuote(token,address,settings,{...ctx,now:2000}).deliveryCharge,263);
 for(const [a,s,c] of [[address+' Block B',settings,ctx],[address,{...settings,pricePerKm:60},ctx],[address,{...settings,minDeliveryFee:300},ctx],[address,{...settings,pricingVersion:'changed'},ctx],[address,settings,{...ctx,checkoutContext:randomUUID()}],[address,settings,{...ctx,addressVersion:2}]])assert.throws(()=>verifyDeliveryQuote(token,a as string,s as any,{...(c as any),now:2000}));
 assert.throws(()=>verifyDeliveryQuote(token,address,settings,{...ctx,now:601000}));
 const [payload,sig]=token.split('.'),body=JSON.parse(Buffer.from(payload,'base64url').toString());body.longitude=73.3;
 assert.throws(()=>verifyDeliveryQuote(Buffer.from(JSON.stringify(body)).toString('base64url')+'.'+sig,address,settings,{...ctx,now:2000}));
});
test('address/pin edits cancel old quote state and ignore stale and out-of-order responses',()=>{
 let state=initialDeliveryState(address,0);const candidate={...neighborhood,precision:'neighborhood'};
 state=deliveryReducer(state,{type:'begin',requestId:1,version:0,confirm:false});
 state=deliveryReducer(state,{type:'edit',address:address+' A'});
 assert.equal(deliveryReducer(state,{type:'candidate',requestId:1,version:0,candidate,candidates:[candidate]}),state);
 state=deliveryReducer(state,{type:'begin',requestId:3,version:1,confirm:false});state=deliveryReducer(state,{type:'candidate',requestId:3,version:1,candidate,candidates:[candidate]});
 state=deliveryReducer(state,{type:'pin',pin:{latitude:33.6,longitude:73.2}});assert.equal(state.version,2);assert.equal(state.quote,null);
 state=deliveryReducer(state,{type:'begin',requestId:5,version:2,confirm:true});
 const quote={...street,quoteToken:'fixture',expiresAt:2000,checkoutContext:randomUUID(),addressVersion:2,distanceKm:2,deliveryCharge:100};
 assert.equal(deliveryReducer(state,{type:'quote',requestId:4,version:2,quote}),state);
 state=deliveryReducer(state,{type:'quote',requestId:5,version:2,quote});assert.equal(state.status,'quoted');
 state=deliveryReducer(state,{type:'tick',now:2000});assert.equal(state.quote,null);assert.equal(state.status,'expired');
});
test('missing trusted store configuration fails closed instead of guessing coordinates',async()=>{
 const keys=['STORE_LATITUDE','STORE_LONGITUDE','DELIVERY_RATE_PER_KM','DELIVERY_MAX_DISTANCE_KM'],saved=keys.map(k=>process.env[k]);keys.forEach(k=>delete process.env[k]);
 try{await assert.rejects(getDeliverySettings(),/configuration/);}finally{keys.forEach((k,i)=>{if(saved[i]!==undefined)process.env[k]=saved[i];});}
});

test('a slow full query can fall back within the call budget without converting failures into not-found',async t=>{
 clearAddressCache();let calls=0;t.mock.method(globalThis,'fetch',async()=>{if(++calls===1)throw new DOMException('timeout','TimeoutError');return Response.json({results:[raw(neighborhood)]});});
 const result=await createDeliveryQuote(address,settings,'',context());assert.equal(result.requiresPinConfirmation,true);assert.ok(calls<=6);assert.ok(calls>1);
});
test('a confirmed pin retains a signed geocoder match separately from original instructions',async t=>{
 clearAddressCache();t.mock.method(globalThis,'fetch',async(input:any)=>new URL(String(input)).pathname==='/v1/routing'?Response.json({features:[{properties:{distance:1000,time:120}}]}):Response.json({results:[raw(neighborhood)]}));
 const ctx=context(),candidate=await createDeliveryQuote(address,settings,'',ctx);if(!candidate.requiresPinConfirmation)throw new Error('Expected candidate');
 const pin={latitude:33.58,longitude:73.11};const result=await createDeliveryQuote(address,settings,'',{...ctx,addressVersion:2,confirmedPin:pin,candidateToken:candidate.candidate.candidateToken});
 if(!('quoteToken' in result))throw new Error('Expected quote');const verified=verifyDeliveryQuote(result.quoteToken,address,settings,{...ctx,addressVersion:2});assert.equal(verified.latitude,pin.latitude);assert.equal(verified.geocodedLatitude,neighborhood.latitude);assert.match(verified.matchedAddress,/Gulrez/);
 await assert.rejects(createDeliveryQuote(address+' Block B',settings,'',{...ctx,confirmedPin:pin,candidateToken:candidate.candidate.candidateToken}),/expired or changed/);
});
