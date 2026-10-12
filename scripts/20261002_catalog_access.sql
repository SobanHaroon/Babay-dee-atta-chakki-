-- STAGING FIRST. Review metadata-only audit output and take a schema backup first.
-- No customer rows, prices, units or stock levels are changed or inferred here.
-- Apply before 20261002_secure_commerce.sql. Do not apply automatically at startup.
begin;

alter table public.products add column if not exists sale_unit text;
alter table public.products add column if not exists stock_quantity numeric;
alter table public.products add column if not exists pack_weight_kg numeric;
alter table public.products add column if not exists variant_label text;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.products'::regclass and conname='catalog_sale_metadata_valid') then
    alter table public.products add constraint catalog_sale_metadata_valid check (
      (sale_unit is null or sale_unit in ('kg','pack')) and
      (stock_quantity is null or (stock_quantity >= 0 and stock_quantity < 1000000000)) and
      (pack_weight_kg is null or (pack_weight_kg > 0 and pack_weight_kg < 1000000)) and
      (sale_unit is distinct from 'pack' or stock_quantity is null or stock_quantity=trunc(stock_quantity))
    ) not valid;
  end if;
end $$;

-- Catalog/reviews are publicly read through explicitly projected API responses.
-- Browsers never require direct table permissions, even when signed into Supabase.
do $$ declare item text; field text; begin
  foreach item in array array['products','orders','delivery_settings','delivery_areas_charges','delivery_location'] loop
    if to_regclass('public.' || item) is not null then
      execute format('alter table public.%I enable row level security', item);
      execute format('revoke all on table public.%I from public, anon, authenticated', item);
      for field in select column_name from information_schema.columns where table_schema='public' and table_name=item loop
        execute format('revoke select (%I), insert (%I), update (%I), references (%I) on table public.%I from public, anon, authenticated', field, field, field, field, item);
      end loop;
      execute format('grant select, insert, update, delete on table public.%I to service_role', item);
      if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=item) then
        execute format('alter publication supabase_realtime drop table public.%I', item);
      end if;
    end if;
  end loop;
end $$;

-- Existing permissive Storage policies cannot override restrictive policies.
-- Public image downloads remain available when the bucket itself is public.
-- With the dashboard removed, image mutations are trusted operational actions only.
do $$ begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists storefront_product_images_no_insert on storage.objects;
    drop policy if exists storefront_product_images_no_update on storage.objects;
    drop policy if exists storefront_product_images_no_delete on storage.objects;
    create policy storefront_product_images_no_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'product-images');
    create policy storefront_product_images_no_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'product-images') with check (bucket_id <> 'product-images');
    create policy storefront_product_images_no_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'product-images');
  end if;
end $$;
commit;

-- REQUIRED owner-reviewed staging data setup, performed separately:
-- Populate sale_unit, stock_quantity and (for packs) pack_weight_kg using source
-- stock/pricing records; never bulk-set kg or derive a pack weight from quantity.
-- Supply variant_label for duplicate rice names from real product specifications.
-- Validate catalog_sale_metadata_valid after reviewed backfill.
