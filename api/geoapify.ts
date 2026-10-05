import { randomUUID } from 'node:crypto';
import { validCoordinates } from '../src/lib/mapbox.js';

export class DeliveryQuoteError extends Error {
  constructor(message: string, public status = 422, public code = 'ADDRESS_NOT_FOUND') { super(message); }
}
export interface ProviderPlace {
  latitude:number; longitude:number; matchedAddress:string; city:string; area:string; street:string;
  type:string; confidence?:number; buildingConfidence?:number; provider:string;
  houseNumber?:string; county?:string; name?:string; region?:string;
}
export type LookupStage = 'full'|'normalized'|'street'|'area'|'parent'|'neighborhood'|'routing';
function diagnostic(requestId:string,stage:LookupStage,start:number,status:number,count?:number) {
  // No keys, provider URLs, search text, destination coordinates or customer data.
  if(process.env.NODE_ENV !== 'test') console.info(JSON.stringify({event:'delivery_provider',requestId,provider:'Geoapify',stage,elapsedMs:Date.now()-start,status,candidateCount:count}));
}
async function providerJson(url:URL,stage:LookupStage,requestId:string,signal?:AbortSignal):Promise<any> {
  const start=Date.now(); let response:Response;
  try {response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000)});}
  catch {diagnostic(requestId,stage,start,0);throw new DeliveryQuoteError('The map service took too long to respond. Please try again.',504,'PROVIDER_TIMEOUT');}
  diagnostic(requestId,stage,start,response.status);
  if(response.status===401||response.status===403)throw new DeliveryQuoteError('The map service credentials need attention. Please contact the store or choose pickup.',503,'PROVIDER_AUTH');
  if(response.status===429)throw new DeliveryQuoteError('The map service is busy. Please wait a moment before trying again.',429,'PROVIDER_RATE_LIMIT');
  if(!response.ok)throw new DeliveryQuoteError('The map service is temporarily unavailable. Please retry or choose pickup.',502,'PROVIDER_UNAVAILABLE');
  try{return await response.json();}catch{throw new DeliveryQuoteError('The map service returned an unreadable response. Please retry.',502,'PROVIDER_RESPONSE');}
}
/** Both explicit format=json and GeoJSON responses are supported. Coordinates stay lon/lat at this boundary. */
export function parseGeocodingResponse(data:any):ProviderPlace[] {
  let entries:any[];
  if(Array.isArray(data?.results))entries=data.results;
  else if(Array.isArray(data?.features))entries=data.features.map((f:any)=>({...f.properties,lon:f.properties?.lon??f.geometry?.coordinates?.[0],lat:f.properties?.lat??f.geometry?.coordinates?.[1]}));
  else throw new DeliveryQuoteError('The map service returned an unexpected address response. Please retry.',502,'PROVIDER_RESPONSE');
  if(entries.length&&!entries.some(p=>validCoordinates(p?.lat,p?.lon)))throw new DeliveryQuoteError('The map service returned invalid location coordinates. Please retry.',502,'PROVIDER_RESPONSE');
  return entries.filter(p=>validCoordinates(p?.lat,p?.lon)).map(p=>({latitude:p.lat,longitude:p.lon,
    matchedAddress:typeof p.formatted==='string'?p.formatted:'',name:p.name||p.address_line1||p.formatted?.split(',')[0]||'',
    city:p.city||p.town||p.village||'',area:p.suburb||p.district||'',county:p.county||'',region:p.state_code==='IS'?'Islamabad Capital Territory':p.state||'',street:p.street||'',
    type:p.result_type||'unknown',confidence:Number.isFinite(p.rank?.confidence)?p.rank.confidence:undefined,
    buildingConfidence:Number.isFinite(p.rank?.confidence_building_level)?p.rank.confidence_building_level:undefined,
    provider:'Geoapify',houseNumber:p.housenumber}));
}
export async function geoapifySearch(text:string,key:string,store:{storeLatitude:number;storeLongitude:number},stage:LookupStage,requestId:string=randomUUID(),signal?:AbortSignal) {
  const url=new URL('https://api.geoapify.com/v1/geocode/search');
  // Bias helps ranking. It does not exclude valid streets or authorize delivery.
  url.search=new URLSearchParams({text,format:'json',limit:'8',filter:'countrycode:pk',bias:`proximity:${store.storeLongitude},${store.storeLatitude}`,apiKey:key}).toString();
  const start=Date.now(),places=parseGeocodingResponse(await providerJson(url,stage,requestId,signal));
  diagnostic(requestId,stage,start,200,places.length);
  return places;
}
export async function geoapifyRoadDistance(store:{storeLatitude:number;storeLongitude:number},destination:{latitude:number;longitude:number},requestId:string=randomUUID()) {
  if(!validCoordinates(store.storeLatitude,store.storeLongitude)||!validCoordinates(destination.latitude,destination.longitude))throw new DeliveryQuoteError('Delivery coordinates are invalid.',400,'INVALID_COORDINATES');
  const key=process.env.GEOAPIFY_ROUTING_KEY||process.env.GEOAPIFY_API_KEY||process.env.GEOAPIFY_GEOCODING_KEY;
  if(!key)throw new DeliveryQuoteError('Driving distance is not configured. Please contact the store or choose pickup.',503,'PROVIDER_CONFIGURATION');
  const url=new URL('https://api.geoapify.com/v1/routing');
  url.search=new URLSearchParams({waypoints:`${store.storeLatitude},${store.storeLongitude}|${destination.latitude},${destination.longitude}`,mode:'drive',units:'metric',apiKey:key}).toString();
  const data=await providerJson(url,'routing',requestId),route=data?.features?.[0]?.properties;
  if(!route||!Number.isFinite(route.distance)||route.distance<0||!Number.isFinite(route.time)||route.time<0||
    (route.distance_units&&!['meters','metres','m'].includes(route.distance_units)))throw new DeliveryQuoteError('We found the location but could not calculate its driving distance. Adjust the pin or retry. Store pickup is also available.',502,'ROUTE_NOT_FOUND');
  return {distanceKm:route.distance/1000,durationSeconds:route.time};
}

