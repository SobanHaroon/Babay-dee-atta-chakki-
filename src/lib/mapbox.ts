export interface AddressDetails {
  houseNumber: string;
  street: string;
  sector: string;
  town: string;
  neighborhood: string;
  city: string;
  district: string;
  region: string;
  postcode: string;
  country: string;
}

export interface MapboxPlace {
  placeId: string;
  formatted: string;
  address: string;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
  city: string;
  area: string;
  details: AddressDetails;
  accuracy: string;
  featureType: string;
}

export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

const cleanText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const joinParts = (parts: string[]) => [...new Map(parts.filter(Boolean).map(p => [p.toLowerCase(), p])).values()].join(", ");

/** Only extract information actually supplied by Mapbox; never guess a nearby society. */
export function parseMapboxFeature(feature: any): MapboxPlace | null {
  const p = feature?.properties || {};
  const c = p.context || {};
  const lng = p.coordinates?.longitude ?? feature?.geometry?.coordinates?.[0];
  const lat = p.coordinates?.latitude ?? feature?.geometry?.coordinates?.[1];
  if (!validCoordinates(lat, lng)) return null;
  const name = cleanText(p.name);
  const named = (type: string) => cleanText(c[type]?.name) || (p.feature_type === type ? name : "");
  const neighborhood = named("neighborhood");
  const town = named("locality");
  const sector = [neighborhood, town, name].map(s => s.match(/\b(?:Sector\s+)?([A-I]-\d{1,2}(?:\/\d{1,2})?)\b/i)?.[1]).find(Boolean) || "";
  const details: AddressDetails = {
    houseNumber: cleanText(c.address?.address_number),
    street: cleanText(c.address?.street_name) || named("street"),
    sector: sector ? `Sector ${sector.toUpperCase()}` : "",
    town, neighborhood, city: named("place"), district: named("district"),
    region: named("region"), postcode: named("postcode"), country: named("country"),
  };
  const formatted = joinParts([
    // Full address plus any context Mapbox omitted from its display string.
    ...cleanText(p.full_address).split(",").map(s => s.trim()),
    ...(!p.full_address ? [name, ...cleanText(p.place_formatted).split(",").map(s => s.trim())] : []),
    ...[details.neighborhood, details.town, details.postcode].filter(s => s && !cleanText(p.full_address || `${name}, ${p.place_formatted || ""}`).toLowerCase().includes(s.toLowerCase())),
  ]);
  return {
    placeId: cleanText(p.mapbox_id) || cleanText(feature.id) || `${lng},${lat}`,
    formatted, address: formatted, mainText: name || formatted,
    secondaryText: cleanText(p.place_formatted), lat, lng,
    city: details.city, area: details.sector || neighborhood || town,
    details, accuracy: cleanText(p.coordinates?.accuracy), featureType: cleanText(p.feature_type),
  };
}

export async function mapboxRequest(path: string, params: Record<string, string>, token: string, signal?: AbortSignal) {
  if (!token) throw new Error("Mapbox is not configured.");
  const url = new URL(`https://api.mapbox.com/${path}`);
  Object.entries({ ...params, access_token: token }).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Mapbox request failed (${response.status}). Please try again.`);
  return response.json();
}

export async function forwardMapbox(query: string, token: string, options: { autocomplete?: boolean; signal?: AbortSignal; proximity?: { lat: number; lng: number } } = {}): Promise<MapboxPlace[]> {
  const q = query.trim().replace(/;/g, ",").slice(0, 256).split(/\s+/).slice(0, 20).join(" ");
  if (q.length < 2) return [];
  const proximity = options.proximity && validCoordinates(options.proximity.lat, options.proximity.lng) ? options.proximity : { lat: 33.567348, lng: 73.104510 };
  const data = await mapboxRequest("search/geocode/v6/forward", {
    q, country: "pk", language: "en", limit: "8", permanent: "true",
    autocomplete: String(options.autocomplete ?? true),
    proximity: `${proximity.lng},${proximity.lat}`,
    types: "address,street,neighborhood,locality,place",
  }, token, options.signal);
  return (data.features || []).map(parseMapboxFeature).filter((p: MapboxPlace | null): p is MapboxPlace => p !== null);
}

export async function reverseMapbox(lat: number, lng: number, token: string, signal?: AbortSignal): Promise<MapboxPlace | null> {
  if (!validCoordinates(lat, lng)) throw new Error("Invalid map coordinates.");
  const data = await mapboxRequest("search/geocode/v6/reverse", {
    latitude: String(lat), longitude: String(lng), language: "en", permanent: "true",
  }, token, signal);
  return (data.features || []).map(parseMapboxFeature).find((p: MapboxPlace | null) => p !== null) || null;
}

export function deliveryFeeForRoute(distanceKm: number, rate: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error("Invalid delivery pricing.");
  return Math.max(50, Math.round(distanceKm * rate));
}

export async function drivingRoute(originLat: number, originLng: number, destLat: number, destLng: number, token: string, options: { signal?: AbortSignal; radiusMeters?: number } = {}) {
  if (!validCoordinates(originLat, originLng) || !validCoordinates(destLat, destLng)) throw new Error("Invalid map coordinates.");
  const data = await mapboxRequest(`directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`, {
    overview: "full", geometries: "geojson", steps: "false", alternatives: "false", radiuses: `100;${options.radiusMeters ?? 100}`,
  }, token, options.signal);
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route || !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || !route.geometry?.coordinates?.length) {
    throw new Error("No driving route reaches this pin. Move the pin to your entrance or a nearby accessible road.");
  }
  return {
    success: true, distanceMeters: route.distance, distanceKm: route.distance / 1000,
    durationMinutes: Math.max(1, Math.ceil(route.duration / 60)),
    routeCoordinates: route.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng })),
  };
}
