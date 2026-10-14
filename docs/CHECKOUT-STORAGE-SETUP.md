# Fixing the checkout storage error

The configured Supabase project returns `404 / PGRST205` for `secure_orders`, `customer_reviews`, and `api_rate_limits`; the products sale/stock columns are missing (`42703`). These were confirmed with read-only, zero-row probes on 12 October 2026. The order cannot be persisted until the checkout schema is installed. Refreshing the browser or changing the map key cannot create those database objects.

The complete repair is [checkout-setup.sql](../supabase/checkout-setup.sql). It is generated from the four reviewed migrations by `npm run db:bundle`, and runs as one transaction. It creates the private checkout tables/functions, sets access restrictions, and fills missing kg inventory metadata using the owner's confirmed quantity / 10 rule. Existing customer order rows and product prices are not changed. No customer notifications or test orders are created by the setup.

Use staging first, as requested for this audit:

1. Open the staging Supabase project, then **SQL Editor → New query**. Paste the complete contents of `supabase/checkout-setup.sql` and run it as the trusted database owner. The staging project needs the existing products and orders schemas with synthetic data. Alternatively, put its PostgreSQL connection in ignored `.env` as `STAGING_DATABASE_URL`, then run `npm run db:staging -- --apply`. The installer rejects the known live project.
2. Point the Preview application at the staging Supabase URL/server secret; leave customer notifications disabled. Run `npm run db:check` to verify tables, columns and signing-secret presence without reading customer rows. Verify synthetic checkout, stock and private tracking in staging.
3. Once staging is verified, take a production backup and apply the same SQL file to the application's production Supabase project. Applying it only in staging will not repair the production project's missing tables. Configure the production server secrets and approved delivery settings; deploy/restart the backend. No production database installation has been performed by this agent.
4. Run the read-only `db:check` against the configured application project. A ready result checks schema and signing configuration only; it does not replace a staging order-persistence test.

The Supabase REST API key cannot run SQL migrations. Keep database URLs/passwords in ignored environment files, never in chat or source control. No database URL is currently configured locally. The SQL setup passed all 11 PostgreSQL integration checks, including real persistence of synthetic orders, duplicate retries, rollback on insufficient stock, synchronization and role denials.

For detailed changes and rollback guidance, see [the checkout follow-up](CHECKOUT-FOLLOWUP-2026-10-12.md).


## Installation verified after owner ran the SQL — 12 October 2026

Read-only checks against the Supabase project configured by the local app now pass: `secure_orders`, `customer_reviews`, `api_rate_limits`, and the product sale/stock columns all return HTTP 200. REST schema discovery lists `place_secure_order`, `consume_api_rate_limit`, and `claim_order_receipt`. The checkout repository successfully read an unused synthetic checkout context and returned no existing order.

The catalog returns all 161 products, with 147 currently purchasable and all inventory metadata confirmed. Localhost `/api/products` returns HTTP 200. Anonymous zero-row reads of `secure_orders`, `products`, and `delivery_location` are denied with insufficient-privilege errors. All three signing secrets are present locally. No real order was placed, no stock was deducted, and no notification was sent during verification. Hosted environment variables and end-to-end production order persistence were not tested.

The missing-schema blocker described above is resolved for this configured database. Refresh checkout and calculate a fresh delivery quote before retrying. Historical findings above record the pre-installation state.

## Dashboard and ntfy follow-up — 14 October 2026

For the latest legacy orders-table bridge and queued store alerts, use [the incremental repair instructions](ORDER-DASHBOARD-NTFY-2026-10-14.md). The earlier installation confirmation does not include this new migration.
