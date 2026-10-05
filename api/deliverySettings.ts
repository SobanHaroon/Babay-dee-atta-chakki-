import { DeliveryQuoteError, type DeliverySettings } from './addressDelivery.js';
import { validCoordinates } from '../src/lib/mapbox.js';

/** Private configuration only. Environment coordinates must be verified against the storefront before deployment. */
export async function getDeliverySettings(dbClient?:any):Promise<DeliverySettings> {
  let row:any=null;
  if(dbClient&&!([process.env.STORE_LATITUDE,process.env.STORE_LONGITUDE,process.env.DELIVERY_RATE_PER_KM,process.env.DELIVERY_MAX_DISTANCE_KM].every(v=>v?.trim()))){
    try{
    const result=await dbClient.from('delivery_settings').select('store_latitude,store_longitude,price_per_km,max_delivery_distance_km,store_address,store_name').limit(1).abortSignal(AbortSignal.timeout(4000));
    if(!result.error)row=result.data?.[0];
    }catch{ /* Missing trusted settings are handled below without exposing provider details. */ }
  }
  const num=(value:unknown)=>value===undefined||value===null||value===''?NaN:Number(value);
  const storeLatitude=num(process.env.STORE_LATITUDE?.trim()||row?.store_latitude),storeLongitude=num(process.env.STORE_LONGITUDE?.trim()||row?.store_longitude);
  const pricePerKm=num(process.env.DELIVERY_RATE_PER_KM?.trim()||row?.price_per_km),maxDeliveryDistanceKm=num(process.env.DELIVERY_MAX_DISTANCE_KM?.trim()||row?.max_delivery_distance_km);
  // Rs.50 minimum and nearest-rupee rounding preserve the existing fee function.
  const minDeliveryFee=num(process.env.DELIVERY_MIN_FEE??50);
  let serviceRegion:DeliverySettings['serviceRegion'];
  if(process.env.DELIVERY_SERVICE_BOUNDS){
    const values=process.env.DELIVERY_SERVICE_BOUNDS.split(',').map(Number);
    if(values.length!==4||values.some(v=>!Number.isFinite(v)))throw new DeliveryQuoteError('Delivery service-area configuration needs attention. Please choose pickup.',503,'DELIVERY_CONFIGURATION');
    const [south,west,north,east]=values;
    if(!validCoordinates(south,west)||!validCoordinates(north,east)||south>=north||west>=east)throw new DeliveryQuoteError('Delivery service-area configuration needs attention. Please choose pickup.',503,'DELIVERY_CONFIGURATION');
    serviceRegion={south,west,north,east};
  }
  if(!validCoordinates(storeLatitude,storeLongitude)||!Number.isFinite(pricePerKm)||pricePerKm<=0||!Number.isFinite(maxDeliveryDistanceKm)||maxDeliveryDistanceKm<=0||!Number.isFinite(minDeliveryFee)||minDeliveryFee<0||(process.env.NODE_ENV==='production'&&!serviceRegion)){
    throw new DeliveryQuoteError('Delivery configuration needs attention. Please contact the store or choose pickup.',503,'DELIVERY_CONFIGURATION');
  }
  if(serviceRegion&&(storeLatitude<serviceRegion.south||storeLatitude>serviceRegion.north||storeLongitude<serviceRegion.west||storeLongitude>serviceRegion.east))throw new DeliveryQuoteError('The store pin is outside the configured delivery area. Please choose pickup.',503,'DELIVERY_CONFIGURATION');
  return {storeLatitude,storeLongitude,pricePerKm,maxDeliveryDistanceKm,minDeliveryFee,feeRounding:'nearest-rupee',pricingVersion:process.env.DELIVERY_PRICING_VERSION||'existing-pricing-v1',serviceRegion,
    storeName:process.env.STORE_NAME||row?.store_name||'Babay Dee Atta Chakki',storeAddress:process.env.STORE_ADDRESS||row?.store_address||''};
}
