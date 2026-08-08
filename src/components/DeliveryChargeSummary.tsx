import { Truck } from "lucide-react";
import { DeliveryArea } from "../types";
import { calculateDeliveryCharge, formatRs } from "../lib/deliveryCalculation";

interface DeliveryChargeSummaryProps {
  area: DeliveryArea | null;
  subtotal?: number;
  className?: string;
}

export function DeliveryChargeSummary({ area, subtotal = 0, className = "" }: DeliveryChargeSummaryProps) {
  const deliveryFee = area ? calculateDeliveryCharge(area.distanceKm, area.deliveryRatePerKm) : 0;
  const total = subtotal + deliveryFee;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
        <Truck className="w-4 h-4 text-blue-600" /> Delivery Information
      </div>
      {area ? (
        <>
          <div className="flex items-start justify-between gap-3 text-xs">
            <div><span className="block text-slate-400">Area</span><strong className="text-slate-800">{area.areaName}</strong></div>
            <div className="text-right"><span className="block text-slate-400">Distance</span><strong className="text-slate-800">{area.distanceKm} km</strong></div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex justify-between text-slate-500"><span>Delivery rate</span><span>Rs. {area.deliveryRatePerKm}/km</span></div>
            <div className="flex justify-between font-bold text-slate-800"><span>Delivery fee</span><span>{formatRs(deliveryFee)}</span></div>
            {subtotal > 0 && <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 font-black text-slate-900"><span>Total with delivery</span><span className="text-blue-600">{formatRs(total)}</span></div>}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">Select a delivery area to see the verified distance and fee.</p>
      )}
    </div>
  );
}
