export type DeliveryCity = "Rawalpindi" | "Islamabad";
export type DeliveryDistanceSource = "baseline" | "exact_route";

/** Default store pricing. Area-level database rates remain authoritative when present. */
export const DELIVERY_RATE_PER_KM = 50;
/** Configurable minimum fee for the store location itself (0 km). */
export const MIN_DELIVERY_CHARGE = 50;

export function normalizeDistanceKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("Invalid delivery distance.");
  }
  return Math.ceil(distanceKm);
}

export function validateDeliveryRate(ratePerKm: number): number {
  if (!Number.isFinite(ratePerKm) || ratePerKm < 0) {
    throw new Error("Invalid delivery rate.");
  }
  return ratePerKm;
}

export function calculateDeliveryCharge(
  distanceKm: number,
  ratePerKm: number = DELIVERY_RATE_PER_KM,
  minimumCharge: number = MIN_DELIVERY_CHARGE,
): number {
  const normalizedDistanceKm = normalizeDistanceKm(distanceKm);
  const validRate = validateDeliveryRate(ratePerKm);
  if (!Number.isFinite(minimumCharge) || minimumCharge < 0) {
    throw new Error("Invalid minimum delivery charge.");
  }

  return Math.max(minimumCharge, normalizedDistanceKm * validRate);
}

export function formatRs(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}
