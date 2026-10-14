import 'dotenv/config';
import {databaseClients} from '../api/database.js';

// Read-only schema probes: limit(0) never returns product/customer/order records.
const {privileged:db}=databaseClients();
if(!db){console.error(JSON.stringify({ready:false,code:'DATABASE_CONFIGURATION'}));process.exit(1);}
const checks=await Promise.all([
 ['secure_orders','id,document,checkout_context,idempotency_key,request_hash,order_access_hash,access_expires_at'],
 ['order_dashboard_links','secure_order_id,legacy_row_id,legacy_order_id'],
 ['staff_notification_outbox','order_id,attempts,sent_at,lease_until'],
 ['customer_reviews','id,status,verified_purchase,is_synthetic'],
 ['api_rate_limits','key,count,expires_at'],
 ['products','id,sale_unit,stock_quantity,pack_weight_kg'],
].map(async([table,columns])=>{
 const {status,error}=await db.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(10000));
 return {table,ready:!error,status,code:error?.code&&/^[A-Z0-9]+$/.test(error.code)?error.code:null};
}));
const secrets=['ORDER_ACCESS_SECRET','DELIVERY_QUOTE_SECRET','RATE_LIMIT_SECRET'].map(name=>({name,configured:(process.env[name]?.length||0)>=32}));
const ready=checks.every(c=>c.ready)&&secrets.every(c=>c.configured);
console.log(JSON.stringify({schemaAndSigningReady:ready,checks,secrets,note:'Read-only checks. Does not create an order or verify hosted RPC permissions, route providers or notification delivery.'},null,2));
if(!ready)process.exitCode=1;
