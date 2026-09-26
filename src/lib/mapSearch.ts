import type { MapboxPlace } from "./mapbox";
export async function searchMapboxPlaces(query: string, signal?: AbortSignal, proximity?: { lat: number; lng: number }): Promise<MapboxPlace[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch("/api/delivery/autocomplete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query.trim(), proximity }), signal,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Address search is unavailable. Please retry.");
  return data.results;
}
