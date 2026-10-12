import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const products=await db.from('products').select('id,"product name",price,quantity,"Retail price","Product Category"').order('id').limit(1000);
console.log(JSON.stringify({error:products.error?.code,products:products.data},null,2));
const settings=await db.from('delivery_settings').select('"store name","store latitude","store longitude","price per kilometer","max delivery distance km","minimum delivery charge"').limit(1);
console.log(JSON.stringify({settings:settings.data,error:settings.error?.code}));
for(const table of ['secure_orders','customer_reviews','api_rate_limits']){const r=await db.from(table).select('id').limit(0);console.log(JSON.stringify({table,status:r.status,error:r.error?.code,message:r.error?.message}));}
