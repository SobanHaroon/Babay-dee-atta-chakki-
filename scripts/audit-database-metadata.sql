-- READ ONLY. Run with a trusted SQL connection in staging, then production audit.
-- Returns schema/authorization metadata only, never customer table contents.
begin transaction read only;
select table_schema,table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema in ('public','storage')
order by table_schema,table_name,ordinal_position;
select n.nspname schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m');
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage');
select table_schema,table_name,grantee,privilege_type,is_grantable
from information_schema.role_table_grants where table_schema in ('public','storage');
select table_schema,table_name,column_name,grantee,privilege_type
from information_schema.role_column_grants where table_schema in ('public','storage');
select routine_schema,routine_name,grantee,privilege_type
from information_schema.routine_privileges where routine_schema in ('public','storage');
select n.nspname,p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid) arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
select schemaname,viewname,definition from pg_views where schemaname='public';
select schemaname,matviewname,definition from pg_matviews where schemaname='public';
select pubname,schemaname,tablename from pg_publication_tables;
-- Bucket configuration contains no customer object rows or object names.
select id,public,file_size_limit,allowed_mime_types from storage.buckets;
rollback;
