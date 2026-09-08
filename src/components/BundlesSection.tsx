import React from "react";
import { Product } from "../types";
import { ShoppingBag, Sparkles, Plus, Check, Zap, Tag } from "lucide-react";
import { ProductIcon } from "./ProductIcon";
import { triggerHapticFeedback } from "../lib/utils";

interface BundlesSectionProps {
  products: Product[];
  onAddBundleToCart: (products: Product[]) => void;
  onSelectProduct?: (product: Product) => void;
}

export function BundlesSection({ products, onAddBundleToCart, onSelectProduct }: BundlesSectionProps) {
  // Find key bundle items: Chakki Atta, Besan, Suji / Lentils
  const atta = products.find((p) => p.name.toLowerCase().includes("atta") || p.name.toLowerCase().includes("wheat")) || products[0];
  const besan = products.find((p) => p.name.toLowerCase().includes("besan") || p.name.toLowerCase().includes("gram")) || products[1];
  const suji = products.find((p) => p.name.toLowerCase().includes("suji") || p.name.toLowerCase().includes("semolina") || p.name.toLowerCase().includes("maida")) || products[2];

  if (!atta || !besan || !suji) return null;

  const bundleItems = [atta, besan, suji];
  const totalPrice = bundleItems.reduce((acc, item) => acc + (item.price || 0), 0);

  return (
    <section className="my-8 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-6 rounded-3xl border border-amber-500/20 shadow-md relative overflow-hidden">
      {/* Decorative badge */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black shadow-xs">
            <Zap className="w-5 h-5 fill-slate-950" />
          </span>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
              Frequently Bought Together
            </h3>
            <p className="text-xs text-slate-600">
              Complete Kitchen Flour Essentials Combo
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-black text-emerald-700">
            Rs. {totalPrice}
          </div>
        </div>
      </div>

      {/* Bundle Item Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-8 grid grid-cols-3 gap-2 sm:gap-3 items-center">
          {bundleItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              <div 
                onClick={() => onSelectProduct?.(item)}
                className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs flex flex-col items-center text-center relative group cursor-pointer hover:border-amber-400 hover:shadow-md transition-all"
                title={`Click to view ${item.name} details`}
              >
                <ProductIcon
                  productId={item.id}
                  productImage={item.productImage}
                  size={20}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-2xs mb-2 object-cover group-hover:scale-105 transition-transform"
                />
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-amber-600 transition-colors">{item.name}</h4>
                <span className="text-[11px] font-extrabold text-[#3b4414] dark:text-amber-400 mt-0.5">
                  Rs. {item.price}
                </span>
                {idx < 2 && (
                  <div className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-xs hidden sm:flex pointer-events-none">
                    +
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Call to Action Button */}
        <div className="md:col-span-4 flex flex-col justify-center">
          <button
            onClick={() => {
              triggerHapticFeedback([30, 40, 30]);
              onAddBundleToCart(bundleItems);
            }}
            className="add-to-basket-btn w-full bg-[#3b4414] hover:bg-[#2c330e] text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer text-xs sm:text-sm group uppercase tracking-wider"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="btn-text-label font-extrabold">ADD ALL 3 ITEMS TO BASKET</span>
          </button>
        </div>
      </div>
    </section>
  );
}
