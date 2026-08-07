export interface DeliveryLocation {
  name: string;
  city: "Rawalpindi" | "Islamabad";
  distanceKm: number;
}

export const DELIVERY_LOCATIONS: DeliveryLocation[] = [
  // ===== RAWALPINDI =====
  // City Center & Main Areas
  { name: "Gulrez Housing Scheme (Phase 1-5)", city: "Rawalpindi", distanceKm: 1.5 },
  { name: "High Court Road / Korang Town", city: "Rawalpindi", distanceKm: 2.0 },
  { name: "Saddar Rawalpindi / Cantt", city: "Rawalpindi", distanceKm: 3.0 },
  { name: "Raja Bazaar / Masjid Road", city: "Rawalpindi", distanceKm: 2.5 },
  { name: "Ganj Bazaar / Adiala Road", city: "Rawalpindi", distanceKm: 4.0 },
  { name: "Satellite Town (Phase 1-5)", city: "Rawalpindi", distanceKm: 5.5 },
  
  // DHA Rawalpindi
  { name: "DHA Phase 1 (Rawalpindi)", city: "Rawalpindi", distanceKm: 4.5 },
  { name: "DHA Phase 2 (Rawalpindi)", city: "Rawalpindi", distanceKm: 7.0 },
  { name: "DHA Phase 3 (Rawalpindi)", city: "Rawalpindi", distanceKm: 8.5 },
  { name: "DHA Phase 4 (Rawalpindi)", city: "Rawalpindi", distanceKm: 9.5 },
  
  // Bahria Town Rawalpindi
  { name: "Bahria Town (Phase 1-6)", city: "Rawalpindi", distanceKm: 5.5 },
  { name: "Bahria Town (Phase 7-8)", city: "Rawalpindi", distanceKm: 8.5 },
  { name: "Bahria Town (Phase 9-10)", city: "Rawalpindi", distanceKm: 10.0 },
  
  // Schemes & Housing
  { name: "Chaklala Scheme 3", city: "Rawalpindi", distanceKm: 3.5 },
  { name: "Chaklala Scheme 4", city: "Rawalpindi", distanceKm: 4.0 },
  { name: "Jinnah Garden / PIMS", city: "Rawalpindi", distanceKm: 3.5 },
  { name: "New Town / Waqar Colony", city: "Rawalpindi", distanceKm: 4.5 },
  { name: "Officers' Colony", city: "Rawalpindi", distanceKm: 3.0 },
  { name: "Wah Cantonment", city: "Rawalpindi", distanceKm: 15.0 },
  
  // Outer Areas & Roads
  { name: "Adyala Road / Gorakhpur", city: "Rawalpindi", distanceKm: 10.0 },
  { name: "Peshawar Road / Westridge", city: "Rawalpindi", distanceKm: 12.0 },
  { name: "Shamsabad / Murree Road", city: "Rawalpindi", distanceKm: 11.0 },
  { name: "Chakbeli Road", city: "Rawalpindi", distanceKm: 6.5 },
  { name: "Mall Road / The Mall", city: "Rawalpindi", distanceKm: 3.5 },
  { name: "Pindi Point / Tarnol", city: "Rawalpindi", distanceKm: 8.0 },
  { name: "Taxila / Hasan Abdal", city: "Rawalpindi", distanceKm: 18.0 },
  { name: "Kalar Syedan", city: "Rawalpindi", distanceKm: 12.0 },
  { name: "Saidpur Village", city: "Rawalpindi", distanceKm: 7.0 },
  
  // ===== ISLAMABAD =====
  // Blue Area & Diplomatic Enclave
  { name: "Blue Area (Blocks A-L)", city: "Islamabad", distanceKm: 18.0 },
  { name: "Diplomatic Enclave", city: "Islamabad", distanceKm: 20.0 },
  
  // Main Sectors (I-Series)
  { name: "Sector I-8 / I-9", city: "Islamabad", distanceKm: 12.0 },
  { name: "Sector I-10", city: "Islamabad", distanceKm: 13.5 },
  
  // G-Series
  { name: "Sector G-6 / G-7", city: "Islamabad", distanceKm: 15.0 },
  { name: "Sector G-8 / G-9", city: "Islamabad", distanceKm: 14.5 },
  { name: "Sector G-10 / G-11", city: "Islamabad", distanceKm: 19.0 },
  { name: "Sector G-12 / G-13", city: "Islamabad", distanceKm: 20.0 },
  { name: "Sector G-14 / G-15", city: "Islamabad", distanceKm: 21.5 },
  
  // F-Series
  { name: "Sector F-6 / F-7", city: "Islamabad", distanceKm: 17.0 },
  { name: "Sector F-8 / F-9", city: "Islamabad", distanceKm: 16.5 },
  { name: "Sector F-10 / F-11", city: "Islamabad", distanceKm: 19.0 },
  { name: "Sector F-12 / F-13", city: "Islamabad", distanceKm: 20.0 },
  
  // E-Series & H-Series
  { name: "Sector E-11 / E-12", city: "Islamabad", distanceKm: 22.5 },
  { name: "Sector H-8 / H-9", city: "Islamabad", distanceKm: 18.0 },
  { name: "Sector H-12 (NUST) / H-13", city: "Islamabad", distanceKm: 21.0 },
  
  // D-Series
  { name: "Sector D-12 / D-13", city: "Islamabad", distanceKm: 23.0 },
  
  // Special Areas & Landmarks
  { name: "DHA Phase 2 (Islamabad Zone)", city: "Islamabad", distanceKm: 10.5 },
  { name: "DHA Phase 3 & 4 (Islamabad)", city: "Islamabad", distanceKm: 12.5 },
  { name: "Bani Gala / Kurri Road", city: "Islamabad", distanceKm: 18.5 },
  { name: "Barakahu / Thalian", city: "Islamabad", distanceKm: 25.0 },
  { name: "Sarmchal / Margalla Hills", city: "Islamabad", distanceKm: 22.0 },
  { name: "Sector B-17 / Multi Gardens", city: "Islamabad", distanceKm: 34.0 },
  { name: "Islamabad Express Way (Chakri)", city: "Islamabad", distanceKm: 28.0 },
  { name: "Adiala Road (Islamabad Side)", city: "Islamabad", distanceKm: 16.0 },
  
  // Suburban Areas
  { name: "Alipur / PWD Housing", city: "Islamabad", distanceKm: 24.0 },
  { name: "Sangjani / Koral", city: "Islamabad", distanceKm: 30.0 },
  { name: "Chatri Pani / Tarnol Link", city: "Islamabad", distanceKm: 26.0 }
];

export const CHARGE_PER_KM = 50;

export function calculateDeliveryCharge(distanceKm: number): number {
  return Math.round(distanceKm * CHARGE_PER_KM);
}
