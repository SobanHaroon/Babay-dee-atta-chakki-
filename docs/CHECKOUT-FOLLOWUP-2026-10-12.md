# Catalog and checkout follow-up — 12 October 2026

Work continued from the owner's `83b409b` commit on branch `fix/checkout-verification-2026-10-12`. This report supersedes the earlier report's unconfirmed-unit and unverified-store statements.

## Confirmed causes and fixes

- The real products table has legacy `quantity` and `price` text fields but no `sale_unit` or `stock_quantity`. The strict normalizer therefore disabled every item. The owner confirmed kilogram sales, zero as out of stock, and `100000` as `10000 kg`. `api/catalog.ts` now applies quantity / 10 only when explicit kg stock metadata is missing; explicit metadata takes precedence. Prices remain unchanged. Invalid records remain unavailable. `src/components/ProductCard.tsx` shows ordinary out-of-stock labels for zero quantities, not unconfirmed-sale warnings caused merely by a missing rice variant description. Inventory totals are not rendered.
- Hosted REST schema inspection confirmed that `secure_orders`, `customer_reviews`, `api_rate_limits`, and the commerce RPCs are absent. Catalog loading does not install a checkout database. `api/commerce.ts` now reports `DATABASE_SETUP_REQUIRED` separately from transient storage errors; the basket is kept. The migrations below implement private order persistence, atomic stock deductions, idempotency, review storage and shared request limits.
- The legacy delivery-settings columns contain spaces, whereas the previous query expected snake_case names. `api/deliverySettings.ts` supports both schemas. The live settings table was empty; no customer/order rows were read.
- `scripts/20261011_confirm_kg_catalog.sql` backfills the owner-confirmed unit/stock mapping and synchronizes legacy quantity with stock_quantity in both directions. Conflicting simultaneous edits are rejected. Reapplying migrations does not reset deducted stock. Explicit pack metadata remains supported. SQL validation also rejects missing quantities/prices and non-finite values.
- The legacy `delivery_location` table contains customer address data but was omitted from the earlier permissions migration. It is now included in table/column privilege revocation and Realtime removal. This is a confirmed omission in migration coverage; actual hosted grants/RLS remain unverified until SQL/dashboard access is available.
- Dependency patch updates resolved the npm advisories detected during the follow-up. This is a dependency check, not proof that all vulnerabilities are absent.

## Owner-confirmed delivery configuration

The owner's [Google Maps link](https://maps.app.goo.gl/XYR14ymesAJdSA1v5) resolves to Babay Di Atta Chakki (MAIN BRANCH), with place coordinates **33.567341, 73.1044791**. These come from the place-marker parameters, not the map camera centre. Public map defaults now use the same pin.

Private local configuration and `.env.example` now use Rs. 50/km, Rs. 50 minimum, nearest-rupee rounding, **30 km maximum road distance**, and Rawalpindi/Islamabad service areas. The server verifies the confirmed destination's administrative area through Geoapify reverse geocoding, then requests driving distance in metres and converts once. Quote signatures bind these settings, including service areas. The reverse address is never required to equal the customer's house/street instructions. [Provider API reference](https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/).

Area enforcement uses Geoapify's Pakistan city/county/state labels, including Rawalpindi District and Islamabad Capital Territory, together with the 30 km route limit. This is not a surveyed municipal-boundary polygon. If stricter municipal boundaries are required, provide an approved polygon; optional existing rectangular bounds can impose a further restriction.

Nine realistic English/Urdu fixture queries eventually returned candidates. Some full/comparison requests timed out; the bounded fallback retained matches, and an intentionally fictitious query remained an error. No house-level accuracy is claimed. Broad matches still require the customer to confirm/adjust a map pin before a quote is issued.

Synthetic area-centre route samples (NOT verified house locations):

