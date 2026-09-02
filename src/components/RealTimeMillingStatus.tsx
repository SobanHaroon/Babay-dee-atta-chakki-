import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardCheck,
  Wheat,
  Disc,
  PackageCheck,
  Truck,
  Sparkles,
  Thermometer,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Zap,
  Info,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { cn, triggerHapticFeedback } from "../lib/utils";

export type MillingStepId =
  | "order_received"
  | "grain_selection"
  | "cold_stone_milling"
  | "quality_packing"
  | "out_for_delivery";

export interface MillingStep {
  id: MillingStepId;
  title: string;
  subtitle: string;
  desc: string;
  durationEst: string;
  metricLabel: string;
  metricValue: string;
  badge: string;
  details: string[];
}

export const MILLING_STEPS: MillingStep[] = [
  {
    id: "order_received",
    title: "Order Received",
    subtitle: "Chakki Queue Registered",
    desc: "Order confirmed and slotted into our Gulrez Phase 3 fresh milling queue.",
    durationEst: "Instant (0m)",
    metricLabel: "Queue Status",
    metricValue: "Verified #1",
    badge: "Direct Sourcing",
    details: [
      "Order details and grain specifications verified",
      "Assigned to master chakki operator",
      "Weight requirements calibrated on digital scale"
    ]
  },
  {
    id: "grain_selection",
    title: "Grain Selection",
    subtitle: "Hand-Inspected Purity",
    desc: "Premium Grade-A wheat, rice, and pulses filtered for zero additives and foreign seeds.",
    durationEst: "5 - 8 mins",
    metricLabel: "Grain Purity",
    metricValue: "100% Organic",
    badge: "Grade-A Grains",
    details: [
      "Triple-sifted to eliminate chaff & impurities",
      "Grain moisture tested for optimal grinding",
      "100% pesticide-free harvest certification"
    ]
  },
  {
    id: "cold_stone_milling",
    title: "Cold-Stone Milling",
    subtitle: "Low RPM Stone Grinding",
    desc: "Ground slowly on traditional natural stone chakkis under 35°C to preserve vitamin B, wheat germ & dietary fiber.",
    durationEst: "10 - 15 mins",
    metricLabel: "Milling Temp",
    metricValue: "< 34.5°C",
    badge: "Traditional Stone",
    details: [
      "Slow stone RPM prevents nutrient-destroying heat",
      "Intact wheat germ and endosperm bran layers",
      "Zero bleaching, preservatives, or chemical extraction"
    ]
  },
  {
    id: "quality_packing",
    title: "Quality Packing",
    subtitle: "Eco-Kraft Sealed",
    desc: "Freshly milled flour rested and packed in breathable, multi-wall food grade kraft sacks.",
    durationEst: "5 mins",
    metricLabel: "Fineness Mesh",
    metricValue: "100% Fine Whole",
    badge: "Tamper Sealed",
    details: [
      "Weighed to precise gram accuracy",
      "Stitched and air-sealed to prevent moisture absorption",
      "Freshness guarantee badge applied with batch timestamp"
    ]
  },
  {
    id: "out_for_delivery",
    title: "Out for Delivery",
    subtitle: "Rider Dispatched",
    desc: "Handed over to our direct express courier for door-to-door delivery across Rawalpindi & Islamabad.",
    durationEst: "15 - 35 mins",
    metricLabel: "Dispatch Zone",
    metricValue: "Islamabad / RWP",
    badge: "Express Dispatch",
    details: [
      "Direct insulated rider bag for thermal freshness",
      "Real-time turn-by-turn road route tracking",
      "Rider contact protocol enabled upon arrival"
    ]
  }
];

export interface RealTimeMillingStatusProps {
  currentStatus?: string;
  orderId?: string;
  estimatedDeliveryMinutes?: number;
  className?: string;
  compact?: boolean;
  onStepClick?: (step: MillingStep, index: number) => void;
}

