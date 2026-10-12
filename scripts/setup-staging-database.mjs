import 'dotenv/config';
import {Client} from 'pg';
import {readFile} from 'node:fs/promises';
const migrations=['scripts/20261002_catalog_access.sql','scripts/20261002_secure_commerce.sql','scripts/20261011_confirm_kg_catalog.sql'];
const connection=process.env.STAGING_DATABASE_URL;
if(!connection){console.error('STAGING_DATABASE_URL is missing. Add a separate staging PostgreSQL connection to ignored .env.');process.exit(1);}
let target;try{target=new URL(connection);}catch{console.error('STAGING_DATABASE_URL is not a valid PostgreSQL URL.');process.exit(1);}
const liveRef='dlinknypnlmcrhgbediu';
if(!['postgres:','postgresql:'].includes(target.protocol)||decodeURIComponent(target.hostname+' '+target.username).includes(liveRef)){
 console.error('Refusing the known live project or an unsupported connection protocol. Use a separate staging database.');process.exit(1);
}
const local=['localhost','127.0.0.1','::1','[::1]'].includes(target.hostname);
const identifiableSupabase=/^db\.[a-z0-9]+\.supabase\.co$/.test(target.hostname)||(/\.pooler\.supabase\.com$/.test(target.hostname)&&/^postgres\.[a-z0-9]+$/.test(decodeURIComponent(target.username)));
if(!local&&!identifiableSupabase&&target.hostname!==process.env.STAGING_DATABASE_HOST){console.error('Custom staging hosts require STAGING_DATABASE_HOST to match the intended hostname.');process.exit(1);}
const client=new Client({connectionString:connection,connectionTimeoutMillis:10000,statement_timeout:60000});
try{
 await client.connect();
 const {rows}=await client.query("select to_regclass('public.products') is not null as products, to_regclass('public.secure_orders') is not null as orders, to_regprocedure('public.place_secure_order(jsonb)') is not null as checkout_rpc");
 console.log(JSON.stringify({stagingConnected:true,schema:rows[0],migrations}));
 if(!process.argv.includes('--apply')){console.log('Read-only preflight complete. Use --apply to install the listed migrations in this staging database.');}
 else{
  if(!rows[0].products)throw Object.assign(new Error(),{code:'STAGING_PRODUCTS_SCHEMA_REQUIRED'});
  for(const file of migrations){await client.query(await readFile(file,'utf8'));console.log(JSON.stringify({migration:file,applied:true}));}
  console.log('Staging schema installed. No customer orders or notifications were created.');
 }
}catch(error){console.error(JSON.stringify({event:'staging_database_setup_failed',code:/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'CONNECTION_OR_MIGRATION_FAILED'}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}
