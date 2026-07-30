import React from "react";
import { Wheat, Sprout, Leaf, Layers, Sparkles, HelpCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface ProductIconProps {
  category?: string;
  productId?: string;
  className?: string;
  iconClassName?: string;
  size?: number;
  productImage?: string;
}

export function getCategoryFromId(id: string): string {
  const lowerId = id?.toLowerCase() || "";
  if (
    lowerId.includes("atta") ||
    lowerId.includes("suji") ||
    lowerId.includes("maida") ||
    lowerId.includes("besan")
  ) {
    return "flour";
  }
  if (lowerId.includes("basmati") || lowerId.includes("chawal")) {
    return "rice";
  }
  if (
    lowerId.includes("daal") ||
    lowerId.includes("lobia") ||
    lowerId.includes("channa") ||
    lowerId.includes("channey") ||
    lowerId.includes("masoor")
  ) {
    return "lentils";
  }
  if (
    lowerId.includes("giri") ||
    lowerId.includes("roasted") ||
    lowerId.includes("khopra") ||
    lowerId.includes("munaka") ||
    lowerId.includes("khajoor") ||
    lowerId.includes("dry-") ||
    lowerId.includes("pista") ||
    lowerId.includes("kaju") ||
    lowerId.includes("akhrot")
  ) {
    return "dry_fruits";
  }
  return "herbs";
}

export function ProductIcon({
  category,
  productId = "",
  className,
  iconClassName,
  size = 40,
  productImage,
}: ProductIconProps) {
  // If product image is provided, render it instead of the icon representation
  if (productImage) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-300 overflow-hidden bg-white shrink-0",
          className
        )}
      >
        <img
          src={productImage}
          alt="Product image"
          loading="lazy"
          decoding="async"
          width="200"
          height="200"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </div>
    );
  }

  // Determine icon configuration based on category or product ID fallback
  const resolvedCategory = category || getCategoryFromId(productId);
  const lowerCat = resolvedCategory?.toLowerCase() || "";
  
  let IconComponent = HelpCircle;
  let bgStyles = "from-slate-50 to-slate-100 border-slate-200 text-slate-600 shadow-slate-100/40";
  let ringColor = "bg-slate-200/30";

  if (lowerCat === "flour") {
    IconComponent = Wheat;
    bgStyles = "from-amber-50 to-orange-100/80 border-amber-200/60 text-amber-700 shadow-amber-100/50";
    ringColor = "bg-amber-100/50";
  } else if (lowerCat === "rice") {
    IconComponent = Sprout;
    bgStyles = "from-emerald-50 to-teal-100/80 border-emerald-200/60 text-emerald-700 shadow-emerald-100/50";
    ringColor = "bg-emerald-100/50";
  } else if (lowerCat === "lentils") {
    IconComponent = Layers;
    bgStyles = "from-orange-50 to-amber-100/80 border-orange-200/60 text-orange-700 shadow-orange-100/50";
    ringColor = "bg-orange-100/40";
  } else if (lowerCat === "dry_fruits" || lowerCat === "dry_fruit") {
    IconComponent = Sparkles;
    bgStyles = "from-yellow-50 to-rose-100/80 border-yellow-200/60 text-amber-800 shadow-yellow-100/50";
    ringColor = "bg-yellow-100/40";
  } else if (lowerCat === "herbs") {
    IconComponent = Leaf;
    bgStyles = "from-green-50 to-emerald-100/80 border-green-200/60 text-green-700 shadow-green-100/50";
    ringColor = "bg-green-100/50";
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-2xl border bg-gradient-to-br shadow-sm transition-all duration-300 overflow-hidden",
        bgStyles,
        className
      )}
    >
      {/* Decorative pulse background rings for a premium layered feel */}
      <div className={cn("absolute w-2/3 h-2/3 rounded-full animate-pulse opacity-45", ringColor)} />
      <div className={cn("absolute w-1/2 h-1/2 rounded-full opacity-30 scale-125", ringColor)} />
      
      {/* Main Lucide Icon with dynamic styling */}
      <IconComponent
        size={size}
        className={cn(
          "relative z-10 filter drop-shadow-sm transition-all duration-300",
          iconClassName
        )}
      />
    </div>
  );
}
