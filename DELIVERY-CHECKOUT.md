# Delivery checkout

Current implementation and verification: [5 October audit](docs/AUDIT-2026-10-05.md).

Enter the complete address and calculate. Geoapify attempts the full address, then bounded street/sector/phase/neighbourhood fallbacks. Original delivery instructions are preserved. Approximate matches display the matched area and require map-pin confirmation; road distance and fees are then calculated server-side. City-only results do not become a delivery quote.

Text/pin edits invalidate quotes. Checkout requires a valid ten-minute signed quote bound to its context and address version. Routing failures never substitute straight-line distance. Store coordinates, service bounds and pricing must come from verified server configuration. The existing minimum and rounding policy remain unchanged.

Geoapify geocoding/routing credentials are server-only. A separately restricted public Mapbox token displays pin-adjustment map tiles. Configure `.env.example`; provider keys are never used as signing secrets. See the audit report for required migrations, owner configuration, tests and remaining limitations.

Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:checkout`. The browser harness intercepts API calls with synthetic data; it does not create production orders. `scripts/audit-delivery-live.ts` is an optional paid-provider coverage check using synthetic addresses, not verified doorstep locations.