export function RealTimeMillingStatus({
  currentStatus = "In Milling",
  orderId,
  estimatedDeliveryMinutes = 25,
  className,
  compact = false,
  onStepClick
}: RealTimeMillingStatusProps) {
  // Map textual order status from backend to step index (0 to 4)
  const mapStatusToStepIndex = (statusStr: string): number => {
    const s = (statusStr || "").toLowerCase().trim();
    if (s.includes("delivered") || s.includes("completed")) return 4;
    if (s.includes("out for delivery") || s.includes("dispatched") || s.includes("on the way")) return 4;
    if (s.includes("packing") || s.includes("quality") || s.includes("inspected")) return 3;
    if (s.includes("milling") || s.includes("grinding") || s.includes("processing") || s.includes("chakki")) return 2;
    if (s.includes("grain") || s.includes("selection") || s.includes("sifting") || s.includes("cleaning")) return 1;
    if (s.includes("placed") || s.includes("received") || s.includes("pending") || s.includes("confirmed")) return 0;
    return 2; // Default to milling for fresh orders
  };

  const activeIndex = mapStatusToStepIndex(currentStatus);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(activeIndex);
  const [simulatedProgress, setSimulatedProgress] = useState<number>(() => {
    return Math.min(100, Math.max(15, (activeIndex + 1) * 20));
  });

  useEffect(() => {
    setSelectedStepIdx(activeIndex);
    setSimulatedProgress(Math.min(100, Math.max(15, (activeIndex + 1) * 20)));
  }, [activeIndex]);

  const selectedStep = MILLING_STEPS[selectedStepIdx] || MILLING_STEPS[2];

  // Step Icon renderer with animated states
  const renderStepIcon = (step: MillingStep, index: number, isCurrent: boolean, isPassed: boolean) => {
    const iconSize = compact ? 18 : 20;

    switch (step.id) {
      case "order_received":
        return (
          <div className="relative flex items-center justify-center">
            <ClipboardCheck size={iconSize} className={isCurrent ? "text-amber-300" : isPassed ? "text-white" : "text-slate-400"} />
            {isCurrent && (
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-amber-400/40 -z-10"
              />
            )}
          </div>
        );
      case "grain_selection":
        return (
          <div className="relative flex items-center justify-center">
            <Wheat
              size={iconSize}
              className={cn(
                "transition-transform duration-300",
                isCurrent ? "text-amber-300" : isPassed ? "text-white" : "text-slate-400"
              )}
            />
            {isCurrent && (
              <motion.span
                animate={{ y: [-2, 2, -2], rotate: [-4, 4, -4] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles size={10} className="text-amber-200 fill-amber-300 animate-spin-slow" />
              </motion.span>
            )}
          </div>
        );
      case "cold_stone_milling":
        return (
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={isCurrent ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="flex items-center justify-center"
            >
              <Disc
                size={iconSize}
                className={isCurrent ? "text-amber-300" : isPassed ? "text-white" : "text-slate-400"}
              />
            </motion.div>
            {isCurrent && (
              <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
        );
      case "quality_packing":
        return (
          <div className="relative flex items-center justify-center">
            <PackageCheck
              size={iconSize}
              className={isCurrent ? "text-amber-300" : isPassed ? "text-white" : "text-slate-400"}
            />
            {isCurrent && (
              <motion.div
                animate={{ scale: [0.9, 1.1, 0.9] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-amber-300/30 -z-10"
              />
            )}
          </div>
        );
      case "out_for_delivery":
        return (
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={isCurrent ? { x: [-1.5, 1.5, -1.5] } : {}}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            >
              <Truck
                size={iconSize}
                className={isCurrent ? "text-amber-300" : isPassed ? "text-white" : "text-slate-400"}
              />
            </motion.div>
            {isCurrent && (
              <motion.div
                animate={{ opacity: [0.2, 0.9, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -left-1 w-1 h-3 bg-amber-400/60 rounded-full blur-[1px]"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div
      id="real-time-milling-status-widget"
      className={cn(
        "rounded-2xl border bg-gradient-to-br from-slate-900 via-neutral-900 to-[#1f240b] text-white shadow-xl overflow-hidden relative select-none",
        compact ? "p-4 border-amber-500/20" : "p-5 md:p-6 border-amber-500/30",
        className
      )}
    >
      {/* Background Atmosphere Grain & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#3b4414]/25 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          {/* Animated Stone Wheel Indicator */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 font-black relative overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="absolute inset-0 flex items-center justify-center opacity-30"
            >
              <Disc size={36} className="text-slate-950" />
            </motion.div>
            <Wheat size={22} className="text-slate-950 relative z-10" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 font-mono">
                Real-Time Milling Pipeline
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE CHAKKI STREAM
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2 mt-0.5">
              <span>Fresh Stone-Ground Process</span>
              {orderId && (
                <span className="text-[11px] font-mono font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                  #{orderId}
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Dynamic Metric Pill */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Thermometer size={14} className="text-amber-400" />
            <span>Milling Temp: &lt;35°C</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1 text-slate-300 text-[11px]">
            <Clock size={13} className="text-emerald-400" />
            <span>Est. ~{estimatedDeliveryMinutes} mins</span>
          </div>
        </div>
      </div>

      {/* 5-STEP INTERACTIVE PROGRESS BAR */}
      <div className="relative z-10 my-6">
        {/* Progress rail bar */}
        <div className="relative flex justify-between items-center">
          {/* Background Rail */}
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1.5 bg-white/10 rounded-full -z-10" />

          {/* Animated Filled Progress Rail */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(activeIndex / (MILLING_STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute top-1/2 left-4 -translate-y-1/2 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full -z-10 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
          />

          {/* Individual Step Nodes */}
          {MILLING_STEPS.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isSelected = idx === selectedStepIdx;
            const isFuture = idx > activeIndex;

            return (
              <button
                key={step.id}
                type="button"
                id={`milling-step-node-${step.id}`}
                onClick={() => {
                  triggerHapticFeedback(15);
                  setSelectedStepIdx(idx);
                  if (onStepClick) onStepClick(step, idx);
                }}
                className={cn(
                  "group relative flex flex-col items-center cursor-pointer transition-all duration-200 outline-none",
                  "focus:outline-none"
                )}
                title={`Step ${idx + 1}: ${step.title}`}
              >
                {/* Outer Ring & Icon Container */}
                <div
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative border-2",
                    isCurrent
                      ? "bg-gradient-to-br from-amber-500 to-[#3b4414] border-amber-400 text-white shadow-lg shadow-amber-500/30 scale-110 ring-4 ring-amber-400/20"
                      : isCompleted
                      ? "bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-900/40 hover:scale-105"
                      : "bg-slate-800/90 border-white/10 text-slate-400 hover:border-white/30 hover:text-slate-200"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={compact ? 18 : 20} className="text-white stroke-[2.5]" />
                  ) : (
                    renderStepIcon(step, idx, isCurrent, isCompleted)
                  )}

                  {/* Top Step Number Tag */}
                  <span
                    className={cn(
                      "absolute -top-2 -right-2 text-[9px] font-mono font-black w-4 h-4 rounded-full flex items-center justify-center border",
                      isCurrent
                        ? "bg-amber-400 text-slate-950 border-amber-300"
                        : isCompleted
                        ? "bg-emerald-500 text-white border-emerald-400"
                        : "bg-slate-700 text-slate-300 border-white/10"
                    )}
                  >
                    {idx + 1}
                  </span>
                </div>

                {/* Step Title on Desktop */}
                <span
                  className={cn(
                    "text-[10px] sm:text-[11px] font-bold mt-2 text-center max-w-[70px] sm:max-w-[85px] line-clamp-2 leading-tight transition-colors",
                    isCurrent
                      ? "text-amber-300 font-black"
                      : isSelected
                      ? "text-white"
                      : isCompleted
                      ? "text-slate-200"
                      : "text-slate-500"
                  )}
                >
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED STEP DETAIL CARD */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStep.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="relative z-10 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-4 md:p-5 space-y-4 shadow-inner"
        >
          {/* Step Headline & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">
                    Step {selectedStepIdx + 1}: {selectedStep.title}
                  </h4>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.2 rounded">
                    {selectedStep.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{selectedStep.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span
                className={cn(
                  "text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5",
                  selectedStepIdx < activeIndex
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : selectedStepIdx === activeIndex
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-400 border-white/10"
                )}
              >
                {selectedStepIdx < activeIndex ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>Completed</span>
                  </>
                ) : selectedStepIdx === activeIndex ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Active In-Progress</span>
                  </>
                ) : (
                  <>
                    <Clock size={12} />
                    <span>Upcoming Queue</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed font-light">
            {selectedStep.desc}
          </p>

          {/* Metric Grid Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 space-y-0.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                {selectedStep.metricLabel}
              </span>
              <span className="text-xs font-black text-amber-300 font-mono block">
                {selectedStep.metricValue}
              </span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 space-y-0.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Stage Duration
              </span>
              <span className="text-xs font-black text-slate-200 font-mono block">
                {selectedStep.durationEst}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white/5 border border-white/10 rounded-xl p-2.5 space-y-0.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Quality Guarantee
              </span>
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={12} /> Pure Natural
              </span>
            </div>
          </div>

          {/* Checklist of Quality Protocols */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Active Chakki Protocols:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {selectedStep.details.map((detail, dIdx) => (
                <div
                  key={dIdx}
                  className="flex items-start gap-1.5 text-[10.5px] text-slate-300 bg-white/[0.02] p-2 rounded-lg border border-white/5"
                >
                  <CheckCircle2 size={12} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* FOOTER NOTICE */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info size={13} className="text-amber-400" />
          <span>Cold-Stone Chakki in Main Gulraiz Phase 3, Rawalpindi • Fresh batch ground per order</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Zero Bleaching • 100% Whole Wheat
        </span>
      </div>
    </div>
  );
}

export default RealTimeMillingStatus;
