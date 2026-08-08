import { DeliveryArea, DeliveryCity } from "../types";

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
    throw new DeliveryServiceError("Network error loading delivery areas.");
  }

  const payload = (await response.json().catch(() => ({}))) as DeliveryAreasResponse;
  if (!response.ok) {
    throw new DeliveryServiceError(payload.error || "Unable to load delivery areas.", response.status);
  }

  return Array.isArray(payload.areas) ? payload.areas : [];
}
