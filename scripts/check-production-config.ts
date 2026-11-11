import 'dotenv/config';
const secrets=['ORDER_ACCESS_SECRET','RATE_LIMIT_SECRET'];
const missing=secrets.filter(key=>(process.env[key]?.trim().length||0)<32);
if(!process.env.SUPABASE_URL?.trim())missing.push('SUPABASE_URL');
if(!(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim())missing.push('SUPABASE_SECRET_KEY');
const ready=missing.length===0;
console.log(JSON.stringify({ready,missingOrTooShort:missing,note:'Environment-only check; no orders, database writes, provider calls or messages.'},null,2));
if(!ready)process.exitCode=1;
