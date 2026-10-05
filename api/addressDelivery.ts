import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { validCoordinates } from '../src/lib/mapbox.js';
import { geoapifySearch, geoapifyRoadDistance, DeliveryQuoteError, type ProviderPlace, type LookupStage } from './geoapify.js';
import { correctAddressText, normalizeAddressText as normalize, sectorId as sector, phaseId as phase, phasesAgree, localSector, houseNumber, streetNumber, significantWords, wordsAgree, namedRoad, localityQuery, lookupQueries, neighborhoodQuery, isSectorName, withoutHouse } from './addressText.js';
export { withoutHouse, localityQuery } from './addressText.js';
export { DeliveryQuoteError } from './geoapify.js';
export interface DeliverySettings {
  storeLatitude:number;storeLongitude:number;pricePerKm:number;maxDeliveryDistanceKm:number;
  minDeliveryFee?:number;feeRounding?:'nearest-rupee';pricingVersion?:string;
  serviceRegion?:{south:number;west:number;north:number;east:number};
  storeName?:string;storeAddress?:string;
}
export interface AddressMatch extends ProviderPlace {geocodedLatitude?:number;geocodedLongitude?:number;sourcePrecision?:string}
export interface QuoteContext {checkoutContext?:string;addressVersion?:number;now?:number;requestId?:string;candidateToken?:string;confirmedPin?:{latitude:number;longitude:number}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validQuoteContext(context:QuoteContext){return typeof context.checkoutContext==='string'&&uuid.test(context.checkoutContext)&&Number.isSafeInteger(context.addressVersion)&&context.addressVersion!>=0;}
function localityAgrees(address: string, candidate: AddressMatch, areaFallback=false): boolean {
  if (!validCoordinates(candidate.latitude,candidate.longitude)) return false;
  address=correctAddressText(address);
  const context = correctAddressText([candidate.name,candidate.matchedAddress,candidate.city,candidate.area,candidate.county,candidate.region].filter(Boolean).join(' '));
  // DHA II is mapped under Rawat despite customers using Islamabad. A specific
  // matching street/sector/phase is still required below; city names alone never qualify.
  if (/\b(?:islamabad|rawalpindi)\b/i.test(address) && !/\b(islamabad|rawalpindi|chaklala|rawat)\b/i.test(context)) return false;
  const requestedSector=sector(address), foundSector=sector(context);
  if(requestedSector && requestedSector!==foundSector && !(areaFallback && foundSector===requestedSector.split('/')[0]))return false;
  const requestedPhase=phase(address), foundPhase=phase(context);
  if(!phasesAgree(requestedPhase,foundPhase))return false;
  const requestedLetter=localSector(address), foundLetter=localSector(context);
  // A parent phase may have its representative point in another sector. It is
  // explicitly labelled as the phase, never as the requested house or sector.
  if(!areaFallback && requestedLetter && foundLetter && requestedLetter!==foundLetter)return false;
  const words=significantWords(localityQuery(address));
  return words.length ? wordsAgree(words,significantWords(context)) : Boolean(requestedSector && foundSector);
}
/** Match a mapped house/street without demanding optional words such as Housing Scheme. */
export function matchAddress(address: string, candidate: AddressMatch): boolean {
  if (!['building','street','address'].includes(candidate.type) || !localityAgrees(address,candidate)) return false;
  const requestedHouse=houseNumber(address);
  if(requestedHouse && candidate.houseNumber && ['building','address'].includes(candidate.type) && normalize(requestedHouse)!==normalize(candidate.houseNumber))return false;
  const requestedStreet=streetNumber(address);
  if(requestedStreet && requestedStreet!==streetNumber(candidate.street))return false;
  const road=namedRoad(address);
  if(road && !wordsAgree(significantWords(road),significantWords(candidate.street)))return false;
  // A provider returning an arbitrary street for a town-only query is not a match.
  return Boolean(requestedStreet || road || (requestedHouse && candidate.houseNumber && normalize(requestedHouse)===normalize(candidate.houseNumber)));
}
/** Prefer a real sector/phase over its broader neighbourhood. */
export function matchLocality(address: string,candidate: AddressMatch): boolean {
  if(!['city','suburb','district','neighborhood','locality'].includes(candidate.type) || !localityAgrees(address,candidate,true))return false;
  const name=candidate.name || candidate.matchedAddress.split(',')[0];
  const requestedSector=sector(address);
  if(requestedSector)return isSectorName(name) && (sector(name)===requestedSector || sector(name)===requestedSector.split('/')[0]);
  const requestedLetter=localSector(address), requestedPhase=phase(address);
  const exactLetter=requestedLetter && localSector(name)===requestedLetter;
  const exactPhase=requestedPhase && phase(name) && phasesAgree(phase(name),requestedPhase);
  if(!exactLetter && !exactPhase)return false;
  const wanted=significantWords(localityQuery(address)),found=significantWords(exactLetter?[name,candidate.area].join(' '):name);
  // Geoapify sometimes reports zero query confidence for an exactly named sector
  // or phase. Validate its actual identity instead; fuzzy names need confidence.
  const sameName=wanted.length>0 && wanted.every(w=>found.includes(w)) && (Boolean(exactLetter) || found.every(w=>wanted.includes(w)));
  return sameName || ((candidate.confidence??0)>=0.5 && wordsAgree(wanted,found) && (Boolean(exactLetter) || wordsAgree(found,wanted)));
}
/** A named housing scheme is allowed; a generic city or a POI inside it is not. */
export function matchNeighborhood(address:string,candidate:AddressMatch):boolean {
  if(!['city','suburb','district','neighborhood','locality'].includes(candidate.type) || !localityAgrees(address,candidate,true))return false;
  const query=neighborhoodQuery(address),name=candidate.name||candidate.matchedAddress.split(',')[0];
  if(localSector(name) && localSector(name)!==localSector(address))return false;
  const wanted=significantWords(query),found=significantWords(name);
  if(!wanted.length || !found.length || /\b(?:cantonment|district|capital territory)\b/i.test(name))return false;
  const exact=wanted.every(w=>found.includes(w)) && found.every(w=>wanted.includes(w));
  return exact || ((candidate.confidence??0)>=0.5 && wordsAgree(wanted,found) && wordsAgree(found,wanted));
}

const areaCache=new Map<string,{until:number;matches:AddressMatch[]}>();
export function clearAddressCache(){areaCache.clear();}
function candidateRank(p:AddressMatch,address:string) {
  return ({building:50,address:50,street:40,sector:30,phase:20,neighborhood:10}[p.type]||0)
    + (sector(address)&&sector(p.matchedAddress)===sector(address)?4:0)+(p.confidence??0);
}
function qualify(address:string,p:AddressMatch):AddressMatch|null {
  if(matchAddress(address,p)){
    const mappedHouse=['building','address'].includes(p.type)&&p.houseNumber&&houseNumber(address)&&normalize(p.houseNumber)===normalize(houseNumber(address)!)&&p.buildingConfidence!==undefined&&p.buildingConfidence>=0.8;
    if(mappedHouse)return p;
    return {...p,type:'street',houseNumber:undefined,matchedAddress:[p.street,p.area,p.city||p.county].filter(Boolean).join(', ')};
  }
  if(matchLocality(address,p)){
    const name=p.name||p.area;
    const isSector=Boolean(sector(name)||(localSector(address)&&localSector(name)===localSector(address)));
    const label=!isSector&&phase(p.area)&&phasesAgree(phase(p.area),phase(address))?p.area:name;
    return {...p,type:isSector?'sector':'phase',area:label,matchedAddress:[label,p.city||p.county].filter(Boolean).join(', ')};
  }
  if(matchNeighborhood(address,p))return {...p,type:'neighborhood',area:p.name||p.area,matchedAddress:[p.name||p.area,p.city||p.county].filter(Boolean).join(', ')};
  return null;
}
/** Full original text first, then bounded premise/street/area fallbacks. City alone is never a fallback. */
export function deliverySearchSequence(address:string):{text:string;stage:LookupStage}[]{
  const q=lookupQueries(address),city=q.city;
  const noStreet=q.detailed.replace(/\b(?:street|st|road|rd)[-.]?\s*(?:no\.?|number|#)?\s*\d+[a-z/-]*\b/gi,'').replace(/[,;]+/g,' ').replace(/\s+/g,' ').trim();
  const options:{text:string;stage:LookupStage}[]=[{text:address.trim(),stage:'full'},{text:q.corrected,stage:'normalized'},{text:q.detailed,stage:'street'},
    {text:[q.specific,city].filter(Boolean).join(', '),stage:'area'},
    {text:noStreet,stage:'area'},
    {text:[q.broad,city].filter(Boolean).join(', '),stage:'parent'},
    {text:[q.neighborhood,city].filter(Boolean).join(', '),stage:'neighborhood'}];
  const seen=new Set<string>();
  return options.filter(p=>{const key=normalize(p.text);if(!key||seen.has(key)||(!significantWords(p.text).length&&!sector(p.text)))return false;seen.add(key);return true;}).slice(0,6);
}
export async function resolveDeliveryCandidates(address:string,settings:DeliverySettings,_mapboxToken='',requestId:string=randomUUID()):Promise<AddressMatch[]> {
  const key=process.env.GEOAPIFY_GEOCODING_KEY||process.env.GEOAPIFY_API_KEY;
  if(!key)throw new DeliveryQuoteError('Address lookup is not configured. Please contact the store or choose pickup.',503,'PROVIDER_CONFIGURATION');
  const matches:AddressMatch[]=[];let providerFailure:DeliveryQuoteError|undefined;
  const budget=AbortSignal.timeout(25000);
  for(const query of deliverySearchSequence(address)){
    // Cache only premise/street-free area lookups, never customer text, routes, prices or quotes.
    const cacheable=['parent','neighborhood'].includes(query.stage)||query.stage==='area'&&!streetNumber(query.text)&&!namedRoad(query.text);
    const cacheKey=createHash('sha256').update([query.text,settings.storeLatitude,settings.storeLongitude,key].join('|')).digest('hex');
    const cached=cacheable?areaCache.get(cacheKey):undefined;
    let candidates:AddressMatch[];
    try {candidates=cached&&cached.until>Date.now()?cached.matches:await geoapifySearch(query.text,key,settings,query.stage,requestId,budget);}
    catch(error){
      if(error instanceof DeliveryQuoteError&&['PROVIDER_TIMEOUT','PROVIDER_UNAVAILABLE'].includes(error.code)){
        providerFailure=error;if(budget.aborted)break;continue;
      }
      throw error;
    }
    if(cacheable&&(!cached||cached.until<=Date.now())){if(areaCache.size>=100)areaCache.delete(areaCache.keys().next().value!);areaCache.set(cacheKey,{until:Date.now()+300000,matches:candidates});}
    matches.push(...candidates.flatMap(p=>{const c=qualify(address,p);return c?[c]:[];}));
    if(matches.some(p=>['building','address'].includes(p.type)))break;
    // A consistent street is already the best available fallback; avoid redundant area calls.
    if(matches.some(p=>p.type==='street'))break;
    if(['area','parent','neighborhood'].includes(query.stage)&&matches.some(p=>['sector','phase','neighborhood'].includes(p.type)))break;
  }
  const unique=[...new Map(matches.map(p=>[`${p.latitude}:${p.longitude}:${p.type}`,p])).values()];
  unique.sort((a,b)=>candidateRank(b,address)-candidateRank(a,address));
  if(!unique.length&&providerFailure)throw providerFailure;
  if(!unique.length)throw new DeliveryQuoteError('We could not identify this street or neighbourhood. Include the housing scheme, sector or a nearby named road with your city. You can also choose pickup.',422,'ADDRESS_NOT_FOUND');
  return unique.slice(0,3);
}
export async function resolveDeliveryAddress(address:string,settings:DeliverySettings,mapboxToken=''){return (await resolveDeliveryCandidates(address,settings,mapboxToken))[0];}

const instanceSecret=randomBytes(32).toString('hex');
function quoteSecret(){
  const secret=process.env.DELIVERY_QUOTE_SECRET;
  if(secret&&secret.length>=32)return secret;
  if(process.env.NODE_ENV==='production')throw new DeliveryQuoteError('Delivery quotes are not configured. Please contact the store or choose pickup.',503,'QUOTE_CONFIGURATION');
  return instanceSecret;
}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const signature=(payload:string)=>createHmac('sha256',quoteSecret()).update(payload).digest();
const settingsKey=(s:DeliverySettings)=>hash(JSON.stringify([s.storeLatitude,s.storeLongitude,s.pricePerKm,s.maxDeliveryDistanceKm,s.minDeliveryFee??50,s.feeRounding??'nearest-rupee',s.pricingVersion??'existing-50km-v1',s.serviceRegion??null]));
export function deliveryFee(distanceKm:number,s:DeliverySettings){return Math.max(s.minDeliveryFee??50,Math.round(distanceKm*s.pricePerKm));}
export function destinationInRegion(latitude:number,longitude:number,s:DeliverySettings){
  if(!validCoordinates(latitude,longitude))return false;
  const b=s.serviceRegion;
  if(!b)return process.env.NODE_ENV!=='production';
  return latitude>=b.south&&latitude<=b.north&&longitude>=b.west&&longitude<=b.east;
}
function assertDestination(latitude:number,longitude:number,s:DeliverySettings){
  if(!destinationInRegion(latitude,longitude,s))throw new DeliveryQuoteError('This location is outside our configured delivery area. Please choose store pickup.',422,'OUT_OF_AREA');
}
export function signDeliveryQuote(quote:Record<string,unknown>,address:string,settings:DeliverySettings,now=Date.now(),context:QuoteContext={}){
  if(process.env.NODE_ENV==='production'&&!validQuoteContext(context))throw new DeliveryQuoteError('Please start a new checkout and calculate delivery again.',400,'INVALID_CONTEXT');
  const payload=Buffer.from(JSON.stringify({v:2,latitude:quote.latitude,longitude:quote.longitude,distanceKm:quote.distanceKm,deliveryCharge:quote.deliveryCharge,type:quote.type,matchedAddress:quote.matchedAddress,city:quote.city,area:quote.area,geocodedLatitude:quote.geocodedLatitude,geocodedLongitude:quote.geocodedLongitude,sourcePrecision:quote.sourcePrecision,
    addressHash:hash(address.trim()),settings:settingsKey(settings),checkoutContext:context.checkoutContext,addressVersion:context.addressVersion,issuedAt:now,expires:now+10*60*1000})).toString('base64url');
  return payload+'.'+signature(payload).toString('base64url');
}
export function verifyDeliveryQuote(token:unknown,address:string,settings:DeliverySettings,nowOrContext:number|QuoteContext=Date.now()) {
  const options=typeof nowOrContext==='number'?{}:nowOrContext,now=typeof nowOrContext==='number'?nowOrContext:nowOrContext.now??Date.now();
  const invalid=()=>new DeliveryQuoteError('Please calculate delivery charges again before placing your order.',409,'INVALID_QUOTE');
  if(typeof token!=='string'||token.length>6000)throw invalid();
  const [payload,sig,...extra]=token.split('.');if(!payload||!sig||extra.length)throw invalid();
  const actual=Buffer.from(sig,'base64url'),expected=signature(payload);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw invalid();
  let q:any;try{q=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw invalid();}
  if(q.v!==2||q.addressHash!==hash(address.trim())||q.settings!==settingsKey(settings)||!Number.isFinite(q.issuedAt)||q.issuedAt>now||!Number.isFinite(q.expires)||q.expires<=now||q.expires-q.issuedAt>600000||
    !destinationInRegion(q.latitude,q.longitude,settings)||!Number.isFinite(q.distanceKm)||q.distanceKm<0||q.distanceKm>settings.maxDeliveryDistanceKm||q.deliveryCharge!==deliveryFee(q.distanceKm,settings))throw invalid();
  if(q.checkoutContext!==undefined&&(!validQuoteContext(options)||q.checkoutContext!==options.checkoutContext||q.addressVersion!==options.addressVersion))throw invalid();
  if(process.env.NODE_ENV==='production'&&!validQuoteContext(options))throw invalid();
  return q;
}
function signCandidate(candidate:AddressMatch,address:string,settings:DeliverySettings,context:QuoteContext){
  const payload=Buffer.from(JSON.stringify({kind:'candidate',candidate,addressHash:hash(address.trim()),checkoutContext:context.checkoutContext,settings:settingsKey(settings),expires:Date.now()+600000})).toString('base64url');
  return payload+'.'+signature(payload).toString('base64url');
}
function readCandidate(token:string,address:string,settings:DeliverySettings,context:QuoteContext):AddressMatch{
  const invalid=()=>new DeliveryQuoteError('The matched location expired or changed. Look up the address again before confirming your pin.',409,'INVALID_CANDIDATE');
  if(typeof token!=='string'||token.length>8000)throw invalid();
  const [payload,sig,...extra]=token.split('.');if(!payload||!sig||extra.length)throw invalid();
  const actual=Buffer.from(sig,'base64url'),expected=signature(payload);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw invalid();
  let c:any;try{c=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw invalid();}
  if(c.kind!=='candidate'||c.addressHash!==hash(address.trim())||c.checkoutContext!==context.checkoutContext||c.settings!==settingsKey(settings)||!Number.isFinite(c.expires)||c.expires<=Date.now())throw invalid();
  return c.candidate;
}
export async function createDeliveryQuote(address:unknown,settings:DeliverySettings,mapboxToken='',options:QuoteContext={}) {
  if(typeof address!=='string'||address.trim().length<12||address.length>600)throw new DeliveryQuoteError('Enter your complete address, including street, area and city.',400,'INVALID_ADDRESS');
  if(process.env.NODE_ENV==='production'&&!validQuoteContext(options))throw new DeliveryQuoteError('Please start a new checkout and calculate delivery again.',400,'INVALID_CONTEXT');
  const requestId=options.requestId||randomUUID();let match:AddressMatch;
  if(options.confirmedPin){
    const p=options.confirmedPin;assertDestination(p.latitude,p.longitude,settings);
    const candidate=options.candidateToken?readCandidate(options.candidateToken,address,settings,options):undefined;
    match={...p,matchedAddress:candidate?.matchedAddress||'Customer-confirmed map pin',type:'pin',city:candidate?.city||'',area:candidate?.area||'',street:candidate?.street||'',geocodedLatitude:candidate?.latitude,geocodedLongitude:candidate?.longitude,sourcePrecision:candidate?.type,provider:'Customer pin'};
  }else{
    const candidates=await resolveDeliveryCandidates(address,settings,mapboxToken,requestId);match=candidates[0];
    assertDestination(match.latitude,match.longitude,settings);
    if(!['building','address'].includes(match.type)){
      const optionsWithTokens=candidates.map(p=>({...p,precision:p.type,candidateToken:signCandidate(p,address,settings,options)}));
      return {success:true,requiresPinConfirmation:true as const,requestId,candidate:optionsWithTokens[0],candidates:optionsWithTokens,checkoutContext:options.checkoutContext,addressVersion:options.addressVersion};
    }
  }
  const route=await geoapifyRoadDistance(settings,match,requestId);
  if(route.distanceKm>settings.maxDeliveryDistanceKm)throw new DeliveryQuoteError(`This location is ${route.distanceKm.toFixed(2)} km away by road. We deliver within ${settings.maxDeliveryDistanceKm} km. You can choose store pickup.`,422,'DISTANCE_LIMIT');
  const now=options.now??Date.now();
  const quote={success:true,deliverable:true,requiresPinConfirmation:false as const,...match,...route,deliveryCharge:deliveryFee(route.distanceKm,settings),pricePerKm:settings.pricePerKm,
    expiresAt:now+600000,checkoutContext:options.checkoutContext,addressVersion:options.addressVersion,requestId};
  return {...quote,quoteToken:signDeliveryQuote(quote,address,settings,now,options)};
}
