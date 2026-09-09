import React from "react";
import { Store, MapPin } from "lucide-react";
import { formatDistanceKm, formatDurationMins } from "../lib/mapUtils";

export interface VisualDeliveryMapMarkersProps {
  storeCoords: { lat: number; lng: number };
  customerCoords: { lat: number; lng: number } | null;
  storeInfo: {
    name: string;
    address: string;
    pricePerKm: number;
    maxDeliveryDistanceKm: number;
  };
  customerAddress?: string;
  distanceKm?: number;
  durationMinutes?: number;
  deliveryCharge?: number;
  deliverable?: boolean;
}

/**
 * VisualDeliveryMapMarkers
 * Marker details and summary badge helper component for delivery views.
 */
export const VisualDeliveryMapMarkers: React.FC<VisualDeliveryMapMarkersProps> = ({
  storeCoords,
  customerCoords,
  storeInfo,
  customerAddress = "",
  distanceKm,
  durationMinutes,
  deliveryCharge,
  deliverable = true,
}) => {
  return (
    <div className="bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-sm text-xs space-y-2">
      <div className="flex items-center gap-2 text-[#3b4414] font-bold">
        <Store className="w-4 h-4 text-[#3b4414] shrink-0" />
        <span className="truncate">{storeInfo.name}</span>
      </div>
      <p className="text-slate-600 text-[11px] leading-tight">
        {storeInfo.address}
      </p>
      {customerCoords && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Destination: {customerAddress || `${customerCoords.lat.toFixed(4)}, ${customerCoords.lng.toFixed(4)}`}</span>
          </div>
          {distanceKm !== undefined && (
            <div className="flex items-center justify-between text-slate-700 font-mono text-[11px]">
              <span>Driving: {formatDistanceKm(distanceKm)}</span>
              {durationMinutes && <span>(~{formatDurationMins(durationMinutes)})</span>}
              {deliveryCharge !== undefined && (
                <span className="font-bold text-[#3b4414]">Rs. {deliveryCharge}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
