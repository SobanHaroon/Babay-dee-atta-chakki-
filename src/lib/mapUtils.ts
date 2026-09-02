/**
 * Utility functions for Geoapify Maps, driving route calculations,
 * and high-accuracy Twin Cities (Islamabad & Rawalpindi) geocoding/sector resolution.
 */

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export const GEOAPIFY_MAP_TILES_KEY =
  (import.meta as any).env?.VITE_GEOAPIFY_MAP_TILES_KEY ||
  (import.meta as any).env?.VITE_GEOAPIFY_API_KEY ||
  process.env.GEOAPIFY_MAP_TILES_KEY ||
  process.env.GEOAPIFY_API_KEY ||
  "443a4948e9f344ceb1d25b7ac672fabe";

export const GEOAPIFY_ROUTING_KEY =
  (import.meta as any).env?.VITE_GEOAPIFY_ROUTING_KEY ||
  (import.meta as any).env?.VITE_GEOAPIFY_API_KEY ||
  "807f1c518966416380a21121a25c2dcc";

export const GEOAPIFY_GEOCODING_KEY =
  (import.meta as any).env?.VITE_GEOAPIFY_GEOCODING_KEY ||
  (import.meta as any).env?.VITE_GEOAPIFY_API_KEY ||
  "6887f82b4326475e9039f018774f97fb";

/**
 * Returns the Geoapify raster tile URL template for Leaflet TileLayer
 */
export function getGeoapifyTileUrl(style: string = "osm-bright", apiKey: string = GEOAPIFY_MAP_TILES_KEY): string {
  return `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}.png?apiKey=${apiKey}`;
}

export function getGeoapifyRetinaTileUrl(style: string = "osm-bright", apiKey: string = GEOAPIFY_MAP_TILES_KEY): string {
  return `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}@2x.png?apiKey=${apiKey}`;
}

/**
 * Search Geoapify for address suggestions biased to Islamabad / Rawalpindi
 */
export async function searchGeoapifyPlaces(
  query: string,
  apiKey: string = GEOAPIFY_GEOCODING_KEY
): Promise<Array<{
  placeId: string;
  formatted: string;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
  city: string;
  area: string;
}>> {
  const clean = query.trim();
  if (!clean || clean.length < 2) return [];

  try {
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
      clean
    )}&filter=countrycode:pk&bias=proximity:73.104510,33.567348&limit=6&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.features && Array.isArray(data.features)) {
        return data.features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const lat = parseFloat(props.lat);
          const lng = parseFloat(props.lon);
          const mainText = props.address_line1 || props.name || props.street || clean;
          const secondaryText = props.address_line2 || `${props.city || "Rawalpindi"}, Pakistan`;
          const formatted = props.formatted || `${mainText}, ${secondaryText}`;
          const parsed = extractCityAndArea(formatted, lat, lng);
          return {
            placeId: props.place_id || `geo-${idx}-${lat}-${lng}`,
            formatted,
            mainText,
            secondaryText,
            lat,
            lng,
            city: parsed.city || props.city || "Rawalpindi",
            area: parsed.area || props.suburb || "Gulraiz Phase 3"
          };
        });
      }
    }
  } catch (err) {
    console.warn("Client Geoapify places search warning:", err);
  }
  return [];
}

/**
 * Decodes an encoded path string from Google Routes / Directions API into an array of {lat, lng} objects.
 * Standalone pure JS implementation with 0 dependencies.
 */
