import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Navigation, Loader2 } from "lucide-react";
import { getMapboxTileUrl } from "../lib/browserMapConfig";
import { searchMapboxPlaces } from "../lib/mapSearch";
import { detectDeviceLocation } from "../lib/geolocation";
import { validCoordinates, type AddressDetails, type MapboxPlace } from "../lib/mapbox";
import { formatDistanceKm } from "../lib/mapUtils";

export const STORE_EXACT_COORDINATES = { lat: 33.567348, lng: 73.104510 };
export const STORE_EXACT_DETAILS = { name: "Babay Dee Atta Chakki", address: "Main Gulraiz Phase 3 / High Court Rd, Rawalpindi", mapsUrl: "https://maps.app.goo.gl/k7Cjakmyvd227jpE7", pricePerKm: 50, maxDeliveryDistanceKm: 45 };
interface Selection { lat: number; lng: number; address: string; city: string; area: string; distanceKm: number; deliveryCharge: number; deliverable: boolean; details?: AddressDetails }
interface Props {
  initialLat?: number; initialLng?: number; initialAddress?: string;
  selectedLat?: number; selectedLng?: number; addressInput?: string;
  onLocationChange: (data: Selection) => void;
  onVerificationChange?: (pending: boolean) => void;
}
export interface DeliveryCalculationResult {
  success: boolean; deliverable: boolean; distanceKm: number; deliveryCharge: number;
  durationMinutes: number; pricePerKm: number; maxDeliveryDistanceKm: number;
  city: string; area: string; details?: AddressDetails;
  storeLocation: { lat: number; lng: number; name: string; address: string };
  customerLocation: { lat: number; lng: number; address: string };
  routeCoordinates: { lat: number; lng: number }[];
}
const pinIcon = (store = false) => L.divIcon({
  className: "delivery-map-marker",
  html: '<div style="width:28px;height:28px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + (store ? '#3b4414' : '#d97706') + ';box-shadow:0 2px 5px #0005"></div>',
  iconSize: [28, 28], iconAnchor: [14, 28],
});
export const DeliveryMapPicker: React.FC<Props> = props => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const storeMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const accuracyCircle = useRef<L.Circle | null>(null);
  const callbacks = useRef(props); callbacks.current = props;
  const selected = useRef<{ lat: number; lng: number } | null>(null);
  const routeRequest = useRef<AbortController | null>(null);
  const gpsRequest = useRef<AbortController | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapboxPlace[]>([]);
  const [activeResult, setActiveResult] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [quote, setQuote] = useState<DeliveryCalculationResult | null>(null);
  const [address, setAddress] = useState("");
  const [needsPinConfirmation, setNeedsPinConfirmation] = useState(false);
  const chooseLocation = async (lat: number, lng: number, hint = "", place?: MapboxPlace, deviceAccuracy?: number, requireRefinement = false) => {
    if (!validCoordinates(lat, lng)) return;
    gpsRequest.current?.abort(); setDetecting(false);
    routeRequest.current?.abort();
    const controller = new AbortController(); routeRequest.current = controller;
    const requiresConfirmation = requireRefinement || Boolean(place && place.featureType !== "address") || (deviceAccuracy !== undefined && deviceAccuracy > 100);
    setNeedsPinConfirmation(requiresConfirmation);
    selected.current = { lat, lng };
    setQuote(null); setError(""); setBusy(true); setAddress(hint); setAccuracy(deviceAccuracy ?? null);
    callbacks.current.onVerificationChange?.(true);
    routeLine.current?.remove(); routeLine.current = null;
    accuracyCircle.current?.remove(); accuracyCircle.current = null;
    if (map.current) {
      if (!marker.current) {
        marker.current = L.marker([lat, lng], { draggable: true, icon: pinIcon(), title: "Drag delivery pin to your entrance" }).addTo(map.current);
        marker.current.on("dragstart", () => {
          routeRequest.current?.abort(); gpsRequest.current?.abort();
          setQuote(null); setBusy(true); callbacks.current.onVerificationChange?.(true);
        });
        marker.current.on("dragend", () => { const point = marker.current!.getLatLng(); void choose.current(point.lat, point.lng); });
      } else marker.current.setLatLng([lat, lng]);
      if (deviceAccuracy !== undefined) accuracyCircle.current = L.circle([lat, lng], { radius: deviceAccuracy, color: "#2563eb", weight: 1, fillOpacity: 0.1 }).addTo(map.current);
    }
    try {
      const response = await fetch("/api/delivery/calculate-route", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng, address: hint }), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !data.success) throw new Error(data.error || "Could not verify delivery charges. Please retry.");
      const resolved = hint || data.customerLocation.address || "";
      const city = place?.city || data.city || "", area = place?.area || data.area || "";
      setAddress(resolved); setQuote(data);
      if (map.current) {
        storeMarker.current?.setLatLng([data.storeLocation.lat, data.storeLocation.lng]);
        routeLine.current = L.polyline(data.routeCoordinates.map((p: { lat: number; lng: number }) => [p.lat, p.lng]), { color: data.deliverable ? "#3b4414" : "#dc2626", weight: 4 }).addTo(map.current);
      }
      callbacks.current.onLocationChange({ lat, lng, address: resolved, city, area, distanceKm: data.distanceKm, deliveryCharge: data.deliveryCharge, deliverable: data.deliverable && !requiresConfirmation, details: place?.details || data.details });
      if (!resolved) setError("Address details are unavailable for this pin. Enter your house, street and area below.");
    } catch (e: any) {
      if (!controller.signal.aborted) setError(e.message || "Unable to verify delivery charges. Please retry.");
    } finally {
      if (!controller.signal.aborted) { setBusy(false); callbacks.current.onVerificationChange?.(false); }
    }
  };
  const choose = useRef(chooseLocation); choose.current = chooseLocation;
  useEffect(() => {
    if (!container.current) return;
    const start = validCoordinates(props.initialLat, props.initialLng) ? { lat: props.initialLat!, lng: props.initialLng! } : STORE_EXACT_COORDINATES;
    const instance = L.map(container.current, { center: [start.lat, start.lng], zoom: 15, scrollWheelZoom: true }); map.current = instance;
    const tiles = L.tileLayer(getMapboxTileUrl(), { maxZoom: 22, maxNativeZoom: 22, attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> <a href="https://apps.mapbox.com/feedback/">Improve this map</a>' }).addTo(instance);
    tiles.on("tileerror", () => setError("Map tiles could not load. Check your connection and retry."));
    storeMarker.current = L.marker([STORE_EXACT_COORDINATES.lat, STORE_EXACT_COORDINATES.lng], { icon: pinIcon(true), title: STORE_EXACT_DETAILS.name }).addTo(instance).bindTooltip(STORE_EXACT_DETAILS.name);
    instance.on("click", (e: L.LeafletMouseEvent) => void choose.current(e.latlng.lat, e.latlng.lng));
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(container.current);
    if (validCoordinates(props.initialLat, props.initialLng)) void choose.current(start.lat, start.lng, props.initialAddress);
    return () => {
      observer.disconnect(); routeRequest.current?.abort(); gpsRequest.current?.abort(); searchRequest.current?.abort();
      if (searchTimer.current) clearTimeout(searchTimer.current);
      instance.remove(); map.current = null; marker.current = null; routeLine.current = null; accuracyCircle.current = null; selected.current = null;
    };
  }, []);
  useEffect(() => {
    if (!validCoordinates(props.selectedLat, props.selectedLng)) return;
    if (selected.current?.lat === props.selectedLat && selected.current?.lng === props.selectedLng) return;
    map.current?.setView([props.selectedLat!, props.selectedLng!], 18);
    void choose.current(props.selectedLat!, props.selectedLng!, props.addressInput, undefined, undefined, true);
  }, [props.selectedLat, props.selectedLng, props.addressInput]);
  const search = (value: string) => {
    setQuery(value); setResults([]); setActiveResult(-1); setSearchMessage(""); searchRequest.current?.abort();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(value.trim().length >= 2); if (value.trim().length < 2) return;
    const controller = new AbortController(); searchRequest.current = controller;
    searchTimer.current = setTimeout(async () => {
      try {
        const places = await searchMapboxPlaces(value, controller.signal, map.current?.getCenter());
        if (controller.signal.aborted) return;
        setResults(places); setSearchMessage(places.length ? "" : "No address found. Try the street or sector, then place the pin at your entrance.");
      } catch (e: any) { if (!controller.signal.aborted) setSearchMessage(e.message); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 350);
  };
  const selectResult = (place: MapboxPlace) => {
    searchRequest.current?.abort(); if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery(place.formatted); setResults([]); setSearching(false); setSearchMessage("");
    map.current?.setView([place.lat, place.lng], place.featureType === "address" ? 18 : place.featureType === "place" ? 13 : 16);
    void choose.current(place.lat, place.lng, place.formatted, place);
  };
  const detect = async () => {
    gpsRequest.current?.abort(); const controller = new AbortController(); gpsRequest.current = controller;
    setDetecting(true); setError("");
    try {
      const position = await detectDeviceLocation(controller.signal); if (controller.signal.aborted) return;
      const { latitude, longitude, accuracy } = position.coords;
      map.current?.setView([latitude, longitude], accuracy <= 100 ? 18 : 15);
      void choose.current(latitude, longitude, "", undefined, accuracy);
    } catch (e: any) { if (!controller.signal.aborted) setError(e.message); }
    finally { if (!controller.signal.aborted) setDetecting(false); }
  };
  return <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden text-slate-800">
    <div className="p-4 bg-slate-50 space-y-3">
      <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Select delivery location</h3><p className="text-xs text-slate-500">Search, then place the pin at your entrance.</p></div>
        <button type="button" onClick={detect} disabled={detecting} className="flex gap-1 items-center rounded-lg bg-[#3b4414] text-white p-2 text-xs shrink-0">{detecting ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />} Detect location</button></div>
      <div className="relative">
        <input aria-label="Search delivery address" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="delivery-search-results" aria-activedescendant={activeResult >= 0 ? 'delivery-result-' + activeResult : undefined} value={query} onChange={e => search(e.target.value)} onKeyDown={e => {
          if (e.key === "Escape") { setResults([]); searchRequest.current?.abort(); setSearching(false); }
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult(i => Math.min(i + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult(i => Math.max(0, i - 1)); }
          if (e.key === "Enter") { e.preventDefault(); if (results.length) selectResult(results[Math.max(0, activeResult)]); }
        }} placeholder="House, street, sector or town" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 pr-8 text-sm" />
        {searching && <Loader2 size={16} className="absolute right-3 top-3 animate-spin" />}
        {results.length > 0 && <ul id="delivery-search-results" role="listbox" className="absolute top-full left-0 right-0 z-[1100] max-h-64 overflow-y-auto rounded-xl border bg-white shadow-xl">{results.map((place, i) => <li key={place.placeId} id={'delivery-result-' + i} role="option" aria-selected={i === activeResult}><button type="button" onClick={() => selectResult(place)} className={'w-full text-left p-3 text-xs border-b hover:bg-amber-50 ' + (i === activeResult ? 'bg-amber-50' : '')}><strong className="block">{place.mainText}</strong><span>{place.secondaryText}</span></button></li>)}</ul>}
      </div>
      {searchMessage && <p role="status" className="text-xs text-amber-800">{searchMessage}</p>}
    </div>
    <div ref={container} aria-label="Delivery location map" className="h-[340px] sm:h-[400px] w-full isolate" />
    <div className="p-4 space-y-2 text-xs" aria-live="polite">
      {accuracy !== null && <p className="text-blue-800">Device accuracy: approximately {Math.ceil(accuracy)} metres. {accuracy > 100 ? "This is an approximate fix; move the pin to your entrance." : "Check the pin is at your entrance."}</p>}
      {busy ? <p className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Checking address and driving route...</p> : quote ? <div className="flex justify-between font-bold"><span>{formatDistanceKm(quote.distanceKm)} by road · {quote.durationMinutes} min</span><span>{quote.deliverable ? 'Delivery: Rs. ' + quote.deliveryCharge : 'Outside ' + quote.maxDeliveryDistanceKm + ' km delivery area'}</span></div> : <p>Select a location to calculate delivery charges.</p>}
      {address && <p>{address}</p>}
      {needsPinConfirmation && quote && <div className="rounded-lg bg-amber-50 p-3 text-amber-900">This is an approximate location. Drag the pin to your entrance, or confirm it is already there. <button type="button" className="underline font-bold" onClick={() => void choose.current(selected.current!.lat, selected.current!.lng, address)}>Confirm pin at my entrance</button></div>}
      {quote && <p className="text-slate-500">Review the address below and add any missing house, flat, street, sector or landmark details.</p>}
      {error && <div role="alert" className="text-red-700">{error} {selected.current && !busy && <button type="button" className="underline font-bold ml-2" onClick={() => void choose.current(selected.current!.lat, selected.current!.lng, address)}>Retry</button>}</div>}
    </div>
  </div>;
};
