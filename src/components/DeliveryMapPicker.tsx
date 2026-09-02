import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Store,
  Clock,
  Sparkles,
  X,
  Crosshair,
  Compass,
  RotateCcw
} from "lucide-react";
import {
  formatDistanceKm,
  formatDurationMins,
  extractCityAndArea,
  computeDistanceBetweenCoords,
  getGeoapifyTileUrl,
  searchGeoapifyPlaces,
  findClosestTwinCityZone,
  reverseGeocodeLatLng,
  GEOAPIFY_MAP_TILES_KEY,
  GEOAPIFY_GEOCODING_KEY,
  TWIN_CITIES_ZONES
} from "../lib/mapUtils";

// Exact coordinates from user store location: https://maps.app.goo.gl/k7Cjakmyvd227jpE7
export const STORE_EXACT_COORDINATES = {
  lat: 33.567348,
  lng: 73.104510
};

export const STORE_EXACT_DETAILS = {
  name: "Babay Dee Atta Chakki (Central Depot)",
  address: "Main Gulraiz Phase 3 / High Court Rd, Rawalpindi",
  mapsUrl: "https://maps.app.goo.gl/k7Cjakmyvd227jpE7",
  pricePerKm: 50,
  maxDeliveryDistanceKm: 45
};

// Popular fast-jump quick tags for Islamabad / Rawalpindi
const POPULAR_TWIN_CITIES_AREAS = [
  { name: "Gulraiz Phase 3", lat: 33.567348, lng: 73.104510, city: "Rawalpindi" },
  { name: "Bahria Phase 4", lat: 33.5280, lng: 73.1320, city: "Rawalpindi" },
  { name: "DHA Phase 1", lat: 33.5300, lng: 73.1000, city: "Rawalpindi" },
  { name: "PWD Society", lat: 33.5850, lng: 73.1450, city: "Islamabad" },
  { name: "Chaklala Scheme 3", lat: 33.5850, lng: 73.0800, city: "Rawalpindi" },
  { name: "Saddar", lat: 33.5980, lng: 73.0530, city: "Rawalpindi" },
  { name: "Sector I-8", lat: 33.6680, lng: 73.0750, city: "Islamabad" },
  { name: "Sector F-10", lat: 33.6920, lng: 73.0000, city: "Islamabad" },
  { name: "Sector G-11", lat: 33.6680, lng: 72.9900, city: "Islamabad" },
  { name: "Sector F-7", lat: 33.7200, lng: 73.0550, city: "Islamabad" },
  { name: "Bahria Phase 7", lat: 33.5230, lng: 73.1050, city: "Rawalpindi" },
  { name: "Westridge", lat: 33.6120, lng: 73.0180, city: "Rawalpindi" }
];

export interface DeliveryCalculationResult {
  success?: boolean;
  deliverable: boolean;
  distanceKm: number;
  distanceMeters?: number;
  durationMinutes?: number;
  durationText?: string;
  deliveryCharge: number;
  pricePerKm: number;
  maxDeliveryDistanceKm: number;
  routeCoordinates?: Array<{ lat: number; lng: number }>;
  polyline?: string;
  city?: string;
  area?: string;
  storeLocation: { lat: number; lng: number; address?: string; name?: string };
  customerLocation: { lat: number; lng: number; address?: string; city?: string; area?: string };
  message?: string;
}

interface DeliveryMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onLocationChange: (data: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    area: string;
    distanceKm: number;
    deliveryCharge: number;
    deliverable: boolean;
  }) => void;
}

