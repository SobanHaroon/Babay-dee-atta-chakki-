import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDeliveryCharge, DELIVERY_RATE_PER_KM } from "../src/lib/deliveryCalculation.js";
import type { DeliveryArea, DeliveryCity } from "../src/types.js";

export const DELIVERY_TABLE_NAME = "delivery_areas_charges";

export interface DeliveryColumnConfig {
  id: string;
  city: string;
  areaName: string;
  category: string;
  distanceKm: string;
  ratePerKm: string;
  deliveryCharge: string;
  available: string;
  pricingNote: string;
}

function envOrFallback(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

const FALLBACK_COLUMNS: DeliveryColumnConfig = {
  id: envOrFallback("DELIVERY_ID_COLUMN", "id"),
  city: envOrFallback("DELIVERY_CITY_COLUMN", "City"),
  areaName: envOrFallback("DELIVERY_AREA_COLUMN", "Area/Neighborhood/Sector"),
  category: envOrFallback("DELIVERY_CATEGORY_COLUMN", "category"),
  distanceKm: envOrFallback("DELIVERY_DISTANCE_COLUMN", "distance from store (KM)"),
  ratePerKm: envOrFallback("DELIVERY_RATE_COLUMN", "delivery rate (Rs/Km)"),
  deliveryCharge: envOrFallback("DELIVERY_CHARGE_COLUMN", "delivery charges (Rs)"),
  available: envOrFallback("DELIVERY_AVAILABLE_COLUMN", "delivery aviable"),
  pricingNote: envOrFallback("DELIVERY_NOTE_COLUMN", "recommended Pricing Note"),
};

let resolvedColumns: DeliveryColumnConfig | null = null;

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findObservedKey(keys: string[], configured: string, candidates: string[]): string {
  const exact = keys.find((key) => key === configured);
  if (exact) return exact;
  const normalized = new Map(keys.map((key) => [normalizeKey(key), key]));
  for (const candidate of [configured, ...candidates]) {
    const match = normalized.get(normalizeKey(candidate));
    if (match) return match;
  }
  return configured;
}

export async function getDeliveryColumns(client: SupabaseClient): Promise<DeliveryColumnConfig> {
  if (resolvedColumns) return resolvedColumns;

  const probe = await client.from(DELIVERY_TABLE_NAME).select("*").limit(1);
  const observedKeys = probe.data?.[0] ? Object.keys(probe.data[0] as Record<string, unknown>) : [];

  if (observedKeys.length === 0) {
    resolvedColumns = FALLBACK_COLUMNS;
    return resolvedColumns;
  }

  resolvedColumns = {
    id: findObservedKey(observedKeys, FALLBACK_COLUMNS.id, ["id"]),
    city: findObservedKey(observedKeys, FALLBACK_COLUMNS.city, ["City", "city"]),
    areaName: findObservedKey(observedKeys, FALLBACK_COLUMNS.areaName, ["Area/Neighborhood/Sector", "Area / Neighborhood / Sector", "area name", "area", "neighborhood"]),
    category: findObservedKey(observedKeys, FALLBACK_COLUMNS.category, ["category", "Category"]),
    distanceKm: findObservedKey(observedKeys, FALLBACK_COLUMNS.distanceKm, ["distance from store (KM)", "Distance from Gulraiz Phase 3 (km)", "distance km", "distance"]),
    ratePerKm: findObservedKey(observedKeys, FALLBACK_COLUMNS.ratePerKm, ["Delivery Rate (Rs/km)", "rate per km", "rate_per_km"]),
    deliveryCharge: findObservedKey(observedKeys, FALLBACK_COLUMNS.deliveryCharge, ["Delivery Charge (Rs)", "delivery charge", "delivery_charge"]),
    available: findObservedKey(observedKeys, FALLBACK_COLUMNS.available, ["delivery aviable", "Delivery Available", "available", "delivery_available"]),
    pricingNote: findObservedKey(observedKeys, FALLBACK_COLUMNS.pricingNote, ["Recommended Pricing Note", "pricing note", "pricing_note"]),
  };
  return resolvedColumns;
}

export function quoteColumn(column: string): string {
  return `"${column.replace(/"/g, '""')}"`;
}

export function deliverySelect(columns: DeliveryColumnConfig): string {
  return Object.values(columns).map(quoteColumn).join(",");
}

function parseNumber(value: unknown): number {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return number;
}

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "available";
}