| Fixture | Returned precision | Road km | Fee |
| --- | --- | ---: | ---: |
| Gulraiz Phase 3 house/street | Neighbourhood | 1.204 | Rs. 60 |
| Bahria Phase 8 Sector C house/street | Phase | 13.404 | Rs. 670 |
| Bahria Phase 8 | Phase | 13.404 | Rs. 670 |
| G-13/1 house/street | Parent sector G-13 | 18.819 | Rs. 941 |
| Jinnah Boulevard/DHA 2 | Phase | 9.952 | Rs. 498 |

Recorded provider results are under `artifacts/audit/provider-fixtures-2026-10-12*.json`. They contain synthetic addresses and no API credentials. Initial failures and successful retries are retained separately.

## Verification

- All 71 automated tests passed on the final full run, including the database setup-error regression and updated owner-verified store coordinates.
- Actual PostgreSQL engine integration tests use isolated PGlite and synthetic products/orders. They execute all three migrations, checkout persistence, database RPC retries, one stock deduction, rollback when a later bundle component is unavailable, price conflicts, kg/pack quantity rules, receipt throttling, shared rate limits, repeat migration safety, and denial for anonymous/authenticated roles. PGlite serializes one backend: hosted multi-connection lock contention is still a staging check.
- TypeScript, production build and native unbundled ESM startup passed. Production dependencies: npm audit reported zero known advisories.
- Read-only localhost catalog browser test: all 161 real products rendered, kilogram pricing and correct zero-stock labels, desktop/mobile layout, mutating API requests blocked.
- Synthetic browser checkout passed: catalog retry/synchronization, basket, address/pin invalidation, stale-response protection, quote expiry, receipt charges, tracking, confirmation dialog and order submission payload. All API writes were intercepted; no real orders or notifications were created.

## Remaining deployment gates and required actions

`STAGING_DATABASE_URL` is still absent from ignored `.env`. No hosted migration, production order, customer-record change, notification, or deployment was performed. The tests establish local code/database behavior; they do not establish that hosted checkout is ready.

1. Add a PostgreSQL URL for a separate staging database to ignored `.env`. Its products table must use the legacy schema (schema only, with synthetic fixture records). Never point this variable at the live project. `npm run db:staging` performs a read-only preflight; `npm run db:staging -- --apply` installs the listed migrations and refuses the known production project.
2. Apply in order: `scripts/20261002_catalog_access.sql`, `scripts/20261002_secure_commerce.sql`, `scripts/20261011_confirm_kg_catalog.sql`. Run `scripts/audit-database-metadata.sql` in staging to inspect actual grants, policies, RPC rights, storage and Realtime. The existing authorization matrix is in `docs/AUDIT-DATABASE.md`.
3. Use staging Supabase URL/secret credentials in Vercel Preview; keep `APP_ENV=staging` and `ENABLE_CUSTOMER_NOTIFICATIONS=false`. Supply independent server-only `ORDER_ACCESS_SECRET`, `DELIVERY_QUOTE_SECRET`, `RATE_LIMIT_SECRET` (at least 32 random characters each), provider keys and the confirmed delivery settings from `.env.example`. Local signing keys were generated only in ignored `.env`; never commit them or prefix secrets with VITE_. Configure approved application origins. Rotate the Supabase secret previously pasted in chat and replace it in private local/hosting environments. The secret scan also found the reused Geoapify key in Git history: rotate that provider key and update the private geocoding/routing environment. Current source and browser bundles contain no matched private keys; public Supabase identifiers and the restricted public Mapbox map token are classified separately.
4. Verify a complete synthetic checkout on staging desktop/mobile, concurrent retries from separate connections, fresh stock updates, private tracking links and out-of-stock conflicts. Do not reuse production customer records or enable customer notifications for this test.
5. Review the staging results and take a production schema/data backup before applying the same migrations to production. Deploy the reviewed branch with production-specific secrets. This production database/deployment step has not been performed.

Rollback: revert the application deployment if verification fails and disable new checkout traffic. Preserve `secure_orders`, stock balances and the synchronization trigger; do not drop tables or restore old stock while orders exist. Forward-fix database changes or restore from a reviewed backup during a controlled outage, reconciling orders and stock first. Rolling back application code alone does not undo committed orders or inventory deductions.
