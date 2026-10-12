import { createClient } from '@supabase/supabase-js';

/** Public configuration aliases support older deployments; privileged keys never come from VITE_. */
export function databaseClients(env: Record<string,string|undefined> = process.env) {
  const first=(...names:string[])=>names.map(name=>env[name]?.trim()).find(Boolean);
  const url=first('SUPABASE_URL','VITE_SUPABASE_URL');
  const privateKey=first('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY');
  const publicKey=first('SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_ANON_KEY');
  const client=(key:string|undefined)=>{
    if(!url||!key)return null;
    try {return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
    catch {console.warn(JSON.stringify({event:'database_configuration_invalid'}));return null;}
  };
  const privileged=client(privateKey);
  return {privileged,catalog:privileged||client(publicKey)};
}
