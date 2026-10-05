-- Additive migration. Review/apply to an isolated staging database first.
-- Requires 20261002_catalog_access.sql and owner-reviewed sale_unit/stock_quantity.
-- Does NOT modify/backfill legacy orders or infer inventory/pack sizes.
begin;

create table if not exists public.secure_orders (
  id text primary key check (id ~ '^BDEC-[a-f0-9]{32}$'),
  document jsonb not null,
  checkout_context uuid not null unique,
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  order_access_hash text not null check (order_access_hash ~ '^[a-f0-9]{64}$'),
  access_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  receipt_last_sent_at timestamptz,
  receipt_day date,
  receipt_count integer not null default 0,
  unique (checkout_context, idempotency_key)
);
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  rating integer not null check (rating between 1 and 5),
  city text not null default '' check (length(city) <= 100),
  review text not null check (length(review) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  verified_purchase boolean not null default false,
  is_synthetic boolean not null default false,
  order_id text references public.secure_orders(id),
  created_at timestamptz not null default now(),
  check (not verified_purchase or order_id is not null)
);
create unique index if not exists one_review_per_order on public.customer_reviews(order_id) where order_id is not null;
create table if not exists public.api_rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
create index if not exists api_rate_limit_expiry on public.api_rate_limits(expires_at);

alter table public.secure_orders enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.api_rate_limits enable row level security;
revoke all on public.secure_orders, public.customer_reviews, public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.secure_orders, public.customer_reviews, public.api_rate_limits to service_role;
grant select, update (stock_quantity) on public.products to service_role;

create or replace function public.consume_api_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_expiry timestamptz;
begin
  if length(p_key) > 100 or p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 3600 then raise exception 'INVALID_LIMIT'; end if;
  delete from public.api_rate_limits where key in (select key from public.api_rate_limits where expires_at < now() limit 100);
  insert into public.api_rate_limits as limits(key,count,expires_at)
  values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set
    count=case when limits.expires_at <= now() then 1 else limits.count+1 end,
    expires_at=case when limits.expires_at <= now() then now()+make_interval(secs=>p_window_seconds) else limits.expires_at end
  returning count,expires_at into v_count,v_expiry;
  return jsonb_build_object('allowed',v_count<=p_limit,'retry_after',greatest(1,ceil(extract(epoch from (v_expiry-now())))));
end $$;

create or replace function public.place_secure_order(p_order jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.secure_orders%rowtype;
  v_item jsonb; v_product jsonb; v_document jsonb; v_items jsonb := '[]'::jsonb;
  v_quantity numeric; v_price numeric; v_subtotal numeric := 0; v_fee numeric;
  v_unit text; v_name text; v_seen text[] := '{}';
begin
  if jsonb_typeof(p_order->'document'->'items') <> 'array' or jsonb_array_length(p_order->'document'->'items') not between 1 and 50 then raise exception 'INVALID_CART'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_order->>'checkout_context',0));
  select * into v_existing from public.secure_orders where checkout_context=(p_order->>'checkout_context')::uuid;
  if found then
    if v_existing.request_hash <> p_order->>'request_hash' or v_existing.idempotency_key <> p_order->>'idempotency_key' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('record',to_jsonb(v_existing),'created',false);
  end if;
  for v_item in select value from jsonb_array_elements(p_order->'document'->'items') order by value->>'id' loop
    if v_item->>'id'=any(v_seen) then raise exception 'INVALID_CART'; end if;
    v_seen := array_append(v_seen,v_item->>'id');
    select to_jsonb(p) into strict v_product from public.products p where p.id::text=v_item->>'id' for update;
    v_unit := v_product->>'sale_unit';
    v_quantity := (v_item->>'quantity')::numeric;
    if v_unit is null or v_unit not in ('kg','pack') or v_product->>'stock_quantity' is null or v_quantity <= 0 or v_quantity > 100
      or (v_unit='pack' and (v_quantity<>trunc(v_quantity) or coalesce((v_product->>'pack_weight_kg')::numeric,0)<=0))
      or (v_unit='kg' and v_quantity*10<>trunc(v_quantity*10))
      or (v_product->>'stock_quantity')::numeric<v_quantity then raise exception 'STOCK_CHANGED'; end if;
    if lower(coalesce(v_product->>'out_of_stock','false'))='true' or lower(coalesce(v_product->>'status','')) in ('out of stock','out-of-stock','sold out') then raise exception 'STOCK_CHANGED'; end if;
    if replace(v_product->>'price',',','') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'PRICE_CHANGED'; end if;
    v_price := replace(v_product->>'price',',','')::numeric;
    if v_price<=0 or v_price<>(v_item->>'price')::numeric then raise exception 'PRICE_CHANGED'; end if;
    v_name := coalesce(v_product->>'product name',v_product->>'name','');
    if nullif(v_product->>'variant_label','') is not null then v_name:=v_name||' — '||(v_product->>'variant_label'); end if;
    v_items := v_items || jsonb_build_array(v_item || jsonb_build_object('name',v_name,'price',v_price,'unit',case when v_unit='kg' then 'Kg' else 'Pack' end,'saleUnit',v_unit,'packWeightKg',v_product->'pack_weight_kg'));
    v_subtotal := v_subtotal + v_price*v_quantity;
    update public.products set stock_quantity=stock_quantity-v_quantity where id::text=v_item->>'id';
  end loop;
  v_subtotal:=round(v_subtotal,2);
  v_fee := (p_order->'document'->>'deliveryCharges')::numeric;
  if v_fee is null or v_fee<0 or v_fee>100000 or v_fee<>round(v_fee,2) then raise exception 'INVALID_FEE'; end if;
  if p_order->'document'->>'fulfillmentType'='pickup' then v_fee:=0; end if;
  v_document := p_order->'document' || jsonb_build_object('items',v_items,'subtotal',v_subtotal,'deliveryCharges',v_fee,'discount',0,'total',v_subtotal+v_fee,'status','Order Placed','paymentStatus','unpaid');
  insert into public.secure_orders(id,document,checkout_context,idempotency_key,request_hash,order_access_hash,access_expires_at)
  values(p_order->>'id',v_document,(p_order->>'checkout_context')::uuid,p_order->>'idempotency_key',p_order->>'request_hash',p_order->>'order_access_hash',(p_order->>'access_expires_at')::timestamptz)
  returning * into v_existing;
  return jsonb_build_object('record',to_jsonb(v_existing),'created',true);
exception when no_data_found or too_many_rows then raise exception 'STOCK_CHANGED';
end $$;

create or replace function public.claim_order_receipt(p_order_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_id text;
begin
  update public.secure_orders set receipt_last_sent_at=now(),receipt_day=current_date,
    receipt_count=case when receipt_day=current_date then receipt_count+1 else 1 end
  where id=p_order_id and (receipt_last_sent_at is null or receipt_last_sent_at < now()-interval '10 minutes')
    and (receipt_day is null or receipt_day<>current_date or receipt_count<3)
  returning id into v_id;
  return v_id is not null;
end $$;

revoke all on function public.consume_api_rate_limit(text,integer,integer),public.place_secure_order(jsonb),public.claim_order_receipt(text) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer),public.place_secure_order(jsonb),public.claim_order_receipt(text) to service_role;
commit;
