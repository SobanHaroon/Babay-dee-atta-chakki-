-- Owner confirmed 2026-10-11: prices are per kg; legacy quantity / 10 is kg stock.
-- Staging first. Requires both 20261002 migrations. Does not change prices/orders.
begin;

create or replace function public.sync_catalog_inventory()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_legacy numeric; v_quantity_changed boolean; v_stock_changed boolean;
begin
  if new.sale_unit is null then new.sale_unit := 'kg'; end if;
  if new.sale_unit <> 'kg' then return new; end if;
  if replace(btrim(new.quantity),',','') ~ '^[0-9]+(\.[0-9]+)?$' then
    v_legacy := replace(btrim(new.quantity),',','')::numeric / 10;
  end if;
  if tg_op = 'INSERT' then
    if new.stock_quantity is null then new.stock_quantity := v_legacy;
    else new.quantity := (new.stock_quantity * 10)::text; end if;
  else
    v_quantity_changed := new.quantity is distinct from old.quantity;
    v_stock_changed := new.stock_quantity is distinct from old.stock_quantity;
    if v_quantity_changed then
      if v_legacy is null then raise exception 'INVALID_INVENTORY'; end if;
      if v_stock_changed and new.stock_quantity is distinct from v_legacy then raise exception 'CONFLICTING_INVENTORY'; end if;
      new.stock_quantity := v_legacy;
    elsif v_stock_changed then
      if new.stock_quantity is null then raise exception 'INVALID_INVENTORY'; end if;
      new.quantity := (new.stock_quantity * 10)::text;
    elsif new.stock_quantity is null then new.stock_quantity := v_legacy;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.sync_catalog_inventory() from public, anon, authenticated;

-- Keep explicit metadata and already-deducted inventory; reruns never reset stock.
update public.products set sale_unit = 'kg' where sale_unit is null;
update public.products set stock_quantity = replace(btrim(quantity),',','')::numeric / 10
where sale_unit = 'kg' and stock_quantity is null
  and replace(btrim(quantity),',','') ~ '^[0-9]+(\.[0-9]+)?$';

drop trigger if exists catalog_inventory_sync on public.products;
create trigger catalog_inventory_sync before insert or update of quantity, stock_quantity, sale_unit
on public.products for each row execute function public.sync_catalog_inventory();

-- This legacy table also contains customer addresses; it is never a public feed.
do $$ declare field text; begin
  if to_regclass('public.delivery_location') is not null then
    alter table public.delivery_location enable row level security;
    revoke all on table public.delivery_location from public, anon, authenticated;
    for field in select column_name from information_schema.columns where table_schema='public' and table_name='delivery_location' loop
      execute format('revoke select (%I), insert (%I), update (%I), references (%I) on table public.delivery_location from public, anon, authenticated',field,field,field,field);
    end loop;
    grant select, insert, update, delete on table public.delivery_location to service_role;
    if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='delivery_location') then
      alter publication supabase_realtime drop table public.delivery_location;
    end if;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
