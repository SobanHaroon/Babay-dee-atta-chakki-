import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCw, Sparkles, ShoppingBag, Eye } from "lucide-react";
import { cn } from "../../lib/utils";
import { triggerFlourParticleBurst } from "../GsapAnimations";

export interface OrbitalImageItem {
  src?: string;
  alt?: string;
  label: string;
  subtitle?: string;
  price?: string | number;
  badge?: string;
  id?: string | number;
  category?: string;
}

export interface OrbitalImageWheelProps {
  images: OrbitalImageItem[];
  title?: string;
  subtitle?: string;
  autoPlay?: boolean;
  autoPlaySpeed?: number;
  className?: string;
  onSelect?: (item: OrbitalImageItem, index: number) => void;
  onAddToCart?: (item: OrbitalImageItem, e?: React.MouseEvent) => void;
  onViewDetails?: (item: OrbitalImageItem) => void;
}

export function OrbitalImageWheel({
  images = [],
  title = "Flour Variety Showcase",
  subtitle = "Interactive 3D Orbital Product Selector",
  autoPlay = true,
  autoPlaySpeed = 4000,
  className,
  onSelect,
  onAddToCart,
  onViewDetails,
}: OrbitalImageWheelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);
  const [screenSize, setScreenSize] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const orbitRef = useRef<HTMLDivElement>(null);
  const rotationAngleRef = useRef<number>(0);

  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setScreenSize("mobile");
      } else if (w < 1024) {
        setScreenSize("tablet");
      } else {
        setScreenSize("desktop");
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const total = images.length || 1;
  const safeActiveIndex = total > 0 ? ((activeIndex % total) + total) % total : 0;
  const step = 360 / total;

  // Responsive radius & offset: PC screen is wider (245px), Mobile fits comfortably (128px)
  const radius = screenSize === "mobile" ? 128 : screenSize === "tablet" ? 185 : 245;
  const buttonOffset = screenSize === "mobile" ? "1.25rem" : screenSize === "tablet" ? "1.75rem" : "2.0rem";

  // Next / Prev actions with continuous single-direction (clockwise) rotation
  const handleNext = () => {
    rotationAngleRef.current -= step;
    setCurrentRotationAngle(rotationAngleRef.current);
    setActiveIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    rotationAngleRef.current += step;
    setCurrentRotationAngle(rotationAngleRef.current);
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  const handleSelectIndex = (idx: number) => {
    if (idx === safeActiveIndex) return;
    const diff = (idx - safeActiveIndex + total) % total;
    rotationAngleRef.current -= diff * step;
    setCurrentRotationAngle(rotationAngleRef.current);
    setActiveIndex(idx);
    setIsPlaying(false);
  };

  // Auto-play timer set to 4 seconds (4000ms)
  useEffect(() => {
    if (!isPlaying || total <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, autoPlaySpeed || 4000);
    return () => clearInterval(interval);
  }, [isPlaying, total, autoPlaySpeed]);

  // Trigger parent onSelect
  useEffect(() => {
    if (images[safeActiveIndex] && onSelect) {
      onSelect(images[safeActiveIndex], safeActiveIndex);
    }
  }, [safeActiveIndex, images, onSelect]);

  // Animate orbit ring rotation with GSAP continuously clockwise
  useEffect(() => {
    if (!orbitRef.current) return;
    gsap.to(orbitRef.current, {
      rotate: rotationAngleRef.current,
      duration: 0.7,
      ease: "power2.out",
    });
  }, [currentRotationAngle]);

  const activeItem = images[safeActiveIndex] || images[0] || {
    label: "Babay Dee Atta",
    subtitle: "100% Whole Wheat Fresh Flour",
  };

  return (
    <div
      className={cn(
        "relative w-full max-w-7xl mx-auto py-6 sm:py-10 px-2 sm:px-4 flex flex-col items-center justify-center overflow-hidden select-none",
        className
      )}
    >
      {/* Background Decorative Radial Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#3b4414]/15 rounded-full blur-2xl pointer-events-none" />

      {/* Section Header */}
      {title && (
        <div className="text-center mb-6 sm:mb-8 z-10 space-y-1.5">
          <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-white tracking-tight font-serif drop-shadow-md">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] sm:text-xs md:text-sm font-bold text-amber-200/95 max-w-md mx-auto tracking-wide">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Main Wheel Container - Responsive width (narrower on mobile, much wider on PC screen) */}
      <div className="relative w-full max-w-[340px] sm:max-w-xl md:max-w-2xl lg:max-w-4xl aspect-square max-h-[350px] sm:max-h-[480px] md:max-h-[580px] lg:max-h-[660px] flex items-center justify-center">
        
        {/* Logo Watermark Orbit Backdrop Image (Orbiter rotates on top of this image) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="relative w-44 h-44 sm:w-72 sm:h-72 md:w-96 md:h-96 lg:w-[480px] lg:h-[480px] rounded-full overflow-hidden opacity-30 sm:opacity-25 flex items-center justify-center p-4 bg-gradient-to-b from-amber-500/10 via-slate-900/40 to-slate-950/70 border border-amber-400/20 shadow-2xl">
            <img
              src="/logo coloured.jpg"
              alt="Babay Dee Atta Chakki Logo Orbit Backdrop"
              className="w-full h-full object-contain rounded-full opacity-80 filter drop-shadow-[0_0_25px_rgba(245,158,11,0.35)] animate-pulse-slow"
            />
          </div>
        </div>

        {/* Orbital Track Ring */}
        <div className="absolute inset-4 sm:inset-8 md:inset-10 lg:inset-12 rounded-full border-2 border-dashed border-amber-400/35 pointer-events-none animate-spin-very-slow" />
        <div className="absolute inset-2 sm:inset-4 md:inset-6 rounded-full border border-slate-200/40 pointer-events-none" />

        {/* Orbiting Items Wheel */}
        <div
          ref={orbitRef}
          className="absolute inset-0 w-full h-full rounded-full flex items-center justify-center transition-transform z-10"
          style={{ transformOrigin: "center center" }}
        >
          {images.map((item, idx) => {
            const angle = (idx * (360 / total)) * (Math.PI / 180);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isActive = idx === activeIndex;

            return (
              <button
                key={`orbit-${item.id || "item"}-${idx}`}
                onClick={() => handleSelectIndex(idx)}
                className={cn(
                  "absolute z-20 w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full p-0.5 sm:p-1 border-2 transition-all duration-300 cursor-pointer flex items-center justify-center group shadow-md",
                  isActive
                    ? "bg-amber-400 border-amber-500 scale-110 sm:scale-125 shadow-amber-400/50 shadow-lg ring-2 sm:ring-4 ring-amber-400/20"
                    : "bg-white border-slate-200 hover:border-amber-300 hover:scale-110"
                )}
                style={{
                  left: `calc(50% + ${x}px - ${buttonOffset})`,
                  top: `calc(50% + ${y}px - ${buttonOffset})`,
                  // counter-rotate item continuously so thumbnail remains upright
                  transform: `rotate(${-currentRotationAngle}deg)`,
                }}
                title={item.label}
              >
                {item.src ? (
                  <img
                    src={item.src}
                    alt={item.alt || item.label}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes("logo coloured.jpg")) {
                        target.src = "/logo coloured.jpg";
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#3b4414] to-slate-800 text-amber-300 flex items-center justify-center text-[9px] sm:text-[10px] font-bold uppercase">
                    {item.label.slice(0, 2)}
                  </div>
                )}

                {/* Badge Indicator */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.2 rounded-full border border-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center Stage Card Display */}
        <div className="relative z-30 w-52 sm:w-64 md:w-72 p-3.5 sm:p-5 lg:p-6 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-amber-200/80 shadow-2xl flex flex-col items-center text-center space-y-2 sm:space-y-3.5 transition-all duration-300 hover:shadow-amber-500/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full flex flex-col items-center space-y-2 sm:space-y-3"
            >
              {/* Product Thumbnail / Image */}
              <div 
                onClick={() => onViewDetails?.(activeItem)}
                className="relative w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 via-slate-50 to-stone-100 border border-slate-200/80 p-1.5 sm:p-2 shadow-inner flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-400 transition-colors"
              >
                {activeItem.src ? (
                  <img
                    src={activeItem.src}
                    alt={activeItem.alt || activeItem.label}
                    className="w-full h-full object-contain drop-shadow-md transition-transform duration-500 hover:scale-110"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes("logo coloured.jpg")) {
                        target.src = "/logo coloured.jpg";
                      }
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-slate-800 font-bold flex items-center justify-center shadow-lg overflow-hidden p-1">
                    <img src="/logo coloured.jpg" alt="Babay Dee Atta Chakki Logo" className="w-full h-full object-contain object-center rounded-full" />
                  </div>
                )}

                {activeItem.badge && (
                  <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm">
                    {activeItem.badge}
                  </span>
                )}
              </div>

              {/* Title & Subtitle */}
              <div 
                onClick={() => onViewDetails?.(activeItem)}
                className="space-y-0.5 sm:space-y-1 w-full cursor-pointer"
              >
                <h4 className="text-sm sm:text-base lg:text-lg font-black text-slate-950 tracking-tight leading-snug hover:text-amber-700 transition-colors">
                  {activeItem.label}
                </h4>
                {activeItem.subtitle && (
                  <p className="text-[10px] sm:text-xs text-slate-600 font-semibold line-clamp-2">
                    {activeItem.subtitle}
                  </p>
                )}
              </div>

              {/* Price Tag if available */}
              {activeItem.price && (
                <div 
                  onClick={() => onViewDetails?.(activeItem)}
                  className="text-xs sm:text-sm font-black text-[#3b4414] bg-amber-100/80 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-amber-300/60 cursor-pointer"
                >
                  {typeof activeItem.price === "number"
                    ? `Rs. ${activeItem.price.toLocaleString()}`
                    : activeItem.price}
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-1.5 sm:gap-2 pt-0.5">
                {onAddToCart && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFlourParticleBurst(e);
                      onAddToCart(activeItem, e);
                    }}
                    className="add-to-basket-btn w-full py-2.5 px-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wider rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <ShoppingBag size={14} className="stroke-[2.5] shrink-0" />
                    <span className="btn-text-label font-black">ADD TO BASKET</span>
                  </button>
                )}

                {onViewDetails && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(activeItem);
                    }}
                    className="w-full py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Eye size={11} className="stroke-[2.5]" />
                    <span>View Details</span>
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Orbit Controls (Prev / Play-Pause / Next) */}
      <div className="flex items-center gap-3 mt-6 z-10">
        <button
          onClick={handlePrev}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 hover:text-slate-900 flex items-center justify-center shadow-xs transition-all active:scale-90 cursor-pointer"
          title="Previous Product"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            "px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border",
            isPlaying
              ? "bg-amber-400 text-slate-950 border-amber-500"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <RotateCw className={cn("w-3.5 h-3.5", isPlaying && "animate-spin-slow")} />
          <span>{isPlaying ? "Orbit Active" : "Paused"}</span>
        </button>

        <button
          onClick={handleNext}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 hover:text-slate-900 flex items-center justify-center shadow-xs transition-all active:scale-90 cursor-pointer"
          title="Next Product"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default OrbitalImageWheel;