export function mapDeliveryArea(row: Record<string, unknown>, columns: DeliveryColumnConfig): DeliveryArea | null {
  const city = String(row[columns.city] ?? "").trim();
  const areaName = String(row[columns.areaName] ?? "").trim();
  const distanceKm = parseNumber(row[columns.distanceKm]);
  const ratePerKm = parseNumber(row[columns.ratePerKm]) || DELIVERY_RATE_PER_KM;

  if ((city !== "Rawalpindi" && city !== "Islamabad") || !areaName || !Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(ratePerKm) || ratePerKm < 0) {
    return null;
  }

  const calculatedCharge = calculateDeliveryCharge(distanceKm, ratePerKm);
  return {
    id: String(row[columns.id] ?? "").trim(),
    city: city as DeliveryCity,
    areaName,
    category: String(row[columns.category] ?? "").trim(),
    distanceKm: Math.ceil(distanceKm),
    deliveryRatePerKm: ratePerKm,
    // The stored charge is retained in the database for auditing, but the
    // application always derives the quote from the validated distance/rate.
    deliveryCharge: calculatedCharge,
    available: parseBoolean(row[columns.available]),
    pricingNote: String(row[columns.pricingNote] ?? "").trim(),
  };
}

const deliveryAreaCache = new Map<DeliveryCity, { expiresAt: number; areas: DeliveryArea[] }>();

export async function searchDeliveryAreas(
  client: SupabaseClient,
  city: DeliveryCity,
  query: string,
  limit: number,
): Promise<DeliveryArea[]> {
  const columns = await getDeliveryColumns(client);
  const cached = deliveryAreaCache.get(city);
  let areas: DeliveryArea[];

  if (cached && cached.expiresAt > Date.now()) {
    areas = cached.areas;
  } else {
    // The imported area field contains a slash, so PostgREST's filter grammar can
    // parse it inconsistently. Filter by indexed city in SQL, then search the
    // bounded city result in memory and cache it briefly for checkout typing.
    const result = await client
      .from(DELIVERY_TABLE_NAME)
      .select(deliverySelect(columns))
      .eq(columns.city, city)
      .limit(500);
    if (result.error) throw result.error;

    areas = ((result.data ?? []) as unknown as Record<string, unknown>[])
      .map((row) => mapDeliveryArea(row, columns))
      .filter((area): area is DeliveryArea => Boolean(area && area.id));
    deliveryAreaCache.set(city, { areas, expiresAt: Date.now() + 30_000 });
  }

  const normalizedQuery = query.trim().toLowerCase();
  return areas
    .filter((area) => !normalizedQuery || area.areaName.toLowerCase().includes(normalizedQuery))
    .sort((first, second) => first.areaName.localeCompare(second.areaName))
    .slice(0, limit);
}

export async function findDeliveryArea(
  client: SupabaseClient,
  city: DeliveryCity,
  areaId: string,
): Promise<DeliveryArea | null> {
  const columns = await getDeliveryColumns(client);
  const result = await client
    .from(DELIVERY_TABLE_NAME)
    .select(deliverySelect(columns))
    .eq(columns.city, city)
    .eq(columns.id, areaId)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;
  return mapDeliveryArea(result.data as unknown as Record<string, unknown>, columns);
}

export function isDeliveryCity(value: unknown): value is DeliveryCity {
  return value === "Rawalpindi" || value === "Islamabad";
}
