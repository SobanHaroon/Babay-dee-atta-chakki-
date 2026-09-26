-- Apply after configuring the server-only Supabase service-role/secret key.
-- The storefront reads products using the public key; orders go through the API.
-- This deliberately removes direct browser access to customer order data.
begin;
alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
grant select, insert, update, delete on table public.orders to service_role;
commit;
