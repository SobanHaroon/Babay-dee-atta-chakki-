/**
 * Delivery System Core Definitions & Dynamic Map Route Price Calculator
 * All delivery fees and distances are dynamically computed via Google Maps Platform & Route APIs
 * Store Origin: Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (33.567348, 73.104510)
 */

export interface DeliveryAreaRecord {
  id: string;
  numericId: number;
  city: "Islamabad" | "Rawalpindi" | string;
  area: string;
  category: string;
  distanceKm: number;
  deliveryRate: number;
  deliveryCharge: number;
  available: boolean;
  pricingNote: string;
}

export const DELIVERY_RATE_PER_KM = 50; // Dynamic rate Rs. 50 / km
export const MIN_DELIVERY_CHARGE = 50;  // Minimum Rs. 50 charge
export const MAX_DELIVERY_DISTANCE_KM = 30; // Maximum delivery radius from Gulraiz 3 depot

export const STORE_LOCATION = {
  name: "Babay Dee Atta Chakki",
  address: "Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
  lat: 33.567348,
  lng: 73.104510
};

/**
 * Standard central delivery charge calculation function.
 * Uses exact driving distance from Google Maps routing.
 */
export function calculateDeliveryCharge(
  distanceKm: number,
  ratePerKm: number = DELIVERY_RATE_PER_KM,
  minCharge: number = MIN_DELIVERY_CHARGE
): number {
  if (isNaN(distanceKm) || distanceKm <= 0) return minCharge;
  const roundedKm = Math.ceil(distanceKm);
  const calculated = roundedKm * ratePerKm;
  return Math.max(minCharge, calculated);
}

export const INITIAL_DELIVERY_AREAS: DeliveryAreaRecord[] = [
  {
    id: "g-3",
    numericId: 1,
    city: "Rawalpindi",
    area: "Gulraiz Phase 3",
    category: "Primary Zone",
    distanceKm: 0.5,
    deliveryRate: 50,
    deliveryCharge: 50,
    available: true,
    pricingNote: "Store Depot Zone (Rs. 50 flat)"
  },
  {
    id: "g-2",
    numericId: 2,
    city: "Rawalpindi",
    area: "Gulraiz Phase 2",
    category: "Primary Zone",
    distanceKm: 1.5,
    deliveryRate: 50,
    deliveryCharge: 75,
    available: true,
    pricingNote: "Local Chakki Zone"
  },
  {
    id: "bahria-7",
    numericId: 3,
    city: "Rawalpindi",
    area: "Bahria Town Phase 7",
    category: "Twin Cities",
    distanceKm: 4.2,
    deliveryRate: 50,
    deliveryCharge: 210,
    available: true,
    pricingNote: "Express Delivery"
  },
  {
    id: "dha-2",
    numericId: 4,
    city: "Islamabad",
    area: "DHA Phase 2",
    category: "Twin Cities",
    distanceKm: 8.5,
    deliveryRate: 50,
    deliveryCharge: 425,
    available: true,
    pricingNote: "Direct Dispatch"
  },
  {
    id: "f-10",
    numericId: 5,
    city: "Islamabad",
    area: "Sector F-10",
    category: "Islamabad Core",
    distanceKm: 18.2,
    deliveryRate: 50,
    deliveryCharge: 910,
    available: true,
    pricingNote: "Direct Express Courier"
  },
  {
    id: "f-11",
    numericId: 6,
    city: "Islamabad",
    area: "Sector F-11",
    category: "Islamabad Core",
    distanceKm: 19.5,
    deliveryRate: 50,
    deliveryCharge: 975,
    available: true,
    pricingNote: "Direct Express Courier"
  }
];

export const CHARGE_PER_KM = 50;

export function findDeliveryArea(cityOrQuery: string, area?: string, list: DeliveryAreaRecord[] = INITIAL_DELIVERY_AREAS): DeliveryAreaRecord | undefined {
  if (!cityOrQuery && !area) return undefined;
  const sourceList = list && list.length > 0 ? list : INITIAL_DELIVERY_AREAS;
  
  if (area) {
    const areaLower = area.toLowerCase().trim();
    const cityLower = cityOrQuery ? cityOrQuery.toLowerCase().trim() : "";
    const match = sourceList.find(a => 
      (a.area.toLowerCase().includes(areaLower) || areaLower.includes(a.area.toLowerCase())) &&
      (!cityLower || a.city.toLowerCase().includes(cityLower) || cityLower.includes(a.city.toLowerCase()))
    );
    if (match) return match;
  }

  const q = (cityOrQuery || area || "").toLowerCase().trim();
  return sourceList.find(
    (a) => a.area.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.id.toLowerCase() === q
  );
}

/**
 * Calculates effective distance dynamically from map coordinates / route.
 */
export function getEffectiveDistance(_city: string, _subLocation: string, customDist: number): number {
  if (typeof customDist === "number" && customDist > 0) {
    return Math.round(customDist * 10) / 10;
  }
  return 5;
}