export const DeliveryMapPicker: React.FC<DeliveryMapPickerProps> = ({
  initialLat,
  initialLng,
  initialAddress,
  onLocationChange
}) => {
  // Store details state
  const [storeInfo, setStoreInfo] = useState({
    lat: STORE_EXACT_COORDINATES.lat,
    lng: STORE_EXACT_COORDINATES.lng,
    name: STORE_EXACT_DETAILS.name,
    address: STORE_EXACT_DETAILS.address,
    pricePerKm: STORE_EXACT_DETAILS.pricePerKm,
    maxDeliveryDistanceKm: STORE_EXACT_DETAILS.maxDeliveryDistanceKm
  });

  // Customer selected location state
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number }>(() => ({
    lat: initialLat || 33.567348,
    lng: initialLng || 73.104510
  }));

  const [customerAddress, setCustomerAddress] = useState<string>(initialAddress || "");
  const [detectedCity, setDetectedCity] = useState<string>("Rawalpindi");
  const [detectedArea, setDetectedArea] = useState<string>("Gulraiz Phase 3");

  // Route calculation data
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(50);
  const [deliverable, setDeliverable] = useState<boolean>(true);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search input & autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchingPlaces, setIsSearchingPlaces] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Array<{
    placeId: string;
    formatted: string;
    mainText: string;
    secondaryText: string;
    lat: number;
    lng: number;
    city: string;
    area: string;
  }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // Map DOM and Leaflet references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const searchDebounceRef = useRef<any>(null);
  const isInitialMount = useRef<boolean>(true);

  // Fetch dynamic store delivery settings from Supabase backend on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/delivery/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setStoreInfo({
              lat: data.data.storeLatitude || STORE_EXACT_COORDINATES.lat,
              lng: data.data.storeLongitude || STORE_EXACT_COORDINATES.lng,
              name: data.data.storeName || STORE_EXACT_DETAILS.name,
              address: data.data.storeAddress || STORE_EXACT_DETAILS.address,
              pricePerKm: data.data.pricePerKm || STORE_EXACT_DETAILS.pricePerKm,
              maxDeliveryDistanceKm: data.data.maxDeliveryDistanceKm || STORE_EXACT_DETAILS.maxDeliveryDistanceKm
            });
          }
        }
      } catch (err) {
        console.warn("Could not load backend store delivery settings:", err);
      }
    }
    fetchSettings();
  }, []);

  // Server-side Route & Delivery Calculation function with seamless client-side mathematical fallback
  const calculateRoute = useCallback(
    async (lat: number, lng: number, addressHint?: string) => {
      setIsCalculating(true);
      setErrorMessage(null);

      const storeLat = storeInfo.lat || STORE_EXACT_COORDINATES.lat;
      const storeLng = storeInfo.lng || STORE_EXACT_COORDINATES.lng;
      const pricePerKm = storeInfo.pricePerKm || STORE_EXACT_DETAILS.pricePerKm || 50;
      const maxDistKm = storeInfo.maxDeliveryDistanceKm || STORE_EXACT_DETAILS.maxDeliveryDistanceKm || 30;

      const safeLat = typeof lat === "number" && !isNaN(lat) && lat !== 0 ? lat : (customerCoords.lat || 33.6007);
      const safeLng = typeof lng === "number" && !isNaN(lng) && lng !== 0 ? lng : (customerCoords.lng || 73.0679);

      // Reliable local client fallback calculation (instant, works offline or without backend)
      const applyLocalCalculation = () => {
        const directDist = computeDistanceBetweenCoords(storeLat, storeLng, safeLat, safeLng);
        const roadKm = Math.max(0.5, Math.round(directDist * 1.25 * 10) / 10);
        const isDeliv = roadKm <= maxDistKm;
        const fee = Math.max(50, Math.round(roadKm * pricePerKm));
        const dur = Math.max(15, Math.ceil(roadKm * 2.2));
        const zoneInfo = findClosestTwinCityZone(safeLat, safeLng);
        const parsed = extractCityAndArea(addressHint || customerAddress || "", safeLat, safeLng);
        const fallbackArea = parsed.area || (zoneInfo ? zoneInfo.zone.name : "Gulraiz Phase 3");
        const fallbackCity = parsed.city || (zoneInfo ? zoneInfo.zone.city : (safeLat > 33.655 ? "Islamabad" : "Rawalpindi"));
        
        let resolvedAddr = addressHint || customerAddress;
        if (!resolvedAddr || resolvedAddr.startsWith("Pinned Location") || resolvedAddr.startsWith("Location (") || resolvedAddr.startsWith("Delivery Pin")) {
          resolvedAddr = `${fallbackArea}, ${fallbackCity}, Pakistan`;
        }

        const localWaypoints: Array<{ lat: number; lng: number }> = [];
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const curveFactor = Math.sin(t * Math.PI) * 0.0025;
          const wLat = storeLat + (safeLat - storeLat) * t + curveFactor;
          const wLng = storeLng + (safeLng - storeLng) * t + curveFactor * 0.5;
          localWaypoints.push({ lat: Number(wLat.toFixed(6)), lng: Number(wLng.toFixed(6)) });
        }

        setDistanceKm(roadKm);
        setDurationMinutes(dur);
        setDeliveryCharge(fee);
        setDeliverable(isDeliv);
        setCustomerAddress(resolvedAddr);
        setDetectedCity(fallbackCity);
        setDetectedArea(fallbackArea);
        setRouteCoordinates(localWaypoints);
        setErrorMessage(null);

        onLocationChange({
          lat: safeLat,
          lng: safeLng,
          address: resolvedAddr,
          city: fallbackCity,
          area: fallbackArea,
          distanceKm: roadKm,
          deliveryCharge: fee,
          deliverable: isDeliv
        });
      };

      try {
        const res = await fetch("/api/delivery/calculate-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: safeLat,
            longitude: safeLng,
            address: addressHint || ""
          })
        });

        if (!res.ok) {
          applyLocalCalculation();
          return;
        }

        const data: DeliveryCalculationResult = await res.json();

        if (data && (data.success || data.distanceKm !== undefined)) {
          const finalDistKm = typeof data.distanceKm === "number" ? data.distanceKm : 1;
          const finalCharge = typeof data.deliveryCharge === "number" ? data.deliveryCharge : Math.max(50, Math.round(finalDistKm * pricePerKm));
          const finalDeliverable = typeof data.deliverable === "boolean" ? data.deliverable : (finalDistKm <= maxDistKm);

          setDistanceKm(finalDistKm);
          setDurationMinutes(data.durationMinutes || Math.max(15, Math.ceil(finalDistKm * 2.2)));
          setDeliveryCharge(finalCharge);
          setDeliverable(finalDeliverable);

          const zoneInfo = findClosestTwinCityZone(safeLat, safeLng);
          const resolvedCity = data.city || (zoneInfo ? zoneInfo.zone.city : (safeLat > 33.655 ? "Islamabad" : "Rawalpindi"));
          const resolvedArea = data.area || (zoneInfo ? zoneInfo.zone.name : "Gulraiz Phase 3");
          let resolvedAddr = data.customerLocation?.address || addressHint || customerAddress;

          if (!resolvedAddr || resolvedAddr.startsWith("Pinned Location") || resolvedAddr.startsWith("Location (") || resolvedAddr.startsWith("Delivery Pin")) {
            resolvedAddr = `${resolvedArea}, ${resolvedCity}, Pakistan`;
          }

          setCustomerAddress(resolvedAddr);
          setDetectedCity(resolvedCity);
          setDetectedArea(resolvedArea);

          const pts = data.routeCoordinates && data.routeCoordinates.length > 0
            ? data.routeCoordinates
            : [{ lat: storeLat, lng: storeLng }, { lat: safeLat, lng: safeLng }];
          setRouteCoordinates(pts);
          setErrorMessage(null);

          onLocationChange({
            lat: safeLat,
            lng: safeLng,
            address: resolvedAddr,
            city: resolvedCity,
            area: resolvedArea,
            distanceKm: finalDistKm,
            deliveryCharge: finalCharge,
            deliverable: finalDeliverable
          });
        } else {
          applyLocalCalculation();
        }
      } catch (err: any) {
        console.warn("API route calculation fallback applied:", err);
        applyLocalCalculation();
      } finally {
        setIsCalculating(false);
      }
    },
    [storeInfo.lat, storeInfo.lng, storeInfo.pricePerKm, storeInfo.maxDeliveryDistanceKm, customerAddress, onLocationChange, customerCoords.lat, customerCoords.lng]
  );

  // Initialize Leaflet Map with Geoapify Map Tiles
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const startLat = customerCoords.lat || STORE_EXACT_COORDINATES.lat;
    const startLng = customerCoords.lng || STORE_EXACT_COORDINATES.lng;

    // Create Leaflet map instance
    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true
    });

    // Add Geoapify Map Tiles Layer
    const tileUrl = getGeoapifyTileUrl("osm-bright", GEOAPIFY_MAP_TILES_KEY);
    L.tileLayer(tileUrl, {
      maxZoom: 20,
      id: "geoapify-map-tiles",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> | <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>'
    }).addTo(map);

    // Custom HTML Marker Icons
    const createStoreIcon = () =>
      L.divIcon({
        className: "custom-store-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
            <div style="background: #3b4414; color: #fde047; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; border: 2px solid #facc15; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span style="font-size: 13px;">🌾</span>
              <span style="color: #ffffff;">Babay Dee Chakki</span>
              <span style="background: #facc15; color: #020617; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 900;">DEPOT</span>
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #3b4414; margin-top: -1px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

    const createCustomerIcon = (dist: number, fee: number, isDeliv: boolean) =>
      L.divIcon({
        className: "custom-customer-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; transform: translate(-50%, -100%);">
            <div style="background: rgba(15, 23, 42, 0.95); color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; border: 1.5px solid ${isDeliv ? "#f59e0b" : "#ef4444"}; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px;">
              <span style="color: #f59e0b;">📍</span>
              <span>${dist > 0 ? formatDistanceKm(dist) : "Your Location"}</span>
              ${fee > 0 ? `<span style="color: #fde047; font-family: monospace; font-weight: 800;">(Rs. ${fee})</span>` : ""}
            </div>
            <div style="width: 32px; height: 32px; background: ${isDeliv ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #ef4444, #dc2626)"}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
            </div>
            <div style="background: #ffffff; color: #1e293b; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.2); border: 1px solid #e2e8f0; text-transform: uppercase; margin-top: 2px;">
              Drag Pin
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

    // 1. Add Store Depot Marker
    const storeMarker = L.marker([storeInfo.lat, storeInfo.lng], {
      icon: createStoreIcon(),
      zIndexOffset: 100
    }).addTo(map);

    storeMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px; font-size: 12px; color: #1e293b;">
        <div style="font-weight: 800; color: #3b4414; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
          <span>🌾</span> ${storeInfo.name}
        </div>
        <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">${storeInfo.address}</p>
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 8px; font-size: 10px; color: #92400e; font-weight: 600;">
          Central Milling Depot | Rawalpindi
        </div>
      </div>
    `);
    storeMarkerRef.current = storeMarker;

    // 2. Add Draggable Customer Marker
    const customerMarker = L.marker([startLat, startLng], {
      draggable: true,
      icon: createCustomerIcon(0, 0, true),
      zIndexOffset: 200
    }).addTo(map);

    // On Pin Drag End -> recalculate driving distance and reverse geocode
    customerMarker.on("dragend", (e: any) => {
      const pos = e.target.getLatLng();
      setCustomerCoords({ lat: pos.lat, lng: pos.lng });
      calculateRoute(pos.lat, pos.lng);
    });

    customerMarkerRef.current = customerMarker;

    // 3. On Map Click -> move pin to clicked location and recalculate
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setCustomerCoords({ lat, lng });
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([lat, lng]);
      }
      calculateRoute(lat, lng);
    });

    leafletMapRef.current = map;

    // Trigger initial calculation
    calculateRoute(startLat, startLng, initialAddress);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update Leaflet markers and route polyline when state changes
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Update store marker position
    if (storeMarkerRef.current) {
      storeMarkerRef.current.setLatLng([storeInfo.lat, storeInfo.lng]);
    }

    // Update customer marker icon and position
    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([customerCoords.lat, customerCoords.lng]);

      const createCustomerIcon = (dist: number, fee: number, isDeliv: boolean) =>
        L.divIcon({
          className: "custom-customer-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; transform: translate(-50%, -100%);">
              <div style="background: rgba(15, 23, 42, 0.95); color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; border: 1.5px solid ${isDeliv ? "#f59e0b" : "#ef4444"}; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px;">
                <span style="color: #f59e0b;">📍</span>
                <span>${dist > 0 ? formatDistanceKm(dist) : "Your Location"}</span>
                ${fee > 0 ? `<span style="color: #fde047; font-family: monospace; font-weight: 800;">(Rs. ${fee})</span>` : ""}
              </div>
              <div style="width: 32px; height: 32px; background: ${isDeliv ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #ef4444, #dc2626)"}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
              </div>
              <div style="background: #ffffff; color: #1e293b; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.2); border: 1px solid #e2e8f0; text-transform: uppercase; margin-top: 2px;">
                Drag Pin
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

      customerMarkerRef.current.setIcon(createCustomerIcon(distanceKm, deliveryCharge, deliverable));
    }

    // Render / Update Leaflet Polyline
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 0) {
      const latLngs: L.LatLngExpression[] = routeCoordinates.map((pt) => [pt.lat, pt.lng]);
      const polyline = L.polyline(latLngs, {
        color: deliverable ? "#3b4414" : "#ef4444",
        weight: 5,
        opacity: 0.88,
        lineJoin: "round"
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Smoothly fit bounds
      try {
        const bounds = L.latLngBounds(latLngs);
        bounds.extend([storeInfo.lat, storeInfo.lng]);
        bounds.extend([customerCoords.lat, customerCoords.lng]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {
        // bounds fail-safe
      }
    }
  }, [routeCoordinates, distanceKm, deliveryCharge, deliverable, storeInfo, customerCoords]);

  // Handle Geoapify Places Autocomplete live input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!val || val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearchingPlaces(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchGeoapifyPlaces(val, GEOAPIFY_GEOCODING_KEY);
      setSearchResults(results);
      setShowSearchDropdown(results.length > 0);
      setIsSearchingPlaces(false);
    }, 300);
  };

  // Select place from autocomplete
  const handleSelectSearchResult = (item: {
    lat: number;
    lng: number;
    formatted: string;
    city: string;
    area: string;
  }) => {
    setSearchQuery(item.formatted);
    setShowSearchDropdown(false);
    setCustomerCoords({ lat: item.lat, lng: item.lng });

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([item.lat, item.lng]);
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([item.lat, item.lng], 15, { duration: 1.2 });
    }

    calculateRoute(item.lat, item.lng, item.formatted);
  };

  // Quick Sector selection chip
  const handleQuickAreaSelect = (area: { name: string; lat: number; lng: number; city: string }) => {
    setCustomerCoords({ lat: area.lat, lng: area.lng });
    setCustomerAddress(`${area.name}, ${area.city}, Pakistan`);

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([area.lat, area.lng]);
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([area.lat, area.lng], 15, { duration: 1.2 });
    }

    calculateRoute(area.lat, area.lng, `${area.name}, ${area.city}`);
  };

  // Detect My Location (HTML5 Geolocation)
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomerCoords({ lat, lng });

        if (customerMarkerRef.current) {
          customerMarkerRef.current.setLatLng([lat, lng]);
        }

        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
        }

        calculateRoute(lat, lng);
        setIsDetectingLocation(false);
      },
      (err) => {
        console.warn("Geolocation permission error:", err);
        setIsDetectingLocation(false);
        // Fallback to high court road / gulraiz center
        handleQuickAreaSelect(POPULAR_TWIN_CITIES_AREAS[0]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="w-full bg-white text-slate-800 rounded-2xl overflow-hidden shadow-md border border-slate-200 flex flex-col font-sans">
      {/* 1. TOP HEADER & SEARCH BAR (LIGHT THEME) */}
      <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#3b4414] text-amber-300 flex items-center justify-center font-bold text-sm shadow-xs border border-[#3b4414]/20 shrink-0">
              🌾
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-850 text-xs sm:text-sm truncate">
                Select Delivery Location
              </h3>
              <p className="text-[10.5px] text-slate-500 truncate">
                Click map or drag the pin to your gate
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetectingLocation}
            className="flex items-center gap-1.5 bg-[#3b4414] hover:bg-[#2e3510] active:scale-95 text-amber-300 font-bold px-3 py-2 rounded-xl text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0 min-h-[38px]"
          >
            {isDetectingLocation ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span className="hidden sm:inline">Use Current GPS</span>
            <span className="sm:hidden">GPS</span>
          </button>
        </div>

        {/* Search Input with Places Dropdown */}
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchDropdown(true);
              }}
              placeholder="Search society, sector, or landmark (e.g. Bahria Phase 4, DHA 1, F-10)..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3b4414] focus:ring-2 focus:ring-[#3b4414]/10 transition-colors shadow-2xs"
            />
            {isSearchingPlaces && (
              <Loader2 className="absolute right-3 w-4 h-4 text-amber-600 animate-spin" />
            )}
            {searchQuery && !isSearchingPlaces && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                }}
                className="absolute right-3 text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/80 transition-colors flex items-start gap-2.5 group cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 group-hover:text-amber-900 truncate">
                      {item.mainText}
                    </p>
                    <p className="text-[10.5px] text-slate-500 truncate">
                      {item.secondaryText}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Area Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar text-[11px]">
          <span className="text-slate-400 text-[10px] font-bold uppercase shrink-0">
            Quick Pick:
          </span>
          {POPULAR_TWIN_CITIES_AREAS.map((area) => (
            <button
              key={area.name}
              type="button"
              onClick={() => handleQuickAreaSelect(area)}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 font-medium whitespace-nowrap transition-colors text-[10.5px] border border-slate-200 shadow-2xs cursor-pointer shrink-0"
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. INTERACTIVE MAP CANVAS CONTAINER */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-100">
        {/* Leaflet Mount Target */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Loading Overlay */}
        {isCalculating && (
          <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs text-amber-900 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-300 flex items-center gap-2 shadow-md animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>Calculating Live Road Driving Distance...</span>
          </div>
        )}

        {/* Deliverable / Out of Range Status Pill */}
        <div className="absolute bottom-3 left-3 z-20">
          {deliverable ? (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 backdrop-blur-xs px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Deliverable Zone</span>
            </div>
          ) : (
            <div className="bg-rose-50 text-rose-800 border border-rose-300 backdrop-blur-xs px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md animate-bounce">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Outside Maximum Delivery Zone ({storeInfo.maxDeliveryDistanceKm} km max)</span>
            </div>
          )}
        </div>

        {/* Re-center / Reset Button */}
        <button
          type="button"
          onClick={() => {
            if (leafletMapRef.current) {
              leafletMapRef.current.flyTo([customerCoords.lat, customerCoords.lng], 15);
            }
          }}
          className="absolute bottom-3 right-3 z-20 bg-white/95 hover:bg-slate-50 text-slate-700 p-2.5 rounded-xl border border-slate-200 shadow-md transition-colors cursor-pointer"
          title="Center on customer pin"
        >
          <Compass className="w-4 h-4 text-[#3b4414]" />
        </button>
      </div>

      {/* 3. BOTTOM DELIVERY DETAILS & PRICING BAR (LIGHT THEME) */}
      <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-3">
        {/* Selected Address Preview */}
        <div className="flex items-start gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
          <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-850">
                {detectedArea}
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                {detectedCity}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {customerAddress || `${customerCoords.lat.toFixed(5)}, ${customerCoords.lng.toFixed(5)}`}
            </p>
          </div>
        </div>

        {/* Statistics Grid (3 Columns) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Estimated Distance */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              Estimated Distance
            </span>
            <span className="text-xs sm:text-sm md:text-base font-black text-slate-850 font-mono mt-0.5 block truncate">
              {formatDistanceKm(distanceKm)}
            </span>
          </div>

          {/* Estimated Time */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
              Estimated Time
            </span>
            <span className="text-xs sm:text-sm md:text-base font-black text-amber-700 font-mono mt-0.5 block truncate">
              {formatDurationMins(durationMinutes)}
            </span>
          </div>

          {/* Delivery Charges */}
          <div className={`p-2.5 sm:p-3 rounded-xl border text-center shadow-2xs ${
            deliverable ? "bg-amber-50/80 border-amber-300 text-amber-950" : "bg-rose-50 border-rose-300 text-rose-800"
          }`}>
            <span className="text-[10px] uppercase tracking-wider font-bold block text-slate-500">
              Delivery Charges
            </span>
            <span className="text-xs sm:text-sm md:text-base font-black font-mono mt-0.5 block truncate">
              {deliverable ? `Rs. ${deliveryCharge}` : "Unserviceable"}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
