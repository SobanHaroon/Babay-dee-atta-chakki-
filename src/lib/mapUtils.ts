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


export function normalizeAddress(addr: string): string {
  if (!addr || typeof addr !== "string") return "";
  return addr
    .toLowerCase()
    .replace(/[,\.\-\#\/\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates whether two customer address representations match logically.
 */
export function areAddressesMatching(addr1: string, addr2: string): boolean {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  // If one string contains the other (e.g. customer appended landmark or unit detail)
  if (norm1.length >= 10 && norm2.length >= 10) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }
  }
  return false;
}

