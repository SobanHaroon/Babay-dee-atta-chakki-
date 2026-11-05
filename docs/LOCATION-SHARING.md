# One-time customer delivery location sharing

The Babay Dee checkout now offers an explicit **Send my current location** button, followed by a draggable pin with accuracy information, and a separate confirmation action. GPS is consent-based and requires HTTPS. There is no live-location tracking.

Customers may also tap the map, drag the pin, enter coordinates manually, or use the original full-address geocoding flow. The map starts centred on the store but the store coordinate is not automatically selected. A reverse Geoapify call supplies only an approximate address label, not a verified house location. A coordinate label is used if it fails; manual house/gate notes are retained independently.

Delivery quote calls continue using the existing server-side signed context, address/version, service-area, 30-km road distance, Rs 50/km and 10-minute expiry rules. Selected pins use the confirmedPin parameter, and orders already store latitude and longitude privately in the secure order payload. The review and receipt show an optional Google Maps link for the pin.

The new POST /api/delivery/reverse endpoint uses the existing server-only Geoapify key and delivery rate limiting. The client map uses the restricted public Mapbox tile token.

## Staging verification

- On HTTPS mobile, grant location permission and check GPS accuracy; deny access and choose the pin manually.
- Tap/drag a pin and confirm. Change a pin or address and verify old quotes are invalidated.
- Confirm out-of-area pins are rejected even if the address text claims to be inside the delivery area.
- Confirm typed-address geocoding and pickup still work.
- Verify synthetic checkout stores the coordinates and receipt link without creating a production order.
