const fs=require('node:fs');let f='api/addressDelivery.ts',s=fs.readFileSync(f,'utf8');
s=s.replace('requestId?:string;confirmedPin?', 'requestId?:string;candidateToken?:string;confirmedPin?');
const at=s.indexOf('export async function createDeliveryQuote');
s=s.slice(0,at)+`function signCandidate(candidate:AddressMatch,address:string,settings:DeliverySettings,context:QuoteContext){
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
`+s.slice(at);
s=s.replace("    match={...p,matchedAddress:'Customer-confirmed map pin',type:'pin',city:'',area:'',street:'',provider:'Customer pin'};", "    const candidate=options.candidateToken?readCandidate(options.candidateToken,address,settings,options):undefined;\n    match={...p,matchedAddress:candidate?.matchedAddress||'Customer-confirmed map pin',type:'pin',city:candidate?.city||'',area:candidate?.area||'',street:candidate?.street||'',provider:'Customer pin'};");
s=s.replace("    if(!['building','address'].includes(match.type))return {success:true,requiresPinConfirmation:true as const,requestId,candidate:{...match,precision:match.type},candidates:candidates.map(p=>({...p,precision:p.type})),checkoutContext:options.checkoutContext,addressVersion:options.addressVersion};", "    if(!['building','address'].includes(match.type)){\n      const optionsWithTokens=candidates.map(p=>({...p,precision:p.type,candidateToken:signCandidate(p,address,settings,options)}));\n      return {success:true,requiresPinConfirmation:true as const,requestId,candidate:optionsWithTokens[0],candidates:optionsWithTokens,checkoutContext:options.checkoutContext,addressVersion:options.addressVersion};\n    }");
fs.writeFileSync(f,s);
f='api/index.ts';s=fs.readFileSync(f,'utf8').replace('confirmedPin:req.body.confirmedPin,requestId:', 'confirmedPin:req.body.confirmedPin,candidateToken:req.body.candidateToken,requestId:');fs.writeFileSync(f,s);
f='src/lib/deliveryCheckout.ts';s=fs.readFileSync(f,'utf8').replace('precision:string;confidence?', 'precision:string;candidateToken?:string;confidence?');fs.writeFileSync(f,s);
f='src/components/CheckoutMultiStepForm.tsx';s=fs.readFileSync(f,'utf8').replace('addressVersion:version,confirmedPin})','addressVersion:version,confirmedPin,candidateToken:confirmedPin?stateRef.current.candidate?.candidateToken:undefined})');fs.writeFileSync(f,s);
f='api/deliverySettings.ts';s=fs.readFileSync(f,'utf8').replace('  if(dbClient){','  if(dbClient&&!([process.env.STORE_LATITUDE,process.env.STORE_LONGITUDE,process.env.DELIVERY_RATE_PER_KM,process.env.DELIVERY_MAX_DISTANCE_KM].every(v=>v?.trim()))){\n    try{').replace('if(!result.error)row=result.data?.[0];','if(!result.error)row=result.data?.[0];\n    }catch{ /* Missing trusted settings are handled below without exposing provider details. */ }');
for(const [env,column] of [['STORE_LATITUDE','store_latitude'],['STORE_LONGITUDE','store_longitude'],['DELIVERY_RATE_PER_KM','price_per_km'],['DELIVERY_MAX_DISTANCE_KM','max_delivery_distance_km']])s=s.replace(`process.env.${env}??row?.${column}`,`process.env.${env}?.trim()||row?.${column}`);
fs.writeFileSync(f,s);
f='vercel.json';const config=JSON.parse(fs.readFileSync(f,'utf8'));config.functions={'api/index.ts':{maxDuration:60}};fs.writeFileSync(f,JSON.stringify(config,null,2)+'\n');
