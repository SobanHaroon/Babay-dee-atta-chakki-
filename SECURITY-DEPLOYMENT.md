# Security and deployment

Use the [5 October application audit](docs/AUDIT-2026-10-05.md) and [database authorization matrix](docs/AUDIT-DATABASE.md) as the release checklist. Earlier instructions about admin bearer tokens, phone-based order authorization, per-process production limits and the old order migration are superseded.

There is no application admin dashboard. Admin/status/upload/diagnostic notification routes are removed. Order tracking, receipts and feedback require an opaque order-access token. Production limits use a shared database RPC; privileged Supabase clients remain server-only and enforce authorization in handlers. Checkout validates current catalog prices, signed delivery quotes, quantities and availability, then calls the transactional order/stock RPC with idempotency.

Review and test `scripts/20261002_catalog_access.sql` followed by `scripts/20261002_secure_commerce.sql` in isolated staging. Neither has been applied to the hosted database by this audit. Do not deploy until actual grants/RLS/views/RPCs/Storage/Realtime, catalog metadata, physical store coordinates and service region have been verified. Legacy orders require a secure access migration plan.

Configure the private environment values listed in `.env.example`; rotate historically exposed Geoapify credentials. Keep notification delivery disabled during staging. Publish only fresh `dist/client` assets, retain HTTPS/security headers, and verify exact allowed origins and public map-token restrictions in Vercel Preview.

Validation: `npm test`, `npm run lint`, `npm run build`, `npm run test:checkout`. Browser tests use synthetic intercepted APIs. Hosted SQL and real serverless authorization checks remain explicit deployment gates. Deployment and non-destructive rollback steps are in the application audit.
