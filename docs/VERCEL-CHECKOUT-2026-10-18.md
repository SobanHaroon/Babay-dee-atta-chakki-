# Vercel checkout repair — 18 October 2026

Confirmed production defects:

- `https://babaydeeattachakki.com/api/products` returned 161 products, while `/api/delivery/settings` returned HTTP 503 before delivery handling. `server/security.ts` requires a stable rate-limit signing secret in production; development uses an in-memory limiter. The production environment inventory was missing RATE_LIMIT_SECRET and ORDER_ACCESS_SECRET. It also lacked DELIVERY_QUOTE_SECRET and the owner-confirmed store/delivery settings.
- The two latest deployments failed with `exceeded_serverless_functions_per_deployment`: 13 TypeScript files under `api/` exceeded the Hobby plan's 12-function limit. The live domain still served the older `83b409b` build, not the `feb3bb1` checkout repair.

Implemented:

- `api/index.ts` is now the sole function entry point. Backend modules live in `server/`; route names and the Express application are unchanged. Tests, operational scripts and emitted-JavaScript verification use the new locations.
- Rate-limit failures log a redacted configuration/database error code, without credentials, addresses or request bodies.
- `npm run check:production` verifies required environment settings without sending requests or creating orders. Deployment regression tests check function count and the production rate-limit path.
- Restored missing production-only checkout secrets from the existing ignored local configuration, preserving existing private-order link signatures. Added the owner-confirmed store pin, Rs. 50/km, Rs. 50 minimum, 30 km limit, Rawalpindi/Islamabad service areas, map token and approved website origins. Existing provider keys and product prices were not replaced.
- Production customer SMS/email remain disabled. Staff alerts also remain disabled: automatic approval review rejected enabling customer-detail notifications to the publicly readable ntfy topic. Configure a private topic and server access token before enabling those alerts. Orders remain persisted with queued alerts.

Validation before deployment: 90 tests passed, TypeScript passed, frontend/backend build passed, native ESM startup/health passed. Database tests use synthetic PostgreSQL data. No real production order or customer notification is permitted during verification.

Deployment: install the tested branch in Vercel using the existing Git connection. Retain production signing secrets across subsequent deployments. Check live health, catalog, delivery settings, a synthetic delivery quote, and a checkout request with an intentionally nonexistent product (must reject without writing an order).

Rollback: keep the repaired environment variables. If the new application deployment regresses, restore the previous READY Vercel deployment. That older version lacks the latest dashboard bridge, so do not treat rollback as the final checkout solution. No database migration is part of this change.
