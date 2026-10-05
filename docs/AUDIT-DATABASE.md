# Database, catalog and environment audit — 2 October 2026

This report distinguishes code/public-response evidence from configuration that could not be inspected. No production orders, customer records, notifications, database mutations or anonymous write probes were performed. SQL files are reviewable staging migrations; **none were applied to the hosted database**.

## Confirmed findings

| Evidence | Defect | Implemented correction |
| --- | --- | --- |
| Previous `api/index.ts` product mapper concatenated `quantity` with `Kg`; quantities greater than 50 became `Pack` outside flour/rice/lentils. Public `/api/products` returned 161 products, including IDs 5 (`0 Kg`), 6 (`00000 Kg`) and 45 (`Pack`). | Inventory count was being used as a sale unit and sometimes as a pack size. | `api/catalog.ts` separates `saleUnit`, `stockQuantity` and `packWeightKg`. The explicit public projection and normalizer are shared by catalog and checkout. Ambiguous source rows remain visible but cannot be purchased until confirmed. |
| Previous `src/lib/supabaseProducts.ts` independently forced all units to `Kg`, queried `select('*')`, and invented duplicate IDs. | Catalog fallback could disagree with checkout and expose extra database fields. | API-only catalog loading; duplicate normalization removed. Duplicate database IDs are not fabricated into purchasable items. |
| Public rice IDs 16, 17, 18, 19 and 25 all had the same `BASMATI KAINAT` name and differing prices. No grade appeared in the response. | Customers could not distinguish variants reliably. | Explicit `variant_label`/grade is used when supplied; otherwise a real product-code label distinguishes records. `variant_description_needed` flags missing owner descriptions; no quality grade is inferred from a price. |
| The previous mapper generated nutrition, purity, export-quality and sourcing claims without reading source records. | Product claims did not represent verified metadata. | The new normalizer does not synthesize these claims. Existing branding/assets are retained. |
| `.env` presence scan showed only Geoapify and Mapbox variables; no Supabase privileged/management or SQL credentials were available locally. Repository and live public-bundle publishable keys returned HTTP 401 for the PostgREST OpenAPI endpoint. | The public fallback credential is not a usable way to inspect current schema or operate privileged checkout. | Server credentials are explicit deployment prerequisites. This is **not** evidence that hosted RLS is correct or that the production server uses the same credential. |
| `scripts/audit-secret-exposure.mjs` matched the currently configured Geoapify keys in Git-history versions of `api/index.ts`, `src/lib/mapUtils.ts`, `vite.config.ts`, and old local `dist/assets/index-Orhokbfg.js`. | Those provider credentials must be treated as exposed. Deleting a current source reference does not revoke an old key. | No credential values are included in this report or scan output. Rotate those keys, restrict replacements, deploy only a fresh `dist/client`, and invalidate obsolete hosting artifacts/caches if they ever served the old bundle. |
| Live `/api/delivery/settings` returned 33.567348 latitude, 73.104510 longitude, Rs. 50/km, 45 km maximum and the Main Gulraiz Phase 3 / High Court Road store label. Previous code silently supplied these same defaults on database failure. | A public response cannot establish that the real store coordinate or database pricing was verified. | Keep the owner-configured pricing; confirm the physical store pin and trusted database/server configuration before deployment. Do not claim this public read verified doorstep accuracy or the DB row. |

## Authorization matrix

This is the intended application boundary after this branch's changes. Hosted grants/policies require the staging/dashboard verification below. There is no application administrator role or dashboard after the requested removal; infrastructure operators use trusted Supabase/Vercel access outside the storefront.

| Resource/action | Anonymous visitor | Customer with order-access token | Application administrator | Trusted server/operator |
| --- | --- | --- | --- | --- |
| Public catalog/category API | Explicit public fields, read only | Same | Removed | Server reads authoritative product records |
| Public review API | Approved reviews only; new submissions pending moderation | Same; verified purchase only after qualifying order lookup | Removed | Approve/reject through trusted operational workflow |
| Delivery quote | Validated input, bounded providers, shared limits | Same | Removed | Reads approved store/pricing config, signs quote |
| Checkout | Validated cart, idempotency, trusted pricing, confirmed quote when delivered | Same | Removed | Transaction locks stock and persists order |
| Tracking/receipt details | No access without opaque order token | Own matching order only | Removed | Token checks before service-role query |
| Receipt sending | No unauthenticated/unrestricted send | Must satisfy implemented order-token/rate-limit rules | Removed | Notification credentials remain server-only |
| Product/settings/order mutations and uploads | Denied | Denied | Removed; old routes disabled | Trusted operational tools only |
| `products`, `orders`, `delivery_settings`, `delivery_areas_charges` direct Data API | No grants, including individual column grants | No grants | Removed | Service-role only |
| New commerce/review/rate-limit tables and RPCs | No direct grants or RPC execution | No direct grants or RPC execution | Removed | Service-role only; see commerce migration |
| `product-images` public downloads | Allowed for intended catalog images if bucket is public | Same | Removed | Controlled operational uploads |
| `product-images` insert/update/delete | Restrictive policy denies | Restrictive policy denies | Removed | Trusted staff operating outside this application |
| Realtime for customer/order/settings tables | Not required or authorized | Not required or authorized | Removed | Known legacy tables removed from publication by migration |

