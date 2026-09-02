import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Navigation, Bike, Compass, MapPin, Phone, ShieldCheck, CheckCircle2, RotateCcw, Play, Pause, Landmark } from "lucide-react";
import { cn } from "../lib/utils";

interface LiveTrackingMapProps {
  status: string;
  area: string;
  address: string;
  createdAt: string;
  orderId: string;
}

interface AreaCoord {
  name: string;
  x: number; // percentage in the SVG map (0-100)
  y: number; // percentage in the SVG map (0-100)
  isIslamabad: boolean;
}

const AREA_COORDINATES: Record<string, AreaCoord> = {
  "gulrez": { name: "Gulrez Phase 3 (Chakki)", x: 50, y: 70, isIslamabad: false },
  "bahria town": { name: "Bahria Town Phase 4", x: 35, y: 88, isIslamabad: false },
  "dha": { name: "DHA Phase 2", x: 65, y: 85, isIslamabad: false },
  "chaklala": { name: "Chaklala Scheme 3", x: 58, y: 62, isIslamabad: false },
  "saddar": { name: "Saddar Rawalpindi", x: 38, y: 58, isIslamabad: false },
  "i-8": { name: "I-8 Sector, Islamabad", x: 45, y: 38, isIslamabad: true },
  "i-9": { name: "I-9 Industrial Area", x: 40, y: 40, isIslamabad: true },
  "g-11": { name: "G-11 Sector, Islamabad", x: 26, y: 22, isIslamabad: true },
  "g-sectors": { name: "G-11 Sector, Islamabad", x: 26, y: 22, isIslamabad: true },
  "f-sectors": { name: "F-6 Sector, Islamabad", x: 42, y: 15, isIslamabad: true },
  "f-11": { name: "F-11 Sector, Islamabad", x: 32, y: 18, isIslamabad: true },
  "e-sectors": { name: "E-11 Sector, Islamabad", x: 28, y: 14, isIslamabad: true },
  "islamabad": { name: "Islamabad Express Area", x: 44, y: 32, isIslamabad: true },
  "rawalpindi": { name: "Rawalpindi Center", x: 48, y: 66, isIslamabad: false }
};

