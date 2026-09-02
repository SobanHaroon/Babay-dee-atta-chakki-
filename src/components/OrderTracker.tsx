import React, { useState, useEffect, FormEvent, useRef } from "react";
import { Search, Loader2, Clock, CheckCircle, MapPin, Truck, Box, Smartphone } from "lucide-react";
import { Order } from "../types";
import { LiveTrackingMap } from "./LiveTrackingMap";
import { useToast } from "./ToastContainer";

export function OrderTracker() {
  const toast = useToast();
  const prevStatusRef = useRef<string | null>(null);
  const prevTrackingIdRef = useRef<string | null>(null);

  const [orderIdInput, setOrderIdInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("last_tracking_id") || "";
    }
    return "";
  });
  const [trackingId, setTrackingId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("last_tracking_id") || "";
    }
    return "";
  });
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrack = (e: FormEvent) => {
    e.preventDefault();
    const cleanId = orderIdInput.trim().toUpperCase();
    if (!cleanId) return;
    setTrackingId(cleanId);
    if (typeof window !== "undefined") {
      localStorage.setItem("last_tracking_id", cleanId);
    }
  };

  useEffect(() => {
    if (!trackingId) return;

    let isMounted = true;
    const fetchOrder = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/order/${trackingId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setOrder(data);
            if (isInitial || prevTrackingIdRef.current !== trackingId) {
              toast.wheat(`Order code found! Status: ${data.status}`);
              prevTrackingIdRef.current = trackingId;
            } else if (prevStatusRef.current && prevStatusRef.current !== data.status) {
              toast.success(`Order status updated to: ${data.status}`);
            }
            prevStatusRef.current = data.status;
          }
        } else {
          if (isMounted) {
            setError("Order code not found. Make sure you entered the correct BDEC recipe code.");
            setOrder(null);
            if (isInitial) {
              toast.error("Order code not found. Please verify and try again.");
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError("Network error tracking order. Please try again.");
          if (isInitial) {
            toast.error("Network error tracking order.");
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrder(true);

    // Listen for realtime orders table changes broadcast from App.tsx
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      // If the changed order matches the current tracked order, re-fetch it instantly!
      if (payload && payload.new && String(payload.new["order id"]) === String(trackingId).replace("BDEC-", "").trim()) {
        console.log("⚡ Real-time Order change matches current tracked order! Re-fetching...");
        fetchOrder(false);
      } else if (!payload) {
        // Fallback catch-all re-fetch
        fetchOrder(false);
      }
    };

    window.addEventListener("order-realtime-update", handleRealtimeUpdate);

    // Setup an intervals to poll updates every 10 seconds for real-time order tracking
    const interval = setInterval(() => fetchOrder(false), 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("order-realtime-update", handleRealtimeUpdate);
    };
  }, [trackingId]);

  // Status mapping to icons and classes
  const statusSteps = [
    { label: "Order Placed", desc: "Sent successfully to Gulrez Chakki", icon: Box },
    { label: "In Milling", desc: "Grinding grain fresh at low heat", icon: Clock },
    { label: "Quality Inspected", desc: "Moisture levels and purity verified", icon: CheckCircle },
    { label: "Out for Delivery", desc: "Rider dispatched to your address", icon: Truck },
    { label: "Delivered", desc: "Package handed over safely", icon: MapPin }
  ];

  const getStatusIndex = (currentStatus: string) => {
    if (currentStatus === "Order Placed") return 0;
    if (currentStatus === "In Milling") return 1;
    if (currentStatus === "Quality Inspected") return 2;
    if (currentStatus === "Out for Delivery") return 3;
    if (currentStatus === "Delivered") return 4;
    return 0;
  };

  return (
    <div id="order-tracker-card" className="bg-white rounded-2xl border border-slate-100 shadow-xl p-6 md:p-8 max-w-3xl mx-auto">
      <div className="text-center max-w-lg mx-auto mb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600">
          Instant Tracking
        </span>
        <h3 className="text-lg font-bold text-slate-800 tracking-tight mt-0.5">
          Track Your Chakki Shipments
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter your 10-digit BDEC code from your order confirmation to monitor real-time grain milling and dispatcher status.
        </p>
      </div>

      {/* Query Search Form */}
      <form onSubmit={handleTrack} className="flex gap-2 mb-6 max-w-md mx-auto">
        <input
          type="text"
          value={orderIdInput}
          onChange={(e) => setOrderIdInput(e.target.value)}
          placeholder="e.g. BDEC-238495"
          className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none font-bold text-slate-800 h-11 placeholder-slate-400"
        />
        <button
          type="submit"
          id="track-order-btn"
          className="p-2 px-4 bg-blue-600 hover:bg-blue-700 hover:scale-102 active:scale-98 text-white rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0 font-bold text-xs h-11"
        >
          <Search className="w-4 h-4" />
          <span>Locate</span>
        </button>
      </form>

      {/* States response panel */}
      {loading && !order && (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-medium text-xs">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
          <span>Synchronizing with dispatch systems...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center text-xs text-red-600 font-medium">
          {error}
        </div>
      )}

      {order && (
        <div className="space-y-6 animate-fade-in mt-6">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Order Reference</span>
              <h4 className="font-sans font-bold text-slate-800 text-sm">Receipt #{order.id}</h4>
              <span className="text-[10px] text-slate-400 font-medium">{new Date(order.createdAt).toLocaleString()}</span>
            </div>

            <div className="text-left md:text-right">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Deliver To</span>
              <span className="text-xs font-bold text-slate-800">{order.customer.name}</span>
              <span className="text-[11px] text-slate-500 block">{order.customer.address}, {order.customer.area}</span>
            </div>

            {order.deliveryDate && (
              <div className="text-left md:text-right">
                <span className="text-[10px] uppercase font-mono font-bold text-amber-600 block">Preferred Delivery</span>
                <span className="text-xs font-extrabold text-[#3b4414] block">
                  {(() => {
                    try {
                      const d = new Date(order.deliveryDate);
                      const todayStr = new Date().toISOString().split("T")[0];
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = tomorrow.toISOString().split("T")[0];
                      
                      if (order.deliveryDate === todayStr) return "Today";
                      if (order.deliveryDate === tomorrowStr) return "Tomorrow";
                      
                      return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
                    } catch {
                      return order.deliveryDate;
                    }
                  })()}
                </span>
                <span className="text-[10px] text-amber-700 font-mono font-semibold bg-amber-50 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                  {order.deliverySlot}
                </span>
              </div>
            )}

            <div className="text-left md:text-right">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Order Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mt-0.5">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                <span>{order.status}</span>
              </span>
            </div>
          </div>

          {/* Real-Time Interactive Live Tracking Map */}
          <LiveTrackingMap
            status={order.status}
            area={order.customer.area}
            address={order.customer.address}
            createdAt={order.createdAt}
            orderId={order.id}
          />

          {/* Status logs history */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Logs list (Left/top) */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>Operator Dispatch System Logs</span>
              </h5>
              <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                {(order.statusHistory || []).map((h, i) => (
                  <div key={`sh-${i}-${h.time}-${h.status}`} className="flex gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-600 shrink-0 w-16 text-right">{h.time}</span>
                    <div className="border-l border-blue-200 pl-3 relative pb-2">
                      <span className="absolute -left-[4.5px] top-[4px] w-2 h-2 bg-blue-500 rounded-full" />
                      <h6 className="font-bold text-slate-700">{h.status}</h6>
                      <p className="text-[10px] text-slate-400 mt-0.5">{h.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipment list summary right */}
            <div className="border border-slate-100 p-4 rounded-xl space-y-3 bg-white">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                Items Sourced & Packaging Description
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(order.items || []).map((it, idx) => (
                  <div key={it.id ? `ot-item-${it.id}-${idx}` : `ot-item-${idx}-${it.name}`} className="flex justify-between text-xs font-medium text-slate-650">
                    <span className="truncate w-44">{it.name} <span className="font-bold text-slate-400">x{it.quantity}</span></span>
                    <span className="font-mono font-bold text-slate-800">Rs. {it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-700">Rs. {order.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Express Delivery Charges</span>
                  <span className="font-bold text-slate-700">Rs. {order.deliveryCharges}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-200 text-sm font-black text-slate-800">
                  <span>Grand Total</span>
                  <span className="text-blue-600">Rs. {order.total}</span>
                </div>
              </div>

              {/* Secure payment status confirmation banner */}
              <div className="mt-4 p-2 bg-green-50 text-green-700 text-[10.5px] font-semibold rounded-lg text-center flex items-center justify-center gap-1">
                <span>Method: {order.paymentMethod}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderTracker;

