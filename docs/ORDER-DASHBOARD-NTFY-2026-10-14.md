# Orders dashboard and store alerts repair

## Confirmed causes

- `api/commerce.ts` previously called `place_secure_order`, which inserted into `secure_orders` only. The owner's separate dashboard reads `orders`. The reported order ending `efdc986e` exists in secure storage; it was not lost.
- No ntfy integration or environment configuration existed. Customer email/SMS settings do not deliver store ntfy alerts.
- Read-only schema inspection confirmed the legacy numeric columns: `Price` = total including delivery, `Order pricing` = subtotal, `Delivery charges` = delivery fee. Historical checkout code stores item/delivery metadata after ` | METADATA:` in `customer address`. The new bridge preserves that convention and the original address.

## Implementation

`scripts/20261014_order_dashboard.sql` adds a private ID mapping, an AFTER INSERT trigger and a private notification outbox. The order, legacy dashboard row, inventory deduction and outbox insert commit in the same PostgreSQL transaction. A failure rolls them all back. `place_store_order` is the versioned checkout RPC, so deploying against an old schema fails visibly instead of silently omitting the dashboard record.

Legacy `order id` is an integer; it cannot hold the full UUID tracking ID. A locked allocation creates a numeric dashboard reference and a private mapping to the unchanged secure tracking ID. Both references appear in the store alert. No tracking access token is copied into legacy metadata or ntfy. Recognized dashboard status changes also update private customer tracking; this does not issue refunds or restock cancellations.

`api/staffNotifications.ts` sends a bounded HTTPS JSON request after persistence. A database lease prevents concurrent workers sending the same job. Failures retain the job, use increasing retry delays (up to one hour), and stop after twelve attempts for operator review. Delivery is at least once: a network timeout after ntfy accepts a message can produce a duplicate alert on retry. Queue acknowledgement failure likewise leaves the lease to expire.

At the owner’s subsequent request, messages now contain customer name, phone, email (or “Not provided”), original address, pickup/delivery, requested date/slot, every item’s name/quantity/unit/unit price/line total, subtotal excluding delivery, delivery fee, discount when present and final total. Details are loaded server-side from the persisted secure order after the queue claim; no SQL upgrade is required. Private tracking tokens and internal fields are never included.

Long orders are split into numbered messages within ntfy’s UTF-8 byte limit. The job is marked sent only after all parts are accepted. A partial failure can resend earlier parts during a retry; the full dispatch has a time budget and never silently truncates the item list.

The configured topic was confirmed readable without login, and no access token was configured. Reserve the topic with private read permissions and configure `NTFY_ACCESS_TOKEN` before using it for customer details. A token alone does not make a publicly readable topic private. Customer details are not written to ordinary logs. Only synthetic/mocked sends were used to test this expanded format; the previously delivered concise alert was not resent.

The separate dashboard must use a trusted, authorized backend. Public/ordinary customer access to order tables remains denied. Its authentication and UI are outside this repository and have not been verified.

## Required installation

1. Test the additive migration with a staging database containing the existing `orders` schema and synthetic data. Local PostgreSQL tests cover that schema. Do not create production test orders.
2. In the application's Supabase SQL Editor, run **`supabase/order-dashboard-repair.sql`** as the database owner. It installs the incremental migration and projects only the existing order the owner identified. Running it again is safe: it does not create another checkout, deduct stock again or resend an already completed alert. It does not modify unrelated orders, product prices or customer records.
3. Run `npm run db:check`. The new private mapping and outbox must be present. Restart/deploy the backend after SQL installation. The server API key cannot install SQL functions; no PostgreSQL connection is currently configured for the agent to apply this remotely.
4. The local ignored `.env` now has the owner's topic, `NTFY_BASE_URL=https://ntfy.sh`, `ENABLE_STAFF_NOTIFICATIONS=true`, and a generated `CRON_SECRET`. Copy these server-only settings to the hosting dashboard without putting them in `VITE_` variables. Add `NTFY_ACCESS_TOKEN` if the topic requires it. Customer SMS/email remain separately controlled.
5. To deliver the repaired order's queued STORE alert after installation, run `npm run notifications:retry -- --order-id BDEC-4ffb08f183424cbdb554fb91efdc986e`. This is an actual store notification, not a smoke test. `sent` means ntfy accepted the request; verify receipt on the owner's subscribed device. `empty` means no due job (already sent, leased, delayed or absent); inspect the private outbox if needed. `deferred` requires checking its redacted error code and configuration.

New real checkouts attempt their alert immediately. `GET /api/internal/order-alerts` drains up to three due jobs and requires `Authorization: Bearer <CRON_SECRET>`. `vercel.json` adds a daily fallback job compatible with Hobby. For prompt recovery from outages, schedule this endpoint every five minutes using an appropriate trusted scheduler, or change the Vercel schedule on a plan that supports it. On a persistent server, an OS scheduler can run `npm run notifications:retry -- --batch`. No in-process background task is relied on after a serverless response.

Vercel documents [daily Hobby limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [automatic CRON_SECRET authorization](https://vercel.com/docs/cron-jobs/manage-cron-jobs). A daily fallback handles at most three due jobs per invocation and is not a timely outage-recovery guarantee. Preview, staging and test notifications are disabled; localhost requires explicit staff opt-in. Never point staging at the live queue.

## Verification and limits

Tests use synthetic PostgreSQL records and mocked HTTP providers. They cover legacy formatting, original instruction preservation, rollback on legacy insert failure, stock deduction once, idempotent repair, status synchronization, queue leases/acknowledgements, 401/403/429/5xx/timeouts, private data isolation, and notification failure after successful persistence. No real checkout, customer message or ntfy test message was sent by the agent.

Validation on 14 October: full suite 82/82 passed; the exact repair-file test was then added and PostgreSQL tests passed 15/15. TypeScript check, production build, and emitted ESM startup/health all passed. A read-only hosted readiness check still returns PGRST205 for order_dashboard_links and staff_notification_outbox, confirming the incremental migration has not been installed.

Live SQL installation, dashboard display and device receipt still need verification after the owner runs the repair. The previously shared Supabase secret should be rotated through the provider dashboard and updated server-side; no secret values are included here.

## Deployment and rollback

Back up the schema first; install the incremental SQL before deploying the backend. Keep the signing secrets unchanged so existing private order links remain valid. Verify read-only readiness, then inspect the repaired order through the owner's dashboard.

If alerts malfunction, disable `ENABLE_STAFF_NOTIFICATIONS`; jobs remain queued. Reverting application code does not require deleting data: the additive trigger also bridges the previous `place_secure_order` RPC. Leave the bridge, mapping and outbox installed to preserve dashboard writes. If the bridge itself fails, temporarily stop checkout and repair its cause instead of dropping customer records or bypassing atomic persistence. Do not replay checkout to recover an alert.

## Hosted installation verified after owner ran the SQL

On 14 October 2026, all zero-row schema/signing readiness checks passed, including order_dashboard_links and staff_notification_outbox. The reported existing order maps to dashboard order 972518. Its customer/address/item fields were compared in memory with the secure record and matched; subtotal, delivery fee and total also matched. No customer details were printed.

At the owner's request, the existing order's queued store alert was dispatched once. ntfy accepted the request and the database recorded sent_at=2026-10-14T14:28:42.818494+00:00, attempts=1, last_error=null. No new checkout, stock deduction or customer SMS/email was performed. Device receipt and the external dashboard UI still require owner confirmation. Hosting environment variables/deployment have not been changed by this verification.
