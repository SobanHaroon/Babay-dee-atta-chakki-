# Catalog recovery — 11 October 2026

## Evidence

Read-only requests to the production `/api/health`, `/api/categories` and `/api/products` endpoints all returned HTTP 500 with Vercel `FUNCTION_INVOCATION_FAILED`. This is an API startup failure, not an empty product search. No customer data was requested or changed.

Compiling the API dependencies to ESM and importing them with plain Node reproduced `ERR_MODULE_NOT_FOUND`: `src/lib/orderReceipt.ts` imported `./orderAccess` without the `.js` extension. Development through tsx and the bundled build masked this defect. The extension is now explicit and the native production-runtime check passes. Vercel runtime logs are unavailable, so the exact exception in the hosted deployment remains unconfirmed.

Two additional code-level availability defects were confirmed by regression tests: public catalog requests depended on the commerce rate-limit RPC/signing configuration, and the catalog SELECT required all newly proposed metadata columns even though the audit migrations had not been applied. The deployed schema was not accessible to confirm which columns currently exist.

## Changes

- `src/lib/orderReceipt.ts`: runtime-compatible ESM import.
- `api/database.ts`: trims configuration, supports existing public Supabase URL/key aliases, keeps privileged credentials server-only, and prevents malformed configuration from crashing every API route. Missing/invalid credentials still produce a catalog error; no fabricated products or customer-access bypass is used.
- `api/catalogRepository.ts`: explicit public projection, bounded missing-column compatibility for known optional fields, one-minute schema-capability cache, and fresh product reads. Required identity/price columns and authorization failures remain errors. Current prices and inventory are not cached. Missing sale metadata does not hide a product, but purchase remains disabled until the owner confirms that metadata.
- `api/security.ts`: exact read-only catalog/category/health routes have bounded per-instance public-read limits independent of commerce migrations. Quote, checkout, review, tracking and receipt protection still require their shared production rate store. Hosting edge limits can supplement public catalog limits across instances.
- `src/App.tsx`: dedicated load-error state, retry without reloading the page, reconnect/tab-return synchronization, existing one-minute polling, and retention of previously loaded products after a refresh error. A load failure no longer displays the misleading no-search-results panel.
- `scripts/verify-api-runtime.mjs`: emits unbundled ESM and checks production startup with plain Node, including invalid database configuration. The browser test also covers load failure, retry, reconnect refresh and preserving products during an outage.

## Verification and release

Run `npm test`, `npm run test:runtime`, `npm run lint`, `npm run build`, and `npm run test:checkout`. The browser harness uses intercepted synthetic APIs; it never places real orders or sends notifications. Generated runtime output stays ignored under `artifacts/catalog-runtime`.

No Vercel management session or Supabase credentials are available locally. The ignored local environment contains only map-provider values. Configure hosting `SUPABASE_URL` and a valid server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with access to products. A configured public key can read the catalog only where existing grants allow it; it cannot authorize checkout. Do not restore anonymous write permissions. If old deployment names are used, `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` are accepted for public configuration compatibility.

Redeploy this branch to a Vercel Preview, verify `/api/health` and `/api/products`, inspect redacted catalog error codes if necessary, then confirm products and refresh on desktop/mobile. Missing optional metadata no longer requires a migration merely to display products. All previous commerce migration and owner-confirmed unit/stock requirements remain in force for purchasing. No hosting change, database migration, commit, push or production deployment was performed for this fix.

Verified results: all 54 automated tests passed; TypeScript, production build and native ESM startup passed. The final desktop/mobile browser run passed, including catalog initial-error recovery, retry without reload, reconnect synchronization, retention during a failed refresh, and the complete synthetic checkout/receipt/tracking flow. Catalog screenshots are in `artifacts/checkout/catalog-error-mobile.png` and `artifacts/checkout/catalog-loaded-mobile.png`.

## Follow-up: real localhost connection verified

The owner supplied Supabase configuration after the initial fix. It was stored only in the ignored local `.env`. The already-running development process still returned `CATALOG_CONFIGURATION` because it had started before those values were present. After restarting the watcher, `/api/products` returned HTTP 200 with all 161 real products. `npm run dev` now watches `.env` changes as well as source changes.

`node scripts/verify-local-catalog.mjs` passed against the actual local API/database without product fixtures: 161 rendered product cards, desktop and mobile verified, and all mutating API requests blocked. Screenshots/results are under `artifacts/catalog-live`. A tracked-source scan found no copy of the supplied secret. No hosted environment was modified and no database records were changed.

The products currently have unconfirmed sale/stock metadata and therefore remain non-purchasable under the existing catalog validation. Display and synchronization are now verified independently of that owner-data requirement. The secret supplied in chat should be rotated and its replacement set in local/hosting private environments.
