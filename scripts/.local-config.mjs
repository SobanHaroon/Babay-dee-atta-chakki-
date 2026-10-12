import dotenv from 'dotenv';import {readFileSync,writeFileSync} from 'node:fs';import{randomBytes}from'node:crypto';dotenv.config({quiet:true});
let env=readFileSync('.env','utf8');const values={STORE_LATITUDE:'33.567341',STORE_LONGITUDE:'73.1044791',DELIVERY_RATE_PER_KM:'50',DELIVERY_MIN_FEE:'50',DELIVERY_MAX_DISTANCE_KM:'30',DELIVERY_PRICING_VERSION:'owner-confirmed-2026-10-11',DELIVERY_SERVICE_AREAS:'Rawalpindi,Islamabad'};
for(const key of ['ORDER_ACCESS_SECRET','DELIVERY_QUOTE_SECRET','RATE_LIMIT_SECRET'])if(!process.env[key]?.trim())values[key]=randomBytes(32).toString('hex');
for(const [key,value]of Object.entries(values)){const pattern=new RegExp('^'+key+'=.*$','m');env=pattern.test(env)?env.replace(pattern,key+'='+value):env.trimEnd()+'\n'+key+'='+value+'\n';}
writeFileSync('.env',env);console.log('Saved confirmed store/pricing settings and independent private signing keys to ignored .env; no values printed.');
