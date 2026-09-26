import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deliveryFeeForRoute, drivingRoute, forwardMapbox, validCoordinates } from '../src/lib/mapbox.js';
import { correctAddressText, normalizeAddressText as normalize, sectorId as sector, phaseId as phase, phasesAgree, localSector, houseNumber, streetNumber, significantWords, wordsAgree, namedRoad, localityQuery, lookupQueries, neighborhoodQuery, isSectorName } from './addressText.js';
export { withoutHouse, localityQuery } from './addressText.js';

export interface DeliverySettings { storeLatitude: number; storeLongitude: number; pricePerKm: number; maxDeliveryDistanceKm: number }
export interface AddressMatch { latitude: number; longitude: number; matchedAddress: string; city: string; area: string; street: string; type: string; confidence: number; provider: string; houseNumber?: string; county?: string; name?: string; region?: string }
export class DeliveryQuoteError extends Error { constructor(message: string, public status = 422) { super(message); } }
function localityAgrees(address: string, candidate: AddressMatch, areaFallback=false): boolean {
  if (!validCoordinates(candidate.latitude,candidate.longitude)) return false;
  address=correctAddressText(address);
  const context = correctAddressText([candidate.matchedAddress,candidate.city,candidate.area,candidate.county,candidate.region].filter(Boolean).join(' '));
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
  if (!['building','street','address'].includes(candidate.type) || candidate.confidence < 0.4 || !localityAgrees(address,candidate)) return false;
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
  return sameName || (candidate.confidence>=0.5 && wordsAgree(wanted,found) && (Boolean(exactLetter) || wordsAgree(found,wanted)));
}
/** A named housing scheme is allowed; a generic city or a POI inside it is not. */
export function matchNeighborhood(address:string,candidate:AddressMatch):boolean {
  if(!['city','suburb','district','neighborhood','locality'].includes(candidate.type) || !localityAgrees(address,candidate,true))return false;
  const query=neighborhoodQuery(address),name=candidate.name||candidate.matchedAddress.split(',')[0];
  if(localSector(name) && localSector(name)!==localSector(address))return false;
  const wanted=significantWords(query),found=significantWords(name);
  if(!wanted.length || !found.length || /\b(?:cantonment|district|capital territory)\b/i.test(name))return false;
  const exact=wanted.every(w=>found.includes(w)) && found.every(w=>wanted.includes(w));
  return exact || (candidate.confidence>=0.5 && wordsAgree(wanted,found) && wordsAgree(found,wanted));
}
async function geoapifySearch(address: string,key: string,settings: DeliverySettings,locality=false): Promise<AddressMatch[]> {
  const url=new URL('https://api.geoapify.com/v1/geocode/search');
  const params:Record<string,string>={text:address,format:'json',limit:'10',lang:'en',filter:locality?`circle:${settings.storeLongitude},${settings.storeLatitude},${settings.maxDeliveryDistanceKm*1000}`:'countrycode:pk',bias:`proximity:${settings.storeLongitude},${settings.storeLatitude}`,apiKey:key};
  if(locality)params.type='locality';
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res=await fetch(url,{signal:AbortSignal.timeout(6500)});
  if(!res.ok)throw new DeliveryQuoteError('Address lookup is temporarily unavailable. Please try again.',503);
  const data=await res.json();
  return(data.results||[]).map((p:any)=>({latitude:p.lat,longitude:p.lon,matchedAddress:p.formatted||'',name:p.name||(p.formatted||'').split(',')[0],city:p.city||p.town||'',area:p.suburb||p.district||'',county:p.county||'',region:p.state_code==='IS'?'Islamabad Capital Territory':p.state||'',street:p.street||'',type:p.result_type==='building'&&(p.rank?.confidence_building_level??0)<0.8?'street':p.result_type,confidence:p.rank?.confidence??0,provider:'Geoapify',houseNumber:p.housenumber}));
}
export async function resolveDeliveryAddress(address: string,settings: DeliverySettings,mapboxToken: string): Promise<AddressMatch> {
  const key=process.env.GEOAPIFY_GEOCODING_KEY||process.env.GEOAPIFY_API_KEY;
  const queries=lookupQueries(address);
  let responded=false;
  const collect=async(jobs:Promise<AddressMatch[]>[])=>{
    const settled=await Promise.allSettled(jobs);
    return settled.flatMap(result=>{if(result.status==='fulfilled'){responded=true;return result.value;}return [];});
  };
  const mapboxSearch=async(query=queries.detailed)=>{
    const results=await forwardMapbox(query,mapboxToken,{autocomplete:false,signal:AbortSignal.timeout(6500),proximity:{lat:settings.storeLatitude,lng:settings.storeLongitude}});
    return results.map(p=>({latitude:p.lat,longitude:p.lng,matchedAddress:p.formatted,name:p.mainText,city:p.city,area:p.area,county:p.details.district,region:p.details.region,street:p.details.street||p.mainText,type:p.featureType,confidence:1,provider:'Mapbox',houseNumber:p.details.houseNumber}));
  };
  const bestStreet=(candidates:AddressMatch[])=>{
    // An unlocated house can still match its street, but must not be labelled a house.
    const matches=candidates.flatMap(p=>{
      const precise=['address','building'].includes(p.type) && p.houseNumber && houseNumber(address) && normalize(p.houseNumber)===normalize(houseNumber(address)!);
      const downgrade=!precise && (['address','building'].includes(p.type) || (p.type==='street' && p.houseNumber));
      const c=downgrade?{...p,type:'street',houseNumber:undefined,matchedAddress:[p.street,p.area,p.city].filter(Boolean).join(', ')}:p;
      return matchAddress(address,c)?[c]:[];
    });
    return matches.sort((a,b)=>Number(b.type!=='street')-Number(a.type!=='street') || b.confidence-a.confidence)[0];
  };
  // Two bounded batches instead of five sequential provider timeouts. Always
  // prefer a house/street result before considering a sector or phase.
  const candidates=await collect(key?[...new Set([queries.corrected,queries.detailed])].map(q=>geoapifySearch(q,key,settings)):[mapboxSearch()]);
  const street=bestStreet(candidates);if(street)return street;
  const fallbackJobs:Promise<AddressMatch[]>[]=[mapboxSearch(key?queries.detailed:queries.localityWithCity)];
  if(key && queries.locality){
    fallbackJobs.push(geoapifySearch(queries.specific,key,settings,true));
    if(queries.specific!==queries.broad)fallbackJobs.push(geoapifySearch(queries.broad,key,settings,true));
    fallbackJobs.push(geoapifySearch(queries.localityWithCity,key,settings));
    if(queries.neighborhood && queries.neighborhood!==queries.specific)fallbackJobs.push(geoapifySearch(queries.neighborhood,key,settings,true));
  }
  candidates.push(...await collect(fallbackJobs));
  const fallbackStreet=bestStreet(candidates);if(fallbackStreet)return fallbackStreet;
  const areas=candidates.filter(p=>matchLocality(address,p)).sort((a,b)=>{
    const precision=(p:AddressMatch)=>Number(Boolean(sector(p.name||'')===sector(address) && sector(address)))+Number(Boolean(localSector(address) && localSector(p.name||'')===localSector(address)));
    return precision(b)-precision(a) || b.confidence-a.confidence;
  });
  const area=areas[0];
  if(area){
    const name=area.name||area.area;
    const sectorMatch=Boolean(sector(address) || (localSector(address) && localSector(name)===localSector(address)));
    const type=sectorMatch?'sector':'phase';
    // A DHA phase result may be named after its representative point's sector.
    // Label it using the matched phase, not a different customer sector.
    const label=type==='phase' && phase(area.area)===phase(address)?area.area:name;
    return{...area,type,area:label,matchedAddress:[label,area.county||area.city].filter(Boolean).join(', ')};
  }
  const neighborhood=candidates.filter(p=>matchNeighborhood(address,p)).sort((a,b)=>b.confidence-a.confidence)[0];
  if(neighborhood)return{...neighborhood,type:'neighborhood',area:neighborhood.name||neighborhood.area,matchedAddress:[neighborhood.name||neighborhood.area,neighborhood.county||neighborhood.city].filter(Boolean).join(', ')};
  throw new DeliveryQuoteError(responded?'We could not identify this street or neighbourhood. Include the housing scheme, sector or a nearby named road with your city, then calculate again.':'Address lookup is temporarily unavailable. Please try again.',responded?422:503);
}

