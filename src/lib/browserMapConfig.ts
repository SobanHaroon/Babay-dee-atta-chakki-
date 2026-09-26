export const MAPBOX_ACCESS_TOKEN = (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN || "";
export function getMapboxTileUrl() {
  return "https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=" + MAPBOX_ACCESS_TOKEN;
}
