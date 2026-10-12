const fs=require('fs');const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));
edit('api/geoapify.ts',s=>s.replace("|'routing';","|'routing'|'service-area';")+`
/** Verify the destination's administrative area; never compare house/street text. */
export async function geoapifyServiceArea(destination:{latitude:number;longitude:number},allowed:string[],requestId:string) {
  const key=process.env.GEOAPIFY_GEOCODING_KEY||process.env.GEOAPIFY_API_KEY;
  if(!key)throw new DeliveryQuoteError('Delivery-area verification is not configured. Please choose pickup.',503,'PROVIDER_CONFIGURATION');
  const url=new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.search=new URLSearchParams({lat:String(destination.latitude),lon:String(destination.longitude),type:'city',format:'json',lang:'en',limit:'1',apiKey:key}).toString();
  const data=await providerJson(url,'service-area',requestId);
  const p=Array.isArray(data?.results)?data.results[0]:data?.features?.[0]?.properties;
  if(!p||typeof p.country_code!=='string')throw new DeliveryQuoteError('We could not verify the delivery area for this pin. Adjust the pin or try again.',502,'SERVICE_AREA_UNVERIFIED');
  const normalize=(value:unknown)=>String(value||'').toLowerCase().replace(/ district$| capital territory$/g,'').trim();
  const areas=[p.city,p.county,p.state].map(normalize);
  const area=allowed.find(name=>areas.includes(normalize(name)));
  if(p.country_code.toLowerCase()!=='pk'||!area)throw new DeliveryQuoteError('We deliver in Rawalpindi and Islamabad within the configured road-distance limit. Please choose a location in these areas or store pickup.',422,'OUT_OF_AREA');
  return area;
}
`);
edit('api/addressDelivery.ts',s=>s.replace('geoapifyRoadDistance,','geoapifyRoadDistance, geoapifyServiceArea,').replace('  serviceRegion?:','  serviceAreas?:string[];\n  serviceRegion?:').replace('s.serviceRegion??null]','s.serviceRegion??null,s.serviceAreas??null]').replace("if(!b)return process.env.NODE_ENV!=='production';","if(!b)return !!s.serviceAreas?.length || process.env.NODE_ENV!=='production';").replace('sourcePrecision:quote.sourcePrecision,','sourcePrecision:quote.sourcePrecision,serviceArea:quote.serviceArea,').replace("if(q.checkoutContext!==undefined", "if(settings.serviceAreas?.length&&!settings.serviceAreas.includes(q.serviceArea))throw invalid();\n  if(q.checkoutContext!==undefined").replace('  const route=await geoapifyRoadDistance(settings,match,requestId);','  const serviceArea=settings.serviceAreas?.length?await geoapifyServiceArea(match,settings.serviceAreas,requestId):undefined;\n  const route=await geoapifyRoadDistance(settings,match,requestId);').replace('const quote={success:true,deliverable:true,','const quote={success:true,deliverable:true,serviceArea,'));
edit('api/deliverySettings.ts',s=>s.replace("  let serviceRegion:","  const serviceAreas=process.env.DELIVERY_SERVICE_AREAS?.split(',').map(v=>v.trim()).filter(Boolean);\n  if(serviceAreas?.some(area=>!['Rawalpindi','Islamabad'].includes(area)))throw new DeliveryQuoteError('Delivery service-area configuration needs attention.',503,'DELIVERY_CONFIGURATION');\n  let serviceRegion:").replace("process.env.NODE_ENV==='production'&&!serviceRegion","process.env.NODE_ENV==='production'&&!serviceRegion&&!serviceAreas?.length").replace('pricing-v1\',serviceRegion,',"pricing-v1',serviceRegion,serviceAreas,"));
edit('scripts/delivery-settings.test.ts',s=>s.replace("'DELIVERY_SERVICE_BOUNDS']","'DELIVERY_SERVICE_BOUNDS','DELIVERY_SERVICE_AREAS']"));
edit('.env.example',s=>s.replace('DELIVERY_MAX_DISTANCE_KM=45','DELIVERY_MAX_DISTANCE_KM=30').replace('existing-pricing-v1','owner-confirmed-2026-10-11').replace('# Required in production: owner-approved south,west,north,east rectangle.','# Approved administrative areas, verified server-side from the destination pin.\nDELIVERY_SERVICE_AREAS=Rawalpindi,Islamabad\n# Optional additional owner-approved south,west,north,east rectangle.').replace('STORE_LATITUDE=','STORE_LATITUDE=33.567341').replace('STORE_LONGITUDE=','STORE_LONGITUDE=73.1044791')+'\n# Staging database only; never use the live project here. Used by db:staging.\nSTAGING_DATABASE_URL=\n');
