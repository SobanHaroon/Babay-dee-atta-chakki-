# Address-only delivery checkout

Checkout now has one complete delivery address field. Enter or **Calculate delivery charges** requests `POST /api/delivery/quote`. The customer cannot continue until a valid charge is shown. Editing the address clears the coordinates, fee and quote. Pickup remains free.

Geoapify is the primary geocoder; Mapbox is a fallback for suitable street/address results. Search prefers the house/building, then the matching street, then the matching sector or phase, then a named neighbourhood. Lookup text handles numeric house, flat, apartment, plot, plaza, shop and office details separately from streets and sectors. Common minor spelling errors, Gulrez/Gulraiz, DHA2/DHA 2 and Roman phase numbers are normalized for lookup only. The original address is retained unchanged. Numbers are never fuzzy-matched. Conflicting streets, sectors, phases and unrelated societies are rejected.

A **matched neighbourhood estimate** is allowed when closer address details are unmapped. Checkout explicitly labels it, explains where the driving distance ends and retains the complete house/unit address for the rider. The receipt also identifies neighbourhood estimates. A mapped parent sector is permitted when its subsector is unavailable; conflicting siblings are rejected. A phase representative point may be located in another sector but is labelled as the matched phase. Generic city centres, unmatched areas and unrelated landmarks are rejected. Provider names, administrative regions and ten candidate results are checked so valid neighbourhoods are not discarded because they use city labels such as Rawat, Jagiot or Zone V.

Live regressions (2026-09-26):

- `plaza 47 jinnah boulevard sector E DHA 2 islamabad` and `plasa 47 Jinna bouleverd secter E DHA2 Islmabad` both resolve to **Jinnah Boulevard, DHA Phase II, Rawat**. The actual route returned **8.80051 km / Rs. 440** at the configured Rs. 50/km. Rawat is accepted as the provider's geographic label for this matching DHA road.
- `house 64 street 5 gulraiz phase 3 rawalpindi` resolves to **Gulrez Housing, Rawalpindi District**: 0.876348 km / Rs. 50, explicitly labelled a neighbourhood estimate. This is not a verified house or Phase 3 coordinate.
- Geoapify's fallback driving route to the Jinnah result was verified live at 8,799 metres.
- An unmapped `Street 999, Sector E, DHA 2 Islamabad` resolves to DHA Phase II: 11.738732 km / Rs. 587. An unmapped street in F-10/2 resolves to the parent F-10 sector: 28.855551 km / Rs. 1,443. These are explicitly disclosed phase/sector charges, not house coordinates.
- Broader coverage includes Bahria phases 7/8, DHA phases 1/2, F-10, G-11, I-8, Satellite Town, Murree Road, Chaklala Scheme 3, PWD, Soan Garden, Adyala Road, Ghauri Town and Bahria Enclave. `scripts/check-delivery-live.mjs` checks these locations plus typo variants and negative controls against the running API, without placing orders. House numbers in these coverage cases are synthetic; success demonstrates the disclosed matching level, not that each house exists.
- Final live matrix: all 20 location-based cases returned charges; both city-only/invented-address controls were rejected (22/22 expected outcomes).

Requests use two bounded lookup batches (6.5-second timeouts), instead of five sequential 12-second calls. Mapbox Directions supplies driving distance; Geoapify Routing is used if Mapbox fails. A sector/phase/neighbourhood representative point may connect to a road within 1 km; street/house points use the normal 100 m Mapbox search radius. No straight-line distance is substituted for a driving route.

The server calculates the fee as `max(50, round(driving kilometres * configured rate))`. Store coordinates, the rate and maximum driving distance come from `delivery_settings`, with existing defaults (33.567348, 73.104510; Rs. 50/km; 45 km maximum). A failed lookup or route never produces an invented charge.

Quotes are authenticated with HMAC and expire after 30 minutes. They bind the full address, destination coordinates, road distance, fee and store pricing settings. Checkout verifies this signature; it ignores client-supplied coordinates, distance and prices. Changed or expired quotes must be recalculated. The saved order and receipts use the verified fee.

## Server configuration

The previously authorized Geoapify credentials were restored into the ignored local `.env`. Configure `GEOAPIFY_GEOCODING_KEY` (or `GEOAPIFY_API_KEY`) in the deployment's server environment too. `GEOAPIFY_ROUTING_KEY` optionally overrides the key used for fallback routing. Never use a VITE_ prefix for these keys. Set `MAPBOX_ACCESS_TOKEN` to the supplied Mapbox token in the hosting environment. The local token is stored in ignored `.env` and is not included in Git. `VITE_MAPBOX_ACCESS_TOKEN` is optional for the retained browser map component and must use a public token.

Optionally set `DELIVERY_QUOTE_SECRET` to a private random value of at least 32 characters. It must be identical across all server instances. The private Geoapify key is used if this setting is absent. Rotating it invalidates outstanding quotes. Without either private key, the development fallback is process-local and unsuitable for multi-instance hosting.

## Validation

- `npm run lint`
- `npm run build`
- `npm run test:delivery`
- `npm run test:security`
- `npm run test:maps` (shared provider helpers and retained map component)
- `npm run test:checkout` (headless Chrome, local fixtures, no real orders or messages)
- `node scripts/check-delivery-live.mjs` (22 live cases; requires the local app and configured provider keys; results in `artifacts/delivery/live-matrix.json`)

Browser screenshots and check results are written to `artifacts/checkout/`. Tracking shows actual server order status and history; the simulated rider map is no longer shown.
