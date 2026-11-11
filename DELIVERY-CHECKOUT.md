# Delivery checkout

Customers enter their details and a complete delivery address, choose a date/time, and review the order. No map, location permission, route lookup or signed delivery quote is required. Store pickup still has no delivery charge.

Confirm & place order first calls `/api/checkout`. The server validates the details, prices items from the trusted catalog and uses the existing `place_store_order` transaction to save the order, update the dashboard table, deduct inventory and queue staff notifications. Retries retain the same checkout context and idempotency key, preventing duplicate orders.

New delivery orders save `deliveryChargeStatus: "pending"` in the existing order JSON. `deliveryCharges` stays numerically zero for compatibility with the existing database; this means **not yet included**, not free delivery. `total` is the item total. No database migration is needed. Existing orders with recorded delivery charges retain their original invoice totals.

Checkout, receipts, tracking summaries and enabled order notifications explain that delivery charges are calculated separately and the final total including delivery is shared through WhatsApp.

Only after a successful save, the browser opens `https://wa.me/923215010846` with a URL-encoded message containing the saved tracking ID, customer name, address and contact number. The customer presses Send in WhatsApp. Failed saves retain the basket and do not redirect. The success page also includes a WhatsApp link for retrying the handoff.

Map components, providers, quote endpoints and related dependencies have been removed. Store direction links on the contact page remain ordinary external links. Configuration is documented in `.env.example`.

Run `npm test`, `npm run lint`, `npm run build`, `npm run test:runtime` and `npm run test:checkout`. Database tests use local PostgreSQL-compatible PGlite. Browser checks use synthetic API responses and intercept WhatsApp navigation; they do not create live orders or send messages. Set `CHROME_BIN` if Chromium is not on PATH.