A publishable key is a public project identifier, not a customer/administrator identity. A service-role key bypasses RLS, so server handlers must authorize each sensitive operation. Views and security-definer RPCs need separate review because they can bypass table policies. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [function security guidance](https://supabase.com/docs/guides/database/functions).

## Reviewable changes and staging sequence

1. Export schema and authorization metadata with `scripts/audit-database-metadata.sql`. This read-only transaction selects column definitions, grants, RLS policies, views, function metadata, publication membership and bucket configuration. It does not select customer rows. Store the export privately with the deployment record.
2. Verify the existing product column spellings used by `PRODUCT_PUBLIC_COLUMNS`: `id`, `product name`, `price`, `quantity`, `place`, `Product Category`, `Product Images`. Existing code accepted several aliases, and HTTP 401 prevented verification of actual deployed column names. Correct this explicit projection to match the audited schema if needed; do not restore `select('*')` as a fallback.
3. Apply `scripts/20261002_catalog_access.sql` **to an isolated staging database first**. It adds nullable sale/stock/pack/variant fields, a check constraint, revokes table and column grants for public/browser roles, enables RLS, removes known tables from Realtime, and adds restrictive browser mutation policies to `product-images`. No prices, stock levels or units are backfilled or guessed. It assumes the `products` table exists. Existing rows remain unchanged.
4. Apply `scripts/20261002_secure_commerce.sql` after the catalog columns exist. Review that file for new tables and transaction/rate-limit RPCs. Keep all checkout tests on synthetic staging records and disable notification delivery.
5. Have the owner confirm `sale_unit` (`kg` or `pack`), `stock_quantity` and pack weight for each offered item from actual stock/pricing records. A numeric legacy `quantity` can be shown for audit but does **not** make a row purchasable. Populate meaningful rice variant descriptions from supplier/product records. Do not bulk-assign kilograms or invent pack weights to bypass this gate. Validate `catalog_sale_metadata_valid` after reviewed data entry.
6. Confirm image bucket MIME types and size limits in the dashboard; permit intended raster image formats only. Public buckets bypass read access controls for their files, so customer documents must never share the catalog image bucket. Existing files/policies/bucket flags could not be inventoried. [Supabase bucket rules](https://supabase.com/docs/guides/storage/buckets/fundamentals).
7. With valid staging credentials, exercise anonymous and authenticated non-admin read/denial cases, token isolation, rate limiting, stock exhaustion and concurrent idempotent retries. Do not run mutation probes against production.

## Required environment/dashboard actions

- Provide a dedicated server-only Supabase secret/service-role key and URL for **staging**. No `VITE_` prefix for privileged keys. Use different staging and production projects/credentials; verify Vercel Preview environment scopes independently from Production.
- Rotate the exposed Geoapify credentials through the provider dashboard, replace server environment values and revoke old keys after verified cutover. Use a separately restricted browser map token where a map needs one. Keys are intentionally omitted here.
- Confirm order/quote signing keys are stable across instances, unique to environment and separate from provider credentials. Changing an order signing key requires an explicit existing-order access plan; do not rotate it casually as part of a map-key change.
- Confirm trusted store coordinates, service region, fee/minimum/rounding configuration and production environment presence. A broad geocoder search bias is not a delivery authorization boundary.
- Review all existing views/materialized views/RPCs, default grants, custom roles and Storage policies using the metadata output and Supabase Security Advisor. Revoke unintended anonymous/authenticated access; ensure public views use appropriate invoker security or explicit restricted grants. Function execution can be granted to PUBLIC by default, so check each sensitive function independently.
- Inspect `supabase_realtime` publication and policies for **all** customer-bearing tables, including objects not named in the repository. Known-table hardening does not prove there are no alternate views or RPCs exposing old orders.
- Keep production notification keys unavailable to preview/staging and verify the application's notification-disable switch. No notifications were sent during this audit.

## Verification performed and limitations

- `node --import tsx --test scripts/catalog.test.ts`: six tests passed for malformed inventory units, explicit pack metadata, invalid numeric values, variants, public projection/URL safety and duplicate identities.
- Read-only public HTTP checks reproduced catalog defects and delivery settings without retrieving private orders.
- Repository/history/old artifact scan printed only credential classification and file paths. No matching service-role JWT or Supabase secret-key signature was detected. Pattern scans cannot establish absence of every secret; remote hosting variables and provider key restrictions remain unverified.
- No SQL engine, privileged DB connection or Supabase dashboard session was available. SQL was reviewed but not executed against staging; actual tables, constraints, grants, RLS, views, functions, Storage and Realtime are **remaining verification gates**, not claimed secure.
- Provider account restrictions, Vercel environment scopes, production headers, migrations and physical store location need operator/dashboard confirmation. A project can be hardened and tested; no claim of being “unhackable” is made.

## Deployment and rollback

Do not deploy this branch with unreviewed catalog metadata: ambiguous rows deliberately fail closed. First create the isolated staging schema, use synthetic products/orders, verify the full application tests, then record approved metadata and store settings. Back up schema/policies and owner data using trusted operational tools before the production migration. Review migrations as a release change; application startup does not run them.

The catalog migration is additive for product fields and does not delete business records. On rollback, retain added columns, stock updates and newly created order records. Roll back application code only to a version compatible with the secure schema/order tokens; never restore unauthenticated write/read grants merely to make an old browser fallback work. If operational rollback needs earlier privileges/publication membership, reconstruct **only reviewed intended permissions** from the private schema export. Keep checkout disabled until the compatible server is restored. Revoke exposed provider keys rather than rolling back to them.