export function decodeGooglePolyline(encoded: string): LatLngPoint[] {
  if (!encoded) return [];
  const points: LatLngPoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

export function formatDistanceKm(km: number): string {
  if (isNaN(km) || km <= 0) return "0.1 km";
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return meters <= 100 ? "0.1 km" : `${meters}m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDurationMins(minutes: number): string {
  if (isNaN(minutes) || minutes <= 0) return "15-25 mins";
  if (minutes < 60) {
    return `${minutes} min${minutes > 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours} hr${hours > 1 ? "s" : ""} ${remainingMins} min`;
}

export interface TwinCityZone {
  name: string;
  city: "Islamabad" | "Rawalpindi";
  lat: number;
  lng: number;
  radiusKm?: number;
}

// Spatial database of Islamabad & Rawalpindi major sectors, societies, and neighborhoods
export const TWIN_CITIES_ZONES: TwinCityZone[] = [
  // Primary Store Origin & Nearby
  { name: "Gulraiz Phase 3", city: "Rawalpindi", lat: 33.567348, lng: 73.104510, radiusKm: 1.2 },
  { name: "Gulraiz Phase 2", city: "Rawalpindi", lat: 33.5620, lng: 73.0980, radiusKm: 1.5 },
  { name: "Gulraiz Phase 1", city: "Rawalpindi", lat: 33.5580, lng: 73.0920, radiusKm: 1.5 },
  { name: "High Court Road", city: "Rawalpindi", lat: 33.5650, lng: 73.1020, radiusKm: 2.0 },
  { name: "Chaklala Scheme 3", city: "Rawalpindi", lat: 33.5850, lng: 73.0800, radiusKm: 2.5 },
  { name: "Chaklala Scheme 2", city: "Rawalpindi", lat: 33.5900, lng: 73.0720, radiusKm: 2.0 },
  { name: "Chaklala Scheme 1", city: "Rawalpindi", lat: 33.6020, lng: 73.0850, radiusKm: 2.0 },
  { name: "Askari 10", city: "Rawalpindi", lat: 33.5850, lng: 73.0880, radiusKm: 1.5 },
  { name: "Askari 14", city: "Rawalpindi", lat: 33.5450, lng: 73.0500, radiusKm: 2.0 },
  { name: "Askari 1", city: "Rawalpindi", lat: 33.6050, lng: 73.0650, radiusKm: 1.5 },
  { name: "Askari 2", city: "Rawalpindi", lat: 33.5980, lng: 73.0680, radiusKm: 1.5 },
  { name: "Askari 3", city: "Rawalpindi", lat: 33.5920, lng: 73.0620, radiusKm: 1.5 },
  { name: "Askari 5", city: "Rawalpindi", lat: 33.5880, lng: 73.0580, radiusKm: 1.5 },

  // Bahria Town
  { name: "Bahria Town Phase 1", city: "Rawalpindi", lat: 33.5450, lng: 73.1180, radiusKm: 1.8 },
  { name: "Bahria Town Phase 2", city: "Rawalpindi", lat: 33.5410, lng: 73.1230, radiusKm: 1.8 },
  { name: "Bahria Town Phase 3", city: "Rawalpindi", lat: 33.5350, lng: 73.1270, radiusKm: 1.8 },
  { name: "Bahria Town Phase 4", city: "Rawalpindi", lat: 33.5280, lng: 73.1320, radiusKm: 2.0 },
  { name: "Bahria Town Phase 5", city: "Rawalpindi", lat: 33.5220, lng: 73.1360, radiusKm: 2.0 },
  { name: "Bahria Town Phase 6", city: "Rawalpindi", lat: 33.5180, lng: 73.1410, radiusKm: 2.0 },
  { name: "Bahria Town Phase 7", city: "Rawalpindi", lat: 33.5230, lng: 73.1050, radiusKm: 2.5 },
  { name: "Bahria Town Phase 8", city: "Rawalpindi", lat: 33.5050, lng: 73.0950, radiusKm: 3.0 },
  { name: "Safari Villas", city: "Rawalpindi", lat: 33.5380, lng: 73.1120, radiusKm: 1.5 },

  // DHA
  { name: "DHA Phase 1", city: "Rawalpindi", lat: 33.5300, lng: 73.1000, radiusKm: 2.5 },
  { name: "DHA Phase 2", city: "Islamabad", lat: 33.5150, lng: 73.1550, radiusKm: 3.5 },
  { name: "DHA Phase 3", city: "Rawalpindi", lat: 33.5000, lng: 73.1400, radiusKm: 3.0 },
  { name: "DHA Phase 4", city: "Rawalpindi", lat: 33.4900, lng: 73.1200, radiusKm: 3.0 },
  { name: "DHA Phase 5", city: "Islamabad", lat: 33.5100, lng: 73.1800, radiusKm: 3.0 },

  // Express Highway Societies
  { name: "PWD Housing Society", city: "Islamabad", lat: 33.5850, lng: 73.1450, radiusKm: 2.0 },
  { name: "Pakistan Town", city: "Islamabad", lat: 33.5800, lng: 73.1520, radiusKm: 2.0 },
  { name: "Police Foundation", city: "Rawalpindi", lat: 33.5900, lng: 73.1400, radiusKm: 1.8 },
  { name: "Soan Gardens", city: "Islamabad", lat: 33.5700, lng: 73.1600, radiusKm: 2.5 },
  { name: "Media Town", city: "Rawalpindi", lat: 33.5820, lng: 73.1350, radiusKm: 1.8 },
  { name: "Korang Town", city: "Islamabad", lat: 33.5980, lng: 73.1300, radiusKm: 1.8 },
  { name: "CBR Town Phase 1", city: "Islamabad", lat: 33.6050, lng: 73.1350, radiusKm: 1.8 },
  { name: "River Garden", city: "Islamabad", lat: 33.5650, lng: 73.1680, radiusKm: 1.8 },
  { name: "Naval Anchorage", city: "Islamabad", lat: 33.5600, lng: 73.1850, radiusKm: 2.5 },
  { name: "Gulberg Greens", city: "Islamabad", lat: 33.6200, lng: 73.1400, radiusKm: 3.5 },
  { name: "Gulberg Residencia", city: "Islamabad", lat: 33.6100, lng: 73.1800, radiusKm: 3.5 },
  { name: "Jinnah Garden", city: "Islamabad", lat: 33.5750, lng: 73.1750, radiusKm: 2.5 },

  // Rawalpindi Core
  { name: "Saddar", city: "Rawalpindi", lat: 33.5980, lng: 73.0530, radiusKm: 2.0 },
  { name: "Westridge 1", city: "Rawalpindi", lat: 33.6120, lng: 73.0180, radiusKm: 1.8 },
  { name: "Westridge 2", city: "Rawalpindi", lat: 33.6180, lng: 73.0120, radiusKm: 1.8 },
  { name: "Westridge 3", city: "Rawalpindi", lat: 33.6240, lng: 73.0060, radiusKm: 1.8 },
  { name: "Tench Bhata", city: "Rawalpindi", lat: 33.5820, lng: 73.0320, radiusKm: 1.8 },
  { name: "Peshawar Road", city: "Rawalpindi", lat: 33.6050, lng: 73.0250, radiusKm: 2.5 },
  { name: "Satellite Town", city: "Rawalpindi", lat: 33.6380, lng: 73.0680, radiusKm: 2.5 },
  { name: "Shamsabad", city: "Rawalpindi", lat: 33.6420, lng: 73.0780, radiusKm: 2.0 },
  { name: "6th Road / Murree Road", city: "Rawalpindi", lat: 33.6350, lng: 73.0750, radiusKm: 1.8 },
  { name: "Adiala Road", city: "Rawalpindi", lat: 33.5400, lng: 73.0400, radiusKm: 3.5 },
  { name: "Morgah", city: "Rawalpindi", lat: 33.5480, lng: 73.0700, radiusKm: 2.5 },
  { name: "Ayub Park", city: "Rawalpindi", lat: 33.5650, lng: 73.0750, radiusKm: 1.8 },
  { name: "Faizabad", city: "Islamabad", lat: 33.6640, lng: 73.0850, radiusKm: 1.8 },

  // Islamabad CDA Sectors
  { name: "Sector I-8", city: "Islamabad", lat: 33.6680, lng: 73.0750, radiusKm: 1.8 },
  { name: "Sector I-9", city: "Islamabad", lat: 33.6600, lng: 73.0500, radiusKm: 1.8 },
  { name: "Sector I-10", city: "Islamabad", lat: 33.6500, lng: 73.0300, radiusKm: 1.8 },
  { name: "Sector I-11", city: "Islamabad", lat: 33.6400, lng: 73.0100, radiusKm: 1.8 },
  { name: "Sector H-8", city: "Islamabad", lat: 33.6780, lng: 73.0650, radiusKm: 1.8 },
  { name: "Sector H-9", city: "Islamabad", lat: 33.6700, lng: 73.0450, radiusKm: 1.8 },
  { name: "Sector H-10", city: "Islamabad", lat: 33.6600, lng: 73.0250, radiusKm: 1.8 },
  { name: "Sector H-11", city: "Islamabad", lat: 33.6500, lng: 73.0050, radiusKm: 1.8 },
  { name: "Sector H-12 (NUST)", city: "Islamabad", lat: 33.6450, lng: 72.9900, radiusKm: 2.0 },
  { name: "Sector H-13", city: "Islamabad", lat: 33.6350, lng: 72.9750, radiusKm: 2.0 },
  { name: "Sector G-6", city: "Islamabad", lat: 33.7150, lng: 73.0900, radiusKm: 1.8 },
  { name: "Sector G-7", city: "Islamabad", lat: 33.7050, lng: 73.0700, radiusKm: 1.8 },
  { name: "Sector G-8", city: "Islamabad", lat: 33.6950, lng: 73.0500, radiusKm: 1.8 },
  { name: "Sector G-9 (Karachi Company)", city: "Islamabad", lat: 33.6880, lng: 73.0300, radiusKm: 1.8 },
  { name: "Sector G-10", city: "Islamabad", lat: 33.6780, lng: 73.0100, radiusKm: 1.8 },
  { name: "Sector G-11", city: "Islamabad", lat: 33.6680, lng: 72.9900, radiusKm: 1.8 },
  { name: "Sector G-12", city: "Islamabad", lat: 33.6580, lng: 72.9700, radiusKm: 1.8 },
  { name: "Sector G-13", city: "Islamabad", lat: 33.6480, lng: 72.9500, radiusKm: 1.8 },
  { name: "Sector G-14", city: "Islamabad", lat: 33.6380, lng: 72.9300, radiusKm: 1.8 },
  { name: "Sector G-15", city: "Islamabad", lat: 33.6280, lng: 72.9100, radiusKm: 2.0 },
  { name: "Sector F-6 (Super Market)", city: "Islamabad", lat: 33.7300, lng: 73.0750, radiusKm: 1.8 },
  { name: "Sector F-7 (Jinnah Super)", city: "Islamabad", lat: 33.7200, lng: 73.0550, radiusKm: 1.8 },
  { name: "Sector F-8", city: "Islamabad", lat: 33.7100, lng: 73.0350, radiusKm: 1.8 },
  { name: "Sector F-10 (Markaz)", city: "Islamabad", lat: 33.6920, lng: 73.0000, radiusKm: 1.8 },
  { name: "Sector F-11", city: "Islamabad", lat: 33.6820, lng: 72.9800, radiusKm: 1.8 },
  { name: "Sector E-7", city: "Islamabad", lat: 33.7380, lng: 73.0450, radiusKm: 1.8 },
  { name: "Sector E-11", city: "Islamabad", lat: 33.7000, lng: 72.9700, radiusKm: 2.0 },
  { name: "Sector D-12", city: "Islamabad", lat: 33.7150, lng: 72.9450, radiusKm: 2.0 },
  { name: "Sector B-17 (Multi Gardens)", city: "Islamabad", lat: 33.6900, lng: 72.8200, radiusKm: 3.5 },
  { name: "Blue Area", city: "Islamabad", lat: 33.7100, lng: 73.0600, radiusKm: 2.5 },
  { name: "Bani Gala", city: "Islamabad", lat: 33.7100, lng: 73.1400, radiusKm: 4.0 },
  { name: "Bhara Kahu", city: "Islamabad", lat: 33.7400, lng: 73.1800, radiusKm: 4.0 },
  { name: "Chak Shahzad", city: "Islamabad", lat: 33.6600, lng: 73.1350, radiusKm: 3.0 },
  { name: "Bahria Enclave", city: "Islamabad", lat: 33.6850, lng: 73.2350, radiusKm: 3.5 }
];

// Helper: Calculate direct distance between two coordinates in kilometers
export function computeDistanceBetweenCoords(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find closest Twin City sector/zone from coordinate pair
export function findClosestTwinCityZone(
  lat: number,
  lng: number
): { zone: TwinCityZone; distanceKm: number } {
  let closest = TWIN_CITIES_ZONES[0];
  let minDistance = 99999;

  for (const z of TWIN_CITIES_ZONES) {
    const dist = computeDistanceBetweenCoords(lat, lng, z.lat, z.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = z;
    }
  }

  return { zone: closest, distanceKm: minDistance };
}

/**
 * Intelligent parser to extract City and Area/Sector from Google Maps / Geocoding results
 * Works specifically for Islamabad & Rawalpindi and surrounding regions.
 */
export function extractCityAndArea(
  addressStr: string,
  lat?: number,
  lng?: number
): { city: string; area: string } {
  const hasCoords = lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng);
  const closestData = hasCoords ? findClosestTwinCityZone(lat!, lng!) : null;

  if (!addressStr || typeof addressStr !== "string" || addressStr.trim() === "") {
    if (closestData) {
      return {
        city: closestData.zone.city,
        area: closestData.zone.name
      };
    }
    const defaultCity = lat && lat > 33.645 ? "Islamabad" : "Rawalpindi";
    return { city: defaultCity, area: defaultCity === "Islamabad" ? "Sector F-10" : "Gulraiz Phase 3" };
  }

  const clean = addressStr.trim();
  const lower = clean.toLowerCase();

  // 1. Determine City
  let city: "Islamabad" | "Rawalpindi" = "Rawalpindi";
  if (lower.includes("islamabad") || lower.includes("isb") || (lat && lat > 33.655)) {
    city = "Islamabad";
  } else if (lower.includes("rawalpindi") || lower.includes("rwp") || (lat && lat <= 33.655)) {
    city = "Rawalpindi";
  }

  // 2. Extract Area / Sector via regex patterns
  let area = "";

  // Pattern A: CDA Sector format (e.g. Sector F-10/2, Sector I-8/4, F-11/1, G-13, E-7, H-12, D-12, B-17, etc.)
  const sectorMatch = clean.match(/(?:Sector\s+)?\b([A-Ia-i])-?\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{1,2}))?(?:\s*(?:Markaz|Sector))?\b/i);
  if (sectorMatch) {
    const letter = sectorMatch[1].toUpperCase();
    const secNum = sectorMatch[2];
    const subNum = sectorMatch[3];
    const isMarkaz = /Markaz/i.test(sectorMatch[0]);
    area = `Sector ${letter}-${secNum}${subNum ? `/${subNum}` : ""}${isMarkaz ? " Markaz" : ""}`;
    city = "Islamabad";
  }

  // Pattern B: Major Societies & Schemes
  if (!area) {
    const societyPatterns: Array<{ regex: RegExp; name: string; city?: "Islamabad" | "Rawalpindi" }> = [
      { regex: /Gulraiz(?:\s*(?:Housing)?\s*Scheme)?(?:\s*Phase\s*(\d+))?/i, name: "Gulraiz", city: "Rawalpindi" },
      { regex: /Gulrez(?:\s*(?:Housing)?\s*Scheme)?(?:\s*Phase\s*(\d+))?/i, name: "Gulraiz", city: "Rawalpindi" },
      { regex: /High\s*Court\s*Road/i, name: "High Court Road", city: "Rawalpindi" },
      { regex: /Bahria\s*Town(?:\s*Phase\s*(\d+)|(?:\s*Enclave))?/i, name: "Bahria Town" },
      { regex: /Safari\s*Villas/i, name: "Safari Villas", city: "Rawalpindi" },
      { regex: /DHA(?:\s*Phase\s*(\d+))?/i, name: "DHA" },
      { regex: /PWD(?:\s*Housing\s*Society)?/i, name: "PWD Housing Society", city: "Islamabad" },
      { regex: /Chaklala\s*Scheme\s*(\d+)/i, name: "Chaklala Scheme", city: "Rawalpindi" },
      { regex: /Askari\s*(\d+)/i, name: "Askari", city: "Rawalpindi" },
      { regex: /Satellite\s*Town(?:\s*Block\s*([A-Za-z\d]+))?/i, name: "Satellite Town", city: "Rawalpindi" },
      { regex: /Westridge(?:\s*(\d+))?/i, name: "Westridge", city: "Rawalpindi" },
      { regex: /Saddar/i, name: "Saddar", city: "Rawalpindi" },
      { regex: /Media\s*Town/i, name: "Media Town", city: "Rawalpindi" },
      { regex: /Gulberg\s*Greens/i, name: "Gulberg Greens", city: "Islamabad" },
      { regex: /Gulberg\s*Residencia/i, name: "Gulberg Residencia", city: "Islamabad" },
      { regex: /Soan\s*Garden[s]?/i, name: "Soan Gardens", city: "Islamabad" },
      { regex: /Police\s*Foundation/i, name: "Police Foundation", city: "Rawalpindi" },
      { regex: /Pakistan\s*Town(?:\s*Phase\s*(\d+))?/i, name: "Pakistan Town", city: "Islamabad" },
      { regex: /Koral\s*Town/i, name: "Koral Town", city: "Islamabad" },
      { regex: /CBR\s*Town/i, name: "CBR Town", city: "Islamabad" },
      { regex: /River\s*Garden/i, name: "River Garden", city: "Islamabad" },
      { regex: /Bani\s*Gala/i, name: "Bani Gala", city: "Islamabad" },
      { regex: /Bhara\s*Kahu/i, name: "Bhara Kahu", city: "Islamabad" },
      { regex: /Chak\s*Shahzad/i, name: "Chak Shahzad", city: "Islamabad" },
      { regex: /Blue\s*Area/i, name: "Blue Area", city: "Islamabad" },
      { regex: /Aabpara/i, name: "Aabpara", city: "Islamabad" },
      { regex: /Naval\s*Anchorage/i, name: "Naval Anchorage", city: "Islamabad" },
      { regex: /Park\s*View\s*City/i, name: "Park View City", city: "Islamabad" },
      { regex: /Jinnah\s*Garden/i, name: "Jinnah Garden", city: "Islamabad" },
      { regex: /Shamsabad/i, name: "Shamsabad", city: "Rawalpindi" },
      { regex: /Tench\s*Bhata/i, name: "Tench Bhata", city: "Rawalpindi" },
      { regex: /Adiala\s*Road/i, name: "Adiala Road", city: "Rawalpindi" },
      { regex: /Morgah/i, name: "Morgah", city: "Rawalpindi" },
      { regex: /Ayub\s*Park/i, name: "Ayub Park", city: "Rawalpindi" },
      { regex: /Peshawar\s*Road/i, name: "Peshawar Road", city: "Rawalpindi" },
      { regex: /Faizabad/i, name: "Faizabad", city: "Islamabad" }
    ];

    for (const item of societyPatterns) {
      const match = clean.match(item.regex);
      if (match) {
        const extra = match[1] ? ` Phase ${match[1]}` : "";
        area = `${item.name}${extra}`;
        if (item.city) city = item.city;
        break;
      }
    }
  }

  // Pattern C: Comma separated first or second segment if no regex matched
  if (!area) {
    const parts = clean.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const filteredParts = parts.filter(
        p => !p.toLowerCase().includes("pakistan") && 
             !p.toLowerCase().includes("punjab") && 
             !p.toLowerCase().includes("capital territory") &&
             !p.toLowerCase().includes("rawalpindi") &&
             !p.toLowerCase().includes("islamabad") &&
             !/^\d{4,5}$/.test(p)
      );
      if (filteredParts.length > 0) {
        area = filteredParts[filteredParts.length - 1] || filteredParts[0];
      }
    }
  }

  // Pattern D: Coordinate spatial proximity fallback (if area is empty or too generic)
  if (!area && closestData) {
    area = closestData.zone.name;
    city = closestData.zone.city;
  }

  if (!area) {
    area = city === "Islamabad" ? "Sector F-10" : "Gulraiz Phase 3";
  }

  return { city, area };
}

/**
 * High-accuracy reverse geocode from Coordinates (Lat, Lng) to Human-Readable Street / Area Address.
 * Never outputs raw coordinates.
 */
export async function reverseGeocodeLatLng(
  lat: number,
  lng: number,
  apiKey: string = GEOAPIFY_GEOCODING_KEY
): Promise<{ address: string; city: string; area: string }> {
  // 1. Try Geoapify Reverse Geocoding API
  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const formatted = item.formatted || [item.address_line1, item.address_line2].filter(Boolean).join(", ");
        if (formatted) {
          const parsed = extractCityAndArea(formatted, lat, lng);
          return {
            address: formatted,
            city: parsed.city || item.city || (lat > 33.655 ? "Islamabad" : "Rawalpindi"),
            area: parsed.area || item.suburb || "Gulraiz Phase 3"
          };
        }
      }
    }
  } catch (err) {
    console.warn("Client reverseGeocodeLatLng Geoapify note:", err);
  }

  // 2. Twin City spatial nearest sector/society resolver fallback
  const zoneInfo = findClosestTwinCityZone(lat, lng);
  const city = zoneInfo ? zoneInfo.zone.city : (lat > 33.655 ? "Islamabad" : "Rawalpindi");
  const area = zoneInfo ? zoneInfo.zone.name : "Gulraiz Phase 3";
  return {
    address: `${area}, ${city}, Pakistan`,
    city,
    area
  };
}

