import { DeliveryArea, DeliveryCity } from "../types";
import { calculateDeliveryCharge, DELIVERY_RATE_PER_KM } from "./deliveryCalculation";
import { supabase } from "./supabaseClient";

export class DeliveryServiceError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "DeliveryServiceError";
    this.status = status;
  }
}

interface DeliveryAreasResponse {
  areas?: DeliveryArea[];
  city?: DeliveryCity;
  query?: string;
  error?: string;
}

const DELIVERY_TABLE_NAME = "delivery_areas_charges";

type DeliveryColumnConfig = {
  id: string;
  city: string;
  areaName: string;
  category: string;
  distanceKm: string;
  ratePerKm: string;
  available: string;
  pricingNote: string;
};

const FALLBACK_COLUMNS: DeliveryColumnConfig = {
  id: "id",
  city: "City",
  areaName: "Area/Neighborhood/Sector",
  category: "category",
  distanceKm: "distance from store (KM)",
  ratePerKm: "delivery rate (Rs/Km)",
  available: "delivery aviable",
  pricingNote: "recommended Pricing Note",
};

let resolvedColumns: DeliveryColumnConfig | null = null;
const directDeliveryAreaCache = new Map<DeliveryCity, { expiresAt: number; areas: DeliveryArea[] }>();

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findObservedKey(keys: string[], configured: string, candidates: string[]): string {
  if (keys.includes(configured)) return configured;

  const normalizedKeys = new Map(keys.map((key) => [normalizeKey(key), key]));
  for (const candidate of [configured, ...candidates]) {
    const match = normalizedKeys.get(normalizeKey(candidate));
    if (match) return match;
  }

  return configured;
}

async function getDeliveryColumnsDirectly(): Promise<DeliveryColumnConfig> {
  if (resolvedColumns) return resolvedColumns;
  if (!supabase) return FALLBACK_COLUMNS;

  const probe = await supabase.from(DELIVERY_TABLE_NAME).select("*").limit(1);
  const observedKeys = probe.data?.[0] ? Object.keys(probe.data[0] as Record<string, unknown>) : [];

  if (observedKeys.length === 0) {
    resolvedColumns = FALLBACK_COLUMNS;
    return resolvedColumns;
  }

  resolvedColumns = {
    id: findObservedKey(observedKeys, FALLBACK_COLUMNS.id, ["id"]),
    city: findObservedKey(observedKeys, FALLBACK_COLUMNS.city, ["City", "city"]),
    areaName: findObservedKey(observedKeys, FALLBACK_COLUMNS.areaName, [
      "Area/Neighborhood/Sector",
      "Area / Neighborhood / Sector",
      "area name",
      "area",
      "neighborhood",
    ]),
    category: findObservedKey(observedKeys, FALLBACK_COLUMNS.category, ["category", "Category"]),
    distanceKm: findObservedKey(observedKeys, FALLBACK_COLUMNS.distanceKm, [
      "distance from store (KM)",
      "Distance from Gulraiz Phase 3 (km)",
      "distance km",
      "distance",
    ]),
    ratePerKm: findObservedKey(observedKeys, FALLBACK_COLUMNS.ratePerKm, [
      "delivery rate (Rs/Km)",
      "Delivery Rate (Rs/km)",
      "rate per km",
      "rate_per_km",
    ]),
    available: findObservedKey(observedKeys, FALLBACK_COLUMNS.available, [
      "delivery aviable",
      "Delivery Available",
      "available",
      "delivery_available",
    ]),
    pricingNote: findObservedKey(observedKeys, FALLBACK_COLUMNS.pricingNote, [
      "recommended Pricing Note",
      "Recommended Pricing Note",
      "pricing note",
      "pricing_note",
    ]),
  };
  return resolvedColumns;
}

function quoteColumn(column: string): string {
  return `"${column.replace(/"/g, '""')}"`;
}

function deliverySelect(columns: DeliveryColumnConfig): string {
  return Object.values(columns).map(quoteColumn).join(",");
}

function parseNumber(value: unknown): number {
  return Number(String(value ?? "").replace(/,/g, "").trim());
}

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "available";
}

function mapDeliveryArea(row: Record<string, unknown>, columns: DeliveryColumnConfig): DeliveryArea | null {
  const city = String(row[columns.city] ?? "").trim();
  const areaName = String(row[columns.areaName] ?? "").trim();
  const distanceKm = parseNumber(row[columns.distanceKm]);
  const ratePerKm = parseNumber(row[columns.ratePerKm]) || DELIVERY_RATE_PER_KM;

  if (
    (city !== "Rawalpindi" && city !== "Islamabad") ||
    !areaName ||
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    !Number.isFinite(ratePerKm) ||
    ratePerKm < 0
  ) {
    return null;
  }

  return {
    id: String(row[columns.id] ?? "").trim(),
    city: city as DeliveryCity,
    areaName,
    category: String(row[columns.category] ?? "").trim(),
    distanceKm: Math.ceil(distanceKm),
    deliveryRatePerKm: ratePerKm,
    deliveryCharge: calculateDeliveryCharge(distanceKm, ratePerKm),
    available: parseBoolean(row[columns.available]),
    pricingNote: String(row[columns.pricingNote] ?? "").trim(),
  };
}

async function searchDeliveryAreasDirectly(city: DeliveryCity, query: string, limit: number): Promise<DeliveryArea[]> {
  if (!supabase) {
    throw new DeliveryServiceError("Supabase is not configured for delivery areas.");
  }

  const columns = await getDeliveryColumnsDirectly();
  const cached = directDeliveryAreaCache.get(city);
  let areas: DeliveryArea[];

  if (cached && cached.expiresAt > Date.now()) {
    areas = cached.areas;
  } else {
    const result = await supabase
      .from(DELIVERY_TABLE_NAME)
      .select(deliverySelect(columns))
      .eq(columns.city, city)
      .limit(500);

    if (result.error) {
      throw new DeliveryServiceError(result.error.message);
    }

    areas = ((result.data ?? []) as unknown as Record<string, unknown>[])
      .map((row) => mapDeliveryArea(row, columns))
      .filter((area): area is DeliveryArea => Boolean(area && area.id));
    directDeliveryAreaCache.set(city, { areas, expiresAt: Date.now() + 30_000 });
  }

  const normalizedQuery = query.trim().toLowerCase();
  return areas
    .filter((area) => !normalizedQuery || area.areaName.toLowerCase().includes(normalizedQuery))
    .sort((first, second) => first.areaName.localeCompare(second.areaName))
    .slice(0, limit);
}

export async function searchDeliveryAreas(
  city: DeliveryCity,
  query = "",
  signal?: AbortSignal,
): Promise<DeliveryArea[]> {
  const params = new URLSearchParams({ city, query: query.trim(), limit: "40" });
  let response: Response;

  try {
    response = await fetch(`/api/delivery-areas?${params.toString()}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return searchDeliveryAreasDirectly(city, query, 40);
  }

  const payload = (await response.json().catch(() => ({}))) as DeliveryAreasResponse;
  if (!response.ok) {
    try {
      return await searchDeliveryAreasDirectly(city, query, 40);
    } catch {
      throw new DeliveryServiceError(payload.error || "Unable to load delivery areas.", response.status);
    }
  }

  return Array.isArray(payload.areas) ? payload.areas : [];
}