const instanceSecret = randomBytes(32).toString('hex');
const quoteSecret = () => process.env.DELIVERY_QUOTE_SECRET || process.env.GEOAPIFY_GEOCODING_KEY || process.env.GEOAPIFY_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || instanceSecret;
const signature = (payload: string) => createHmac('sha256',quoteSecret()).update(payload).digest();
const settingsKey = (s: DeliverySettings) => [s.storeLatitude,s.storeLongitude,s.pricePerKm,s.maxDeliveryDistanceKm].join(':');
export function signDeliveryQuote(quote: Record<string, unknown>, address: string, settings: DeliverySettings, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({...quote,address:address.trim(),settings:settingsKey(settings),expires:now+30*60*1000})).toString('base64url');
  return payload+'.'+signature(payload).toString('base64url');
}
export function verifyDeliveryQuote(token: unknown, address: string, settings: DeliverySettings, now = Date.now()) {
  const invalid = () => new DeliveryQuoteError('Please calculate delivery charges again before placing your order.',409);
  if (typeof token !== 'string' || token.length > 6000) throw invalid();
  const [payload,sig,...extra] = token.split('.');
  if (!payload || !sig || extra.length) throw invalid();
  const actual = Buffer.from(sig,'base64url'), expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) throw invalid();
  let quote: any; try {quote = JSON.parse(Buffer.from(payload,'base64url').toString());} catch {throw invalid();}
  if (quote.address !== address.trim() || quote.settings !== settingsKey(settings) || !Number.isFinite(quote.expires) || quote.expires <= now || !validCoordinates(quote.latitude,quote.longitude) || !Number.isFinite(quote.distanceKm) || quote.distanceKm < 0 || quote.distanceKm > settings.maxDeliveryDistanceKm || quote.deliveryCharge !== deliveryFeeForRoute(quote.distanceKm,settings.pricePerKm)) throw invalid();
  return quote;
}

