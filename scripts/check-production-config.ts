import 'dotenv/config';
import {getDeliverySettings} from '../server/deliverySettings.js';
const secrets=['ORDER_ACCESS_SECRET','DELIVERY_QUOTE_SECRET','RATE_LIMIT_SECRET'];
const missing=secrets.filter(key=>(process.env[key]?.trim().length||0)<32);
if(!process.env.SUPABASE_URL?.trim())missing.push('SUPABASE_URL');
if(!(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim())missing.push('SUPABASE_SECRET_KEY');
if(!(process.env.GEOAPIFY_GEOCODING_KEY||process.env.GEOAPIFY_API_KEY)?.trim())missing.push('GEOAPIFY_GEOCODING_KEY');
if(!(process.env.GEOAPIFY_ROUTING_KEY||process.env.GEOAPIFY_API_KEY)?.trim())missing.push('GEOAPIFY_ROUTING_KEY');
process.env.NODE_ENV='production';let deliveryConfigured=false;
try {await getDeliverySettings();deliveryConfigured=true;}catch{}
const ready=missing.length===0&&deliveryConfigured;
console.log(JSON.stringify({ready,missingOrTooShort:missing,deliveryConfigured,note:'Environment-only check; no orders, database writes, provider calls or messages.'},null,2));
if(!ready)process.exitCode=1;
