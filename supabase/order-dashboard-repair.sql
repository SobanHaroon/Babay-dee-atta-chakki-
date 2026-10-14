-- Run in the existing application project after staging verification.
-- Installs the bridge and repairs ONLY the order the owner identified.
-- No second checkout, stock deduction, customer SMS or email. Queues one store alert.
-- Additive compatibility bridge. Existing orders are not backfilled automatically.
begin;

create table if not exists public.order_dashboard_links (
  secure_order_id text primary key references public.secure_orders(id),
  legacy_row_id bigint not null unique references public.orders(id),
  legacy_order_id integer not null unique
);
create table if not exists public.staff_notification_outbox (
  order_id text primary key references public.secure_orders(id),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table public.order_dashboard_links enable row level security;
alter table public.staff_notification_outbox enable row level security;
revoke all on public.order_dashboard_links,public.staff_notification_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.order_dashboard_links,public.staff_notification_outbox to service_role;
grant select,insert on public.orders to service_role;
-- The legacy table uses an identity/serial id; grant only its own sequence.
do $$ declare s text; begin
 s:=pg_get_serial_sequence('public.orders','id');
 if s is not null then execute format('grant usage,select on sequence %s to service_role',s); end if;
end $$;

create or replace function public.project_order_to_dashboard(p_order_id text)
returns integer language plpgsql security invoker set search_path='' as $$
declare d jsonb; stamp timestamptz; n integer; row_id bigint; meta jsonb;
begin
 -- Lock the source before the destination in every caller. No stock changes here.
 select document,created_at into strict d,stamp from public.secure_orders where id=p_order_id for update;
 select legacy_order_id into n from public.order_dashboard_links where secure_order_id=p_order_id;
 if found then return n; end if;
 -- Serialize with other legacy inserts while allocating an integer dashboard ID.
 lock table public.orders in share row exclusive mode;
 select greatest(100000,coalesce(max("order id"),99999)+1) into n from public.orders;
 meta:=jsonb_build_object(
  'secureOrderId',p_order_id,'address',d->'customer'->'address','fulfillmentType',d->'fulfillmentType',
  'city',d->'customer'->'city','area',d->'customer'->'area','email',d->'customer'->'email',
  'deliveryDetails',d->'deliveryDetails','paymentMethod',d->'paymentMethod',
  'subtotal',d->'subtotal','deliveryCharges',d->'deliveryCharges','discount',d->'discount','total',d->'total',
  'deliveryDate',d->'deliveryDate','deliverySlot',d->'deliverySlot','status',d->'status',
  'statusHistory',d->'statusHistory','latitude',d->'customer'->'latitude','longitude',d->'customer'->'longitude',
  'distanceKm',d->'deliveryDetails'->'distanceKm','items',d->'items');
 insert into public.orders(created_at,"order id","customer name","contact number","customer address",date,time,
   "Price","Delivery charges","Order pricing","delivery latitude","delivery longitude","Order status")
 values(stamp,n,d->'customer'->>'name',d->'customer'->>'phone',
   coalesce(d->'customer'->>'address','')||' | METADATA:'||meta::text,
   (stamp at time zone 'UTC')::date,(to_char(stamp at time zone 'UTC','HH24:MI:SS')||'+00')::timetz,
   (d->>'total')::numeric,(d->>'deliveryCharges')::numeric,(d->>'subtotal')::numeric,
   (d->'customer'->>'latitude')::double precision,(d->'customer'->>'longitude')::double precision,lower(d->>'status'))
 returning id into row_id;
 insert into public.order_dashboard_links values(p_order_id,row_id,n);
 insert into public.staff_notification_outbox(order_id) values(p_order_id) on conflict do nothing;
 return n;
end $$;

create or replace function public.on_secure_order_created()
returns trigger language plpgsql security invoker set search_path='' as $$
begin perform public.project_order_to_dashboard(new.id); return new; end $$;
drop trigger if exists secure_order_dashboard on public.secure_orders;
create trigger secure_order_dashboard after insert on public.secure_orders for each row execute function public.on_secure_order_created();

-- Status changes made in the owner's separate dashboard also reach token-protected tracking.
create or replace function public.sync_dashboard_order_status()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s text;
begin
 s:=case lower(trim(new."Order status")) when 'order placed' then 'Order Placed' when 'confirmed' then 'Confirmed'
 when 'processing' then 'Processing' when 'preparing' then 'Preparing' when 'out for delivery' then 'Out for Delivery'
 when 'delivered' then 'Delivered' when 'cancelled' then 'Cancelled' when 'canceled' then 'Cancelled' else null end;
 if s is not null then
 update public.secure_orders o set document=jsonb_set(jsonb_set(o.document,'{status}',to_jsonb(s)),
  '{statusHistory}',coalesce(o.document->'statusHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object('status',s,'time',now(),'detail','Updated by store.')))
 from public.order_dashboard_links l where l.legacy_row_id=new.id and l.secure_order_id=o.id and o.document->>'status' is distinct from s;
 end if;
 return new;
end $$;
drop trigger if exists dashboard_order_status on public.orders;
create trigger dashboard_order_status after update of "Order status" on public.orders for each row
 when (old."Order status" is distinct from new."Order status") execute function public.sync_dashboard_order_status();

create or replace function public.claim_staff_notification(p_order_id text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.staff_notification_outbox%rowtype; n integer; d jsonb;
begin
 select * into job from public.staff_notification_outbox where sent_at is null and attempts<12
 and next_attempt_at<=now() and (lease_until is null or lease_until<now())
 and (p_order_id is null or order_id=p_order_id) order by next_attempt_at limit 1 for update skip locked;
 if not found then return null; end if;
 update public.staff_notification_outbox set attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds'
 where order_id=job.order_id returning * into job;
 select legacy_order_id into strict n from public.order_dashboard_links where secure_order_id=job.order_id;
 select document into strict d from public.secure_orders where id=job.order_id;
 -- No names, phones, addresses, order access tokens or payment secrets leave this RPC.
 return jsonb_build_object('orderId',job.order_id,'legacyOrderId',n,'leaseToken',job.lease_token,
 'total',d->'total','fulfillmentType',d->'fulfillmentType','deliveryDate',d->'deliveryDate','deliverySlot',d->'deliverySlot');
end $$;
create or replace function public.finish_staff_notification(p_order_id text,p_lease_token uuid,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare done text;
begin
 update public.staff_notification_outbox set sent_at=case when p_error is null then now() else null end,
 last_error=case when p_error is null then null else left(p_error,80) end,lease_until=null,lease_token=null,
 next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,least(attempts,7)))::integer))
 where order_id=p_order_id and lease_token=p_lease_token and sent_at is null returning order_id into done;
 return done is not null;
end $$;
revoke all on function public.project_order_to_dashboard(text),public.on_secure_order_created(),public.sync_dashboard_order_status(),public.claim_staff_notification(text),public.finish_staff_notification(text,uuid,text) from public,anon,authenticated;
grant execute on function public.project_order_to_dashboard(text),public.on_secure_order_created(),public.sync_dashboard_order_status(),public.claim_staff_notification(text),public.finish_staff_notification(text,uuid,text) to service_role;
-- Versioned RPC prevents an application deploy from silently using an older unbridged schema.
create or replace function public.place_store_order(p_order jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=public.place_secure_order(p_order);
 perform public.project_order_to_dashboard(result->'record'->>'id');
 return result;
end $$;
revoke all on function public.place_store_order(jsonb) from public,anon,authenticated;
grant execute on function public.place_store_order(jsonb) to service_role;
notify pgrst,'reload schema';

-- This block is deliberately absent from the general checkout setup bundle.
do $$ begin
 if exists(select 1 from public.secure_orders where id='BDEC-4ffb08f183424cbdb554fb91efdc986e') then
  perform public.project_order_to_dashboard('BDEC-4ffb08f183424cbdb554fb91efdc986e');
 end if;
end $$;
commit;
