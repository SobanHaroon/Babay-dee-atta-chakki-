import React, { useState, useRef } from "react";
import { ProductIcon } from "./ProductIcon";
import { RotateCcw, ZoomIn, Eye, Sparkles, ShieldCheck } from "lucide-react";

interface ProductViewer360Props {
  product: any;
}

export function ProductViewer360({ product }: ProductViewer360Props) {
  const [activeTab, setActiveTab] = useState<"front" | "back" | "zoom" | "nutrition" | "360">("front");
  const [rotationAngle, setRotationAngle] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    startX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startX.current;
    setRotationAngle((prev) => (prev + diff * 0.8) % 360);
    startX.current = currentX;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="space-y-3">
      {/* Viewer Canvas Box */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        className="w-full h-64 sm:h-72 bg-gradient-to-b from-amber-500/10 to-slate-100 dark:to-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center relative overflow-hidden border border-slate-200 dark:border-slate-700 select-none cursor-grab active:cursor-grabbing"
      >
        {/* Freshness & Stock Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow-2xs uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Fresh Milled Today
          </span>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            Stone-Ground Organic
          </span>
        </div>

        {/* Dynamic Display based on Tab */}
        {activeTab === "360" ? (
          <div className="flex flex-col items-center justify-center">
            <div
              style={{ transform: `rotateY(${rotationAngle}deg)` }}
              className="transition-transform duration-75 ease-out"
            >
              <ProductIcon
                productId={product.id}
                productImage={product.productImage}
                size={36}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl shadow-xl object-cover"
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 px-3 py-1 rounded-full shadow-2xs">
              <RotateCcw className="w-3 h-3 animate-spin" /> Drag or swipe horizontally to rotate 360°
            </span>
          </div>
        ) : activeTab === "zoom" ? (
          <div className="scale-125 transition-transform duration-300">
            <ProductIcon
              productId={product.id}
              productImage={product.productImage}
              size={36}
              className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl shadow-2xl object-cover"
            />
          </div>
        ) : activeTab === "nutrition" ? (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md max-w-xs text-center space-y-2">
            <h5 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wide border-b pb-1">
              Nutrition Information (per 100g)
            </h5>
            <div className="grid grid-cols-2 gap-2 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div>Energy: <strong className="text-amber-600">364 kcal</strong></div>
              <div>Protein: <strong className="text-emerald-600">12.5g</strong></div>
              <div>Carbs: <strong className="text-amber-600">71.0g</strong></div>
              <div>Dietary Fiber: <strong className="text-emerald-600">10.7g</strong></div>
            </div>
          </div>
        ) : (
          <div>
            <ProductIcon
              productId={product.id}
              productImage={product.productImage}
              size={36}
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-2xl shadow-xl object-cover transition-all ${
                activeTab === "back" ? "scale-x-[-1]" : ""
              }`}
            />
          </div>
        )}
      </div>

      {/* View Switcher Thumbnails */}
      <div className="grid grid-cols-5 gap-1.5 text-[10px] font-bold">
        {[
          { id: "front", label: "Front" },
          { id: "back", label: "Back" },
          { id: "zoom", label: "Zoom" },
          { id: "nutrition", label: "Label" },
          { id: "360", label: "360° View" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-1.5 px-1 rounded-xl border transition-all text-center cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#3b4414] text-white border-[#3b4414] shadow-xs"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
