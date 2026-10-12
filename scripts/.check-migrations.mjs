import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
try {
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table products(id bigint primary key,"product name" text,price text,quantity text);');
 for(const file of ['scripts/20261002_catalog_access.sql','scripts/20261002_secure_commerce.sql']){
  try{await db.exec(await readFile(file,'utf8'));console.log(JSON.stringify({migration:file,success:true}));}
  catch(e){console.log(JSON.stringify({migration:file,code:e.code,message:e.message}));break;}
 }
}finally{await db.close();}