async function deliveryRoute(settings: DeliverySettings,match: AddressMatch,mapboxToken:string) {
  try {
    return await drivingRoute(settings.storeLatitude,settings.storeLongitude,match.latitude,match.longitude,mapboxToken,{signal:AbortSignal.timeout(6500),radiusMeters:['sector','phase','neighborhood'].includes(match.type)?1000:100});
  } catch {
    const key=process.env.GEOAPIFY_ROUTING_KEY||process.env.GEOAPIFY_API_KEY||process.env.GEOAPIFY_GEOCODING_KEY;
    if(key){
      try {
        const url=new URL('https://api.geoapify.com/v1/routing');
        Object.entries({waypoints:`${settings.storeLatitude},${settings.storeLongitude}|${match.latitude},${match.longitude}`,mode:'drive',units:'metric',apiKey:key}).forEach(([k,v])=>url.searchParams.set(k,v));
        const response=await fetch(url,{signal:AbortSignal.timeout(6500)});
        if(!response.ok)throw new Error('Routing unavailable');
        const data=await response.json(),route=data.features?.[0]?.properties;
        if(!route || !Number.isFinite(route.distance) || route.distance<0 || !Number.isFinite(route.time))throw new Error('Invalid road distance');
        return {distanceKm:route.distance/1000};
      }catch{}
    }
    throw new DeliveryQuoteError('We found the location but could not calculate its driving distance. Please try Calculate delivery charges again.',503);
  }
}

export async function createDeliveryQuote(address: unknown, settings: DeliverySettings, mapboxToken: string) {
  if (typeof address !== 'string' || address.trim().length < 12 || address.length > 600) throw new DeliveryQuoteError('Enter your complete address, including street, area and city.',400);
  const match = await resolveDeliveryAddress(address.trim(),settings,mapboxToken);
  const route = await deliveryRoute(settings,match,mapboxToken);
  if (route.distanceKm > settings.maxDeliveryDistanceKm) throw new DeliveryQuoteError(`This address is ${route.distanceKm.toFixed(2)} km away by road. We deliver within ${settings.maxDeliveryDistanceKm} km. You can choose store pickup.`);
  const quote = { success:true,deliverable:true,...match,distanceKm:route.distanceKm,deliveryCharge:deliveryFeeForRoute(route.distanceKm,settings.pricePerKm),pricePerKm:settings.pricePerKm };
  return {...quote,quoteToken:signDeliveryQuote(quote,address,settings)};
}
