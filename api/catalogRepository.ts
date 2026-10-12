import { normalizeCatalog } from './catalog.js';
import { CommerceError } from './commerce.js';

const columns=['id','product name','price','quantity','place','Product Category','Product Images','sale_unit','stock_quantity','pack_weight_kg','variant_label'];
const optional=new Set(columns.slice(3));
function missingOptional(error:any):string|undefined {
  if(!['42703','PGRST204'].includes(error?.code))return;
  const message=String(error.message||'');
  const field=message.match(/column (?:[\w]+\.)?"?([^"\n]+?)"? does not exist/i)?.[1]
    ||message.match(/Could not find the '([^']+)' column of 'products'/i)?.[1];
  return field&&optional.has(field)?field:undefined;
}
const projection=(names:string[])=>names.map(name=>/\s/.test(name)?`"${name}"`:name).join(',');

/** Read current rows, with a bounded schema compatibility path. Never select private columns. */
export function createCatalogLoader(db:any) {
  let supported=[...columns],schemaUntil=0;
  return async ()=>{
    if(!db)throw new CommerceError('The catalog connection needs attention. Please try again shortly.',503,'CATALOG_CONFIGURATION');
    const selected=Date.now()<schemaUntil?[...supported]:[...columns];
    const deadline=Date.now()+10000;
    try {
      for(let attempt=0;attempt<=optional.size;attempt++) {
        const remaining=deadline-Date.now();if(remaining<=0)throw new Error('timeout');
        const {data,error}=await db.from('products').select(projection(selected)).order('id',{ascending:true}).limit(1000).abortSignal(AbortSignal.timeout(Math.min(5000,remaining)));
        if(!error&&Array.isArray(data)) {supported=[...selected];schemaUntil=Date.now()+60000;return normalizeCatalog(data);}
        const absent=missingOptional(error);
        if(absent&&selected.includes(absent)) {selected.splice(selected.indexOf(absent),1);continue;}
        console.warn(JSON.stringify({event:'catalog_read_failed',code:/^[A-Z0-9]{3,12}$/.test(error?.code||'')?error.code:'UPSTREAM_RESPONSE'}));
        throw new CommerceError('The catalog is temporarily unavailable. Please retry shortly.',503,'CATALOG_UNAVAILABLE');
      }
    }catch(error){
      if(error instanceof CommerceError)throw error;
      console.warn(JSON.stringify({event:'catalog_read_failed',code:'CONNECTION_OR_TIMEOUT'}));
    }
    throw new CommerceError('The catalog is temporarily unavailable. Please retry shortly.',503,'CATALOG_UNAVAILABLE');
  };
}
