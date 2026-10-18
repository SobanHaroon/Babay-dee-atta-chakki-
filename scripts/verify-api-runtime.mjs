// Exercise emitted ESM with plain Node, without tsx/Vite masking runtime import errors.
import {build} from 'esbuild';
import {readdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve('artifacts/catalog-runtime');
await build({entryPoints:['api/index.ts',...(await readdir('server')).filter(f=>f.endsWith('.ts')).map(f=>'server/'+f),'src/types.ts','src/deliveryData.ts','src/lib/orderReceipt.ts','src/lib/orderAccess.ts','src/lib/commerce.ts','src/lib/mapbox.ts'],outbase:'.',outdir:root,platform:'node',format:'esm',bundle:false,logLevel:'silent'});
await writeFile(path.join(root,'package.json'),JSON.stringify({type:'module'}));
await writeFile(path.join(root,'empty.env'),'');
const script=`import app from './api/index.js'; const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/health');if(r.status!==200)throw Error('Health failed');console.log('Native ESM production startup and health passed');}finally{server.closeAllConnections();server.close();}`;
execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'production',DOTENV_CONFIG_PATH:path.join(root,'empty.env'),SUPABASE_URL:'invalid-url',SUPABASE_SECRET_KEY:'synthetic-invalid-config',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_ANON_KEY:'',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',VITE_SUPABASE_ANON_KEY:'',ENABLE_CUSTOMER_NOTIFICATIONS:'false'}});
