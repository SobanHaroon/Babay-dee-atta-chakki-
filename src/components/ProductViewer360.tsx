import React from "react";
import { ProductIcon } from "./ProductIcon";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Product } from "../types";

interface ProductViewer360Props {
  product: Product;
}

export function ProductViewer360({ product }: ProductViewer360Props) {
  const imageUrl = product.productImage || product.img;

  return (
    <div className="w-full h-full min-h-[380px] sm:min-h-[460px] md:min-h-[500px] flex flex-col items-center justify-between relative p-2 sm:p-4 select-none">
      {/* Top-Left Badges */}
      <div className="w-full flex items-center justify-between z-20 mb-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="bg-[#00b074] text-white font-black text-[10px] sm:text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
            <Sparkles size={13} className="fill-white" /> FRESH MILLED TODAY
          </span>
          <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
            Stone-Ground Organic
          </span>
        </div>
      </div>

      {/* Product Image Container filling the full left half */}
      <div className="w-full flex-1 min-h-[280px] sm:min-h-[360px] md:min-h-[420px] bg-white/80 hover:bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 flex items-center justify-center relative overflow-hidden border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300 group">
        {imageUrl ? (
          <img
            key={product.id}
            src={imageUrl}
            alt={product.name}
            className="w-full h-full max-h-[360px] sm:max-h-[420px] md:max-h-[460px] object-contain drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-105"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ProductIcon
            productId={product.id}
            category={product.category}
            size={64}
            className="w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-105"
          />
        )}
      </div>

      {/* Bottom Guaranteed Pure & Stone-Ground Badge */}
      <div className="flex items-center justify-center w-full pt-3 z-20">
        <div className="bg-emerald-50 text-emerald-800 font-bold text-xs sm:text-sm py-1.5 px-5 rounded-full border border-emerald-200/80 flex items-center justify-center gap-2 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Guaranteed Pure & Stone-Ground</span>
        </div>
      </div>
    </div>
  );
}
