import React from "react";
import { Home, Store, Heart, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { triggerHapticFeedback } from "../lib/utils";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onOpenWishlist: () => void;
  bounceTrigger?: number;
}

export function MobileBottomNav({
  activeTab,
  setActiveTab,
  cartCount,
  wishlistCount,
  onOpenCart,
  onOpenWishlist,
  bounceTrigger = 0,
}: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 sm:hidden shadow-lg h-16 flex items-center pb-safe">
      <div className="grid grid-cols-4 gap-1 items-center w-full max-w-md mx-auto text-center h-full">
        {/* Home */}
        <button
          type="button"
          aria-label="Navigate to Home Page"
          onClick={() => {
            triggerHapticFeedback(15);
            setActiveTab("home");
          }}
          className={`flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl transition-all cursor-pointer ${
            activeTab === "home"
              ? "text-blue-700 font-extrabold bg-blue-50/80"
              : "text-slate-500 font-medium hover:text-blue-700"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Home</span>
        </button>

        {/* Shop */}
        <button
          type="button"
          aria-label="Navigate to Product Catalog"
          onClick={() => {
            triggerHapticFeedback(15);
            setActiveTab("shop");
          }}
          className={`flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl transition-all cursor-pointer ${
            activeTab === "shop"
              ? "text-blue-700 font-extrabold bg-blue-50/80"
              : "text-slate-500 font-medium hover:text-blue-700"
          }`}
        >
          <Store className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-bold">Catalog</span>
        </button>

        {/* Wishlist */}
        <button
          type="button"
          aria-label={`View Wishlist (${wishlistCount} items saved)`}
          onClick={() => {
            triggerHapticFeedback(20);
            onOpenWishlist();
          }}
          className="flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl text-slate-500 font-medium hover:text-rose-600 relative cursor-pointer"
        >
          <div className="relative">
            <Heart className="w-5 h-5 text-rose-500" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-2 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-2xs">
                {wishlistCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-bold">Saved</span>
        </button>

        {/* Cart / Basket */}
        <button
          type="button"
          id="mobile-bottom-nav-cart-btn"
          aria-label={`Open Shopping Basket (${cartCount} items)`}
          onClick={() => {
            triggerHapticFeedback(25);
            onOpenCart();
          }}
          className="flex flex-col items-center justify-center h-full min-h-[48px] rounded-xl text-blue-700 font-bold relative cursor-pointer"
        >
          <div className="relative flex items-center justify-center">
            <motion.div
              key={`mobile-bottom-bounce-${bounceTrigger}`}
              animate={
                bounceTrigger > 0
                  ? {
                      y: [0, -7, 2, -3, 1, 0],
                      scale: [1, 1.28, 0.94, 1.12, 0.98, 1],
                      rotate: [0, -12, 10, -5, 2, 0],
                    }
                  : {}
              }
              transition={{
                duration: 0.65,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="inline-flex items-center justify-center origin-bottom"
            >
              <ShoppingBag className="w-5 h-5 text-amber-500" />
            </motion.div>
            {cartCount > 0 && (
              <motion.span
                key={`mobile-cart-badge-${bounceTrigger}`}
                animate={bounceTrigger > 0 ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-2xs"
              >
                {cartCount}
              </motion.span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 font-bold">Basket</span>
        </button>
      </div>
    </div>
  );
}

