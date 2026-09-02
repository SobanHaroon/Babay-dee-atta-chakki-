import React from "react";
import { ProductIcon } from "./ProductIcon";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Product } from "../types";

interface ProductViewer360Props {
  product: Product;
}

export function ProductViewer360({ product }: ProductViewer360Props) {
  return (
    <div className="flex flex-col items-center justify-between w-full h-full space-y-4">
      {/* Outer Stage Canvas with Top Badges and Large Centered Product Image */}
      <div className="w-full flex-1 min-h-[380px] sm:min-h-[460px] bg-gradient-to-b from-[#fbf8f2] via-[#f7f4ec] to-[#f2eee4] rounded-3xl p-5 sm:p-7 flex flex-col items-center justify-center relative overflow-hidden border border-[#e8e3d8] shadow-sm select-none group">
        
        {/* Top-Left Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-20">
          <span className="bg-[#00b074] text-white font-black text-[11px] sm:text-xs px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
            <Sparkles size={13} className="fill-white" /> FRESH MILLED TODAY
          </span>
          <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-bold text-[11px] sm:text-xs px-3.5 py-0.5 rounded-full shadow-2xs">
            Stone-Ground Organic
          </span>
        </div>

        {/* Large Center White Card Stage with High-Res Product Image */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border border-slate-100/90 flex items-center justify-center w-full max-w-sm sm:max-w-md h-[320px] sm:h-[400px] md:h-[440px] transition-all duration-500 relative z-10 overflow-hidden">
          {product.productImage ? (
            <img
              src={product.productImage}
              alt={product.name}
              className="w-full h-full max-h-[380px] sm:max-h-[420px] object-contain drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-108"
              loading="eager"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ProductIcon
              productId={product.id}
              category={product.category}
              size={64}
              className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 drop-shadow-2xl transition-transform duration-500 ease-out group-hover:scale-108"
            />
          )}
        </div>
      </div>

      {/* Bottom Guaranteed Pure & Stone-Ground Badge */}
      <div className="flex items-center justify-center w-full pt-1">
        <div className="bg-[#ecfdf5] text-[#047857] font-bold text-xs sm:text-sm py-2 px-6 rounded-full border border-[#a7f3d0] flex items-center justify-center gap-2 shadow-2xs">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#047857]" />
          <span>Guaranteed Pure & Stone-Ground</span>
        </div>
      </div>
    </div>
  );
}
