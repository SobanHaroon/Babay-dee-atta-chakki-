import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Product, CartItem } from "../types";
import { ProductIcon } from "./ProductIcon";
import { Heart, ShoppingBag, Trash2, X, Sparkles, ArrowRight } from "lucide-react";
import { triggerHapticFeedback } from "../lib/utils";

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds?: string[];
  products?: Product[];
  wishlistProducts?: Product[];
  onRemoveFromWishlist?: (id: string, e?: React.MouseEvent) => void;
  onRemoveWishlist?: (id: string, e?: React.MouseEvent) => void;
  onAddToCart: (product: Product, quantity?: number, e?: any) => void;
  onOpenProductModal?: (product: Product) => void;
}

export function WishlistDrawer({
  isOpen,
  onClose,
  wishlistIds = [],
  products = [],
  wishlistProducts: passedProducts,
  onRemoveFromWishlist,
  onRemoveWishlist,
  onAddToCart,
  onOpenProductModal,
}: WishlistDrawerProps) {
  const wishlistProducts = passedProducts || products.filter((p) => wishlistIds.includes(p.id));
  const removeHandler = onRemoveWishlist || onRemoveFromWishlist;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Saved Wishlist</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {wishlistProducts.length} {wishlistProducts.length === 1 ? "item" : "items"} stored in Local Storage
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {wishlistProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-400 flex items-center justify-center mb-3">
                    <Heart className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">Your wishlist is empty</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                    Click the heart icon on any product to save your favorites for later!
                  </p>
                </div>
              ) : (
                wishlistProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 transition-all shadow-2xs group"
                  >
                    <div
                      onClick={() => onOpenProductModal(p)}
                      className="cursor-pointer shrink-0"
                    >
                      <ProductIcon
                        productId={p.id}
                        productImage={p.productImage}
                        size={24}
                        className="w-16 h-16 rounded-xl shadow-2xs object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4
                            onClick={() => onOpenProductModal(p)}
                            className="text-xs font-black text-slate-900 dark:text-slate-100 hover:text-[#3b4414] dark:hover:text-amber-400 cursor-pointer line-clamp-1"
                          >
                            {p.name}
                          </h4>
                          <button
                            onClick={() => {
                              triggerHapticFeedback(15);
                              onRemoveFromWishlist(p.id);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                            title="Remove from wishlist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                          Rs. {p.price} / {p.unit || "Kg"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <button
                          onClick={(e) => {
                            triggerHapticFeedback(30);
                            onAddToCart(p, 1, e);
                          }}
                          className="flex-1 bg-[#3b4414] hover:bg-[#2c330e] text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {wishlistProducts.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => {
                    wishlistProducts.forEach((p) => onAddToCart(p, 1));
                    onClose();
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Add All {wishlistProducts.length} Items to Cart</span>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