export function LiveTrackingMap({ status, area, address, createdAt, orderId }: LiveTrackingMapProps) {
  const origin = AREA_COORDINATES["gulrez"];
  
  // Resolve destination coordinates based on order area
  const destination = useMemo(() => {
    const cleanArea = area.toLowerCase().trim();
    for (const key of Object.keys(AREA_COORDINATES)) {
      if (cleanArea.includes(key) || key.includes(cleanArea)) {
        return AREA_COORDINATES[key];
      }
    }
    // Fallback if area not matched exactly
    return { name: area || "Customer Address", x: 38, y: 44, isIslamabad: true };
  }, [area]);

  // Track state of automatic simulation vs real timeline
  const [isPlaying, setIsPlaying] = useState(true);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  // Calculate real-time progress based on status and elapsed time
  const realProgress = useMemo(() => {
    const createdTime = new Date(createdAt).getTime();
    const elapsedSecs = (Date.now() - createdTime) / 1000;

    if (status === "Delivered") return 100;
    if (status === "Out for Delivery") {
      // Out for delivery is roughly between 90s to 140s in the simulated timeline
      // Let's map it cleanly.
      const startSecs = 90;
      const endSecs = 140;
      if (elapsedSecs < startSecs) return 5;
      if (elapsedSecs >= endSecs) return 100;
      const progress = ((elapsedSecs - startSecs) / (endSecs - startSecs)) * 100;
      return Math.min(99, Math.max(5, Math.floor(progress)));
    }
    if (status === "Quality Inspected") return 50;
    if (status === "In Milling") return 25;
    return 0; // "Order Placed"
  }, [status, createdAt]);

  // Sync simulatedProgress to realProgress on status changes, but let the user override it
  useEffect(() => {
    setSimulatedProgress(realProgress);
  }, [realProgress]);

  // Handle auto-progress increment when playing
  useEffect(() => {
    if (!isPlaying) return;
    if (status !== "Out for Delivery") {
      // If order is delivered or still in mill, don't auto-increment simulated values indefinitely
      return;
    }

    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying, status]);

  // Helper to generate path coordinates for smooth curved roads
  const pathD = useMemo(() => {
    // We draw a quadratic bezier curve from Origin (Gulrez) to Destination for a realistic road shape
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = destination.x;
    const y2 = destination.y;

    // Control point to add a nice curve representing the Islamabad Expressway or GT Road
    const cx = (x1 + x2) / 2 + (y1 - y2) * 0.15;
    const cy = (y1 + y2) / 2 - (x1 - x2) * 0.15;

    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  }, [origin, destination]);

  // Calculate coordinates of the rider along the Bezier curve at simulatedProgress %
  const riderPos = useMemo(() => {
    const t = simulatedProgress / 100;
    
    // Deconstruct bezier Q formula: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
    const x1 = origin.x;
    const y1 = origin.y;
    const x2 = destination.x;
    const y2 = destination.y;

    const cx = (x1 + x2) / 2 + (y1 - y2) * 0.15;
    const cy = (y1 + y2) / 2 - (x1 - x2) * 0.15;

    const rx = Math.pow(1 - t, 2) * x1 + 2 * (1 - t) * t * cx + Math.pow(t, 2) * x2;
    const ry = Math.pow(1 - t, 2) * y1 + 2 * (1 - t) * t * cy + Math.pow(t, 2) * y2;

    return { x: rx, y: ry };
  }, [origin, destination, simulatedProgress]);

  // Calculate dynamic telemetry estimates
  const telemetry = useMemo(() => {
    const isOut = status === "Out for Delivery";
    const isDelivered = status === "Delivered" || simulatedProgress >= 100;
    
    if (isDelivered) {
      return {
        eta: "0 mins",
        distance: "0.0 km",
        speed: "0 km/h",
        riderState: "Arrived Safely",
        colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100",
        message: "Your fresh flour has been delivered directly to your doorstep!"
      };
    }
    
    if (!isOut && simulatedProgress < 95) {
      return {
        eta: status === "In Milling" ? "25 mins" : "35 mins",
        distance: "8.4 km",
        speed: "0 km/h",
        riderState: "Awaiting Milling Completion",
        colorClass: "text-amber-600 bg-amber-50 border-amber-100",
        message: "Rider is waiting at the chakki as your pure flour is being stone-ground fresh."
      };
    }

    // Active Delivery calculations
    const remainingPercentage = 100 - simulatedProgress;
    const estDistance = Math.max(0.2, parseFloat(((remainingPercentage / 100) * 8.4).toFixed(1)));
    const estEtaSecs = Math.max(1, Math.ceil((remainingPercentage / 100) * 15));
    
    return {
      eta: `${estEtaSecs} mins`,
      distance: `${estDistance} km`,
      speed: "45 km/h",
      riderState: simulatedProgress > 85 ? "Approaching Your House" : "En Route on Expressway",
      colorClass: "text-blue-600 bg-blue-50 border-blue-100",
      message: simulatedProgress > 85 
        ? "The rider is entering your neighborhood. Please be ready to receive your order!"
        : "Sourcing completed. Your Atta is moving fast in insulated tamper-proof packaging."
    };
  }, [status, simulatedProgress]);

  return (
    <div id="live-tracking-dashboard" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      {/* Top Telemetry Header bar */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Compass className="w-5 h-5 animate-spin-slow text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Live Telemetry</span>
            <h4 className="font-sans font-bold text-slate-800 text-sm">Twin Cities Real-Time Dispatch Map</h4>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Action Simulation Controls */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause tracking" : "Resume tracking"}
            className="p-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-slate-500" /> : <Play className="w-3.5 h-3.5 text-blue-600" />}
            <span>{isPlaying ? "Live" : "Paused"}</span>
          </button>

          <button
            onClick={() => setSimulatedProgress(realProgress)}
            title="Sync with real order status"
            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Telemetry Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Left Grid: SVG Interactive Cartography map (2 cols) */}
        <div className="lg:col-span-2 relative bg-slate-900 h-[340px] sm:h-[380px] overflow-hidden select-none border-r border-slate-100">
          
          {/* Cartographic grid background */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.06] pointer-events-none" />
          
          {/* Dynamic route distance progress overlay */}
          <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-xs z-10 flex flex-col gap-1 text-slate-200">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Active Dispatch Trip</span>
            <div className="flex justify-between items-center gap-4">
              <span className="font-semibold text-white">ETA: {telemetry.eta}</span>
              <span className="font-mono text-blue-400 text-[10px]">{telemetry.distance} left</span>
            </div>
            {/* Minimal tracker line */}
            <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${simulatedProgress}%` }}
              />
            </div>
          </div>

          {/* Interactive Legend overlay bottom right */}
          <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2 rounded-lg text-[9px] font-mono text-slate-400 flex flex-col gap-1 z-10">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex items-center justify-center text-[7px] text-white">★</span>
              <span>Babay Dee Chakki (Gulrez)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Express Delivery Route</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Your Residence ({destination.name})</span>
            </div>
          </div>

          {/* Vector Cartography Canvas */}
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Custom Grid / Road Network Guidelines */}
            <line x1="10" y1="0" x2="90" y2="100" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="0" y1="45" x2="100" y2="45" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 4" />
            <line x1="50" y1="0" x2="50" y2="100" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="1 5" />
            
            {/* Islamabad Highway (Expressway) Vector */}
            <path
              d="M 20 10 Q 45 40 50 70"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            {/* GT Road Vector */}
            <path
              d="M 50 70 Q 65 80 85 90"
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />

            {/* Simulated River / Water Feature for Twin Cities (Sohan River/Korang) */}
            <path
              d="M 0 60 Q 30 65 50 62 T 100 80"
              fill="none"
              stroke="#0f172a"
              strokeWidth="4"
              opacity="0.3"
            />
            
            {/* Rawal Lake Representation */}
            <ellipse cx="65" cy="30" rx="6" ry="4" fill="#0f172a" opacity="0.4" />

            {/* Primary Delivery Route Curve from Origin to Destination */}
            <path
              d={pathD}
              fill="none"
              stroke="#1e293b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Active route glow line */}
            <path
              id="active-route-path"
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="4 4"
              className="animate-route-flow"
              opacity={status === "Out for Delivery" ? 1 : 0.4}
            />

            {/* Landmark Markers to make map extremely realistic */}
            <g transform="translate(65, 30)">
              <circle r="1" fill="#475569" />
              <text x="2" y="-2" fill="#475569" fontSize="2.5" fontFamily="monospace">Rawal Lake</text>
            </g>
            <g transform="translate(38, 55)">
              <circle r="1.2" fill="#475569" />
              <text x="2" y="1" fill="#475569" fontSize="2.5" fontFamily="monospace">Saddar Pindi</text>
            </g>
            <g transform="translate(45, 10)">
              <circle r="1.2" fill="#475569" />
              <text x="-4" y="-2.5" fill="#475569" fontSize="2.5" fontFamily="monospace">Faisal Mosque</text>
            </g>
          </svg>

          {/* HTML Overlay pins with precise absolute coordinates for smooth rendering */}
          {/* Origin Pin (Gulrez Phase 3 - Babay Dee Chakki) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${origin.x}%`, top: `${origin.y}%` }}
          >
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center shadow-lg"
              title="Gulrez Phase 3 - Babay Dee Atta Chakki HQ"
            >
              <Landmark className="w-4 h-4 text-slate-900" />
            </motion.div>
            <span className="mt-1 px-1.5 py-0.5 bg-slate-950/80 border border-slate-800 rounded text-[8px] text-amber-400 font-mono font-bold whitespace-nowrap">
              Babay Dee Chakki
            </span>
          </div>

          {/* Destination Pin (Customer Sector) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${destination.x}%`, top: `${destination.y}%` }}
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
              <div
                className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow-lg relative z-10"
                title={`Delivery Location: ${destination.name}`}
              >
                <MapPin className="w-4 h-4 text-slate-900 fill-slate-900" />
              </div>
            </div>
            <span className="mt-1 px-1.5 py-0.5 bg-slate-950/80 border border-slate-800 rounded text-[8px] text-emerald-400 font-mono font-bold whitespace-nowrap max-w-[100px] truncate">
              {destination.name}
            </span>
          </div>

          {/* Moving Rider Pin */}
          <AnimatePresence>
            {simulatedProgress > 0 && simulatedProgress < 100 && (
              <motion.div
                key="rider-pin"
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                style={{ left: `${riderPos.x}%`, top: `${riderPos.y}%` }}
                layoutId="rider-locator"
              >
                <div className="relative">
                  {/* High contrast pulse aura */}
                  <div className="absolute -inset-1.5 rounded-full bg-blue-500/40 animate-ping duration-700" />
                  <div className="w-9 h-9 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-xl">
                    <Bike className="w-5 h-5 text-white animate-bounce-slow" />
                  </div>
                </div>
                <div className="mt-1 px-1.5 py-0.5 bg-blue-600 text-white font-mono font-bold text-[8px] rounded whitespace-nowrap flex items-center gap-0.5 shadow-sm">
                  <span>RIDER: {telemetry.speed}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Grid: Active Telemetry Data Controls */}
        <div className="p-5 flex flex-col justify-between h-full bg-slate-50/50">
          <div className="space-y-4">
            {/* Status Highlight Banner */}
            <div className={cn("p-3 rounded-xl border text-xs font-bold flex flex-col gap-1", telemetry.colorClass)}>
              <span className="text-[10px] font-mono uppercase tracking-wider opacity-75">Courier Dispatch Status</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
                </span>
                <span className="uppercase tracking-wide">{telemetry.riderState}</span>
              </div>
              <p className="text-[10px] font-normal leading-relaxed text-slate-500 mt-1">
                {telemetry.message}
              </p>
            </div>

            {/* Rider Identity Card */}
            <div className="bg-white border border-slate-100 p-3.5 rounded-xl space-y-3">
              <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block">Assigned Delivery Specialist</span>
              
              <div className="flex items-center gap-3">
                {/* Custom avatar placeholder */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm font-mono">
                    MK
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5.5 h-5.5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold" title="Online & Active">
                    ✓
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                    <span>Muhammad Kashif</span>
                    <span className="text-[10px] text-amber-500 font-bold">★ 4.9</span>
                  </h5>
                  <span className="text-[10px] text-slate-400 block truncate">Honda CD-70 Cargo Carrier</span>
                  <span className="text-[10.5px] font-mono font-semibold text-blue-600 block mt-0.5">Gulrez Hub Dispatcher</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-50 flex gap-2">
                <a
                  href="tel:+923215010846"
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5 text-white fill-white" />
                  <span>Call Rider (+92 321 5010846)</span>
                </a>
                <div className="p-1.5 px-2.5 bg-green-50/50 border border-green-100/60 rounded-lg text-[10px] font-bold text-green-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                  <span>Verified</span>
                </div>
              </div>
            </div>

            {/* Simulated Live Timeline Metrics */}
            <div className="bg-white border border-slate-100 p-3 rounded-xl space-y-2.5">
              <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block">Transit Metrics</span>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Estimated ETA</span>
                  <span className="block font-sans font-bold text-slate-800 text-xs mt-0.5">{telemetry.eta}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Trip Distance</span>
                  <span className="block font-sans font-bold text-slate-800 text-xs mt-0.5">{telemetry.distance}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Slider to control driver location simulation manually */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
              <span className="uppercase tracking-wider">Manual Route Progress</span>
              <span className="font-mono text-blue-600">{simulatedProgress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={simulatedProgress}
              onChange={(e) => {
                setIsPlaying(false);
                setSimulatedProgress(parseInt(e.target.value, 10));
              }}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 outline-none"
            />
            <div className="flex justify-between text-[8px] font-mono text-slate-400">
              <span>GULREZ CHAKKI</span>
              <span>DELIVERED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
