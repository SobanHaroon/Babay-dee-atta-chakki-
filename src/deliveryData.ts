export interface DeliveryLocation {
  name: string;
  city: "Rawalpindi" | "Islamabad";
  distanceKm: number;
}

export const DELIVERY_LOCATIONS: DeliveryLocation[] = [
  // Rawalpindi (Store is at Main High Court Road, near Gulrez 3 entrance)
  { name: "Gulrez Housing Scheme (Phase 1-5)", city: "Rawalpindi", distanceKm: 1.5 },
  { name: "High Court Road / Korang Town", city: "Rawalpindi", distanceKm: 2.0 },
  { name: "Chaklala Scheme 3", city: "Rawalpindi", distanceKm: 3.5 },
  { name: "DHA Phase 1 (Rawalpindi)", city: "Rawalpindi", distanceKm: 4.5 },
  { name: "Bahria Town (Phase 1-6)", city: "Rawalpindi", distanceKm: 5.5 },
  { name: "Saddar Rawalpindi / Cantt", city: "Rawalpindi", distanceKm: 6.5 },
  { name: "DHA Phase 2 (Rawalpindi)", city: "Rawalpindi", distanceKm: 7.0 },
  { name: "Bahria Town (Phase 7-8)", city: "Rawalpindi", distanceKm: 8.5 },
  { name: "Adyala Road / Gorakhpur", city: "Rawalpindi", distanceKm: 10.0 },
  { name: "Peshawar Road / Westridge", city: "Rawalpindi", distanceKm: 12.0 },
  { name: "Shamsabad / Murree Road", city: "Rawalpindi", distanceKm: 11.0 },

  // Islamabad
  { name: "DHA Phase 2 (Islamabad Zone)", city: "Islamabad", distanceKm: 10.5 },
  { name: "Sector I-8 / I-9", city: "Islamabad", distanceKm: 12.0 },
  { name: "Sector G-8 / G-9", city: "Islamabad", distanceKm: 14.5 },
  { name: "Sector G-6 / G-7", city: "Islamabad", distanceKm: 15.0 },
  { name: "Sector F-6 / F-7", city: "Islamabad", distanceKm: 17.0 },
  { name: "Sector F-8 / G-10", city: "Islamabad", distanceKm: 16.5 },
  { name: "Sector F-10 / F-11", city: "Islamabad", distanceKm: 19.0 },
  { name: "Sector G-11 / G-13", city: "Islamabad", distanceKm: 20.0 },
  { name: "Sector E-11 / D-12", city: "Islamabad", distanceKm: 22.5 },
  { name: "Sector H-12 (NUST) / H-13", city: "Islamabad", distanceKm: 21.0 },
  { name: "Bani Gala / Kurri Road", city: "Islamabad", distanceKm: 18.5 },
  { name: "Barakahu", city: "Islamabad", distanceKm: 25.0 },
  { name: "Sector B-17 / Multi Gardens", city: "Islamabad", distanceKm: 34.0 }
];

export const CHARGE_PER_KM = 50;

export function calculateDeliveryCharge(distanceKm: number): number {
  return Math.round(distanceKm * CHARGE_PER_KM);
}
