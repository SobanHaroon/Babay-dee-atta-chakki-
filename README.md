# Babay Dee Atta Chakki

## Delivery areas

Checkout delivery zones come from the existing Supabase table `delivery_areas_charges` and are searched through the server endpoint `GET /api/delivery-areas`. The browser never supplies the authoritative distance, rate, or fee when an order is created.

The source files contain 299 delivery records (136 Islamabad and 163 Rawalpindi records). The workbook's `Delivery Areas` sheet contains the same 299 data rows plus a header; the `Notes` sheet is informational. The import utility deduplicates by source ID and by city + normalized area name before upserting.

### One-time import / verification

1. Set these values in a local, untracked `.env` file:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-service-role-key
```

2. Keep `SUPABASE_SECRET_KEY` server-only. Never put it in `VITE_*` variables or browser code.
3. Run the idempotent import and verification:

```text
npm run delivery:import
npm run delivery:verify
```

The script refuses to write with a publishable key, does not create/drop the table, reports the resolved existing column mapping, verifies Rawalpindi/Islamabad counts, and checks sample areas including Gulraiz Phase 3, Bahria Town, PWD, Satellite Town, Saddar, DHA Phase 2, F-7, G-10, and Blue Area.

The current Supabase table uses these resolved quoted columns:

- `id`
- `City`
- `Area/Neighborhood/Sector`
- `category`
- `distance from store (KM)`
- `delivery rate (Rs/Km)`
- `delivery charges (Rs)`
- `delivery aviable`
- `recommended Pricing Note`

If the table schema differs in another environment, set the `DELIVERY_*_COLUMN` overrides from `.env.example` rather than recreating the table.

## Security

Order creation is validated in `api/index.ts`: it reloads the selected area by ID and city, rejects unavailable or invalid records, calculates the fee server-side, and stores an immutable delivery snapshot in the existing order metadata. The browser never supplies the authoritative distance, rate, or fee.

Delivery-area mutations and monitoring are intentionally handled outside this storefront. This repository exposes only the public delivery-area lookup needed by checkout; there is no admin dashboard or admin mutation endpoint in this project.

Keep `SUPABASE_SECRET_KEY` server-only and never place it in a `VITE_*` variable.
