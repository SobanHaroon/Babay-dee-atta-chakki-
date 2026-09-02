import React, { MouseEvent, useState, useRef, useEffect } from "react";
import { Product } from "../types";
import { triggerFlourParticleBurst } from "./GsapAnimations";
import { Sparkles, ShieldCheck, ShoppingBag, Layers, Info, Heart, Zap, Check, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, triggerHapticFeedback } from "../lib/utils";
import { ProductIcon } from "./ProductIcon";
import { WeightQtyEditor, displayFormattedQty } from "./WeightQtyEditor";

interface ProductCardProps {
  key?: any;
  product: Product;
  onAddToCart: (p: Product, quantity: number, e: MouseEvent) => void;
  onClick: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string, e: React.MouseEvent) => void;
}

interface ProductExpandedHoverCardProps {
  product: Product;
  selectedQty: number;
  setSelectedQty: (qty: number) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string, e: React.MouseEvent) => void;
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
}

function ProductExpandedHoverCard({
  product,
  selectedQty,
  setSelectedQty,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onClick,
}: ProductExpandedHoverCardProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const totalPrice = (product.price || 0) * selectedQty;

  // Auto cycle slide indicators for launcher effect
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 6 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="absolute -top-3.5 -left-3.5 -right-3.5 z-50 rounded-2xl bg-[#131720]/98 backdrop-blur-xl text-white border border-slate-700/80 hover:border-amber-500/50 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)] overflow-hidden cursor-pointer select-none flex flex-col justify-between"
      style={{
        transformOrigin: "center top",
      }}
    >
      {/* 1. Launcher-Style Hero Media Banner */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#2a3015] via-[#161a22] to-stone-900 flex items-center justify-center border-b border-slate-700/60 group/banner">
        {/* Subtle grid texture overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:14px_14px] opacity-70" />
        
        {/* Background glow effects */}
        <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full bg-[#4a5818]/25 blur-2xl pointer-events-none" />

        {/* Wishlist Button inside Hover Card */}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHapticFeedback(25);
              onToggleWishlist(product.id, e);
            }}
            className={cn(
              "absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md",
              isWishlisted
                ? "bg-rose-500 text-white scale-105"
                : "bg-slate-900/80 hover:bg-rose-500 text-slate-300 hover:text-white border border-slate-700"
            )}
            title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          >
            <Heart className={cn("w-3.5 h-3.5", isWishlisted && "fill-white")} />
          </button>
        )}

        {/* Purity & Category Header Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
          <span className="bg-amber-500/90 text-slate-950 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow flex items-center gap-1">
            <Sparkles size={8} className="fill-slate-950" /> Stone Ground
          </span>
          {product.badge && (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md">
              {product.badge}
            </span>
          )}
        </div>

        {/* Main Product Visual */}
        {product.productImage ? (
          <img
            src={product.productImage}
            alt={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/banner:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center p-3">
            <ProductIcon
              category={product.category}
              productId={product.id}
              size={54}
              className="w-20 h-20 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover/banner:scale-110 group-hover/banner:rotate-2"
            />
          </div>
        )}

        {/* Launcher Slide Indicator Pills at bottom of media (matches user reference image) */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-slate-950/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              activeSlide === 0 ? "w-5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "w-1.5 bg-white/30"
            )}
          />
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              activeSlide === 1 ? "w-5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "w-1.5 bg-white/30"
            )}
          />
          <span
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              activeSlide === 2 ? "w-5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "w-1.5 bg-white/30"
            )}
          />
        </div>
      </div>

      {/* 2. Content Body (Title, Tags, Description, Specs & Actions) */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          {/* Title */}
          <div>
            <h3 className="text-white font-sans font-black text-sm sm:text-base tracking-tight uppercase leading-snug line-clamp-2">
              {product.name}
            </h3>
          </div>

          {/* Launcher-Style Tag Chips (Exact match to screenshot) */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-md transition-colors">
              {product.category?.replace(/_/g, " ").toUpperCase() || "FLOUR"}
            </span>
            <span className="bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-md transition-colors">
              100% Unadulterated
            </span>
            <span className="bg-slate-800/90 hover:bg-slate-700/90 text-amber-300/90 border border-amber-500/20 text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors">
              <ShieldCheck size={11} className="text-emerald-400" /> Chakki Fresh
            </span>
          </div>

          {/* Description Paragraph */}
          <p className="text-slate-300 font-sans text-xs leading-relaxed font-normal line-clamp-2">
            {product.desc}
          </p>

          {/* Price Header */}
          <div className="flex items-baseline justify-between py-1.5 px-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-amber-400 font-mono tracking-tight">
                Rs. {product.priceRange || (product.price ? product.price.toLocaleString() : "170")}
              </span>
              <span className="text-xs font-bold text-slate-400">
                / {product.unit || "Kg"}
              </span>
            </div>

            {selectedQty > 1 && !product.outOfStock && (
              <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total</span>
                <span className="text-xs font-black text-emerald-400 font-mono">
                  Rs. {totalPrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Quantity Editor */}
          {!product.outOfStock && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="space-y-1 bg-slate-800/20 p-2 rounded-xl border border-slate-700/40"
            >
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Select Weight:</span>
                <span className="font-mono font-bold text-amber-400">
                  {displayFormattedQty(selectedQty, "Kg")}
                </span>
              </div>
              <WeightQtyEditor
                quantity={selectedQty}
                onChange={setSelectedQty}
                unit="Kg"
              />
            </div>
          )}
        </div>

        {/* 3. Action Buttons & Inspection Hint */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          {product.outOfStock ? (
            <button
              disabled
              className="w-full py-2.5 bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-black uppercase rounded-xl tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              OUT OF STOCK
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback(35);
                triggerFlourParticleBurst(e);
                onAddToCart(e);
              }}
              className="add-to-basket-btn w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 text-xs font-black uppercase rounded-xl tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2"
            >
              <ShoppingBag size={14} className="stroke-[2.5] shrink-0 text-slate-950" />
              <span className="btn-text-label">ADD TO BASKET</span>
              <span className="font-mono text-xs opacity-90 font-extrabold ml-1">
                • Rs. {totalPrice.toLocaleString()}
              </span>
            </button>
          )}

          <div className="flex items-center gap-1.5 justify-center text-[9px] text-slate-400 hover:text-slate-200 transition-colors">
            <Eye size={11} className="text-amber-400" />
            <span>Click to inspect 3D grain & full specifications</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ProductCard({
  product,
  onAddToCart,
  onClick,
  isWishlisted,
  onToggleWishlist,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const totalPrice = (product.price || 0) * selectedQty;

  const handleMouseEnter = () => {
    if (window.innerWidth >= 768) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Smooth exit delay to avoid flicker when moving between nested controls
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative h-full transition-all duration-300",
        isHovered ? "z-50" : "z-10"
      )}
    >
      {/* Base Card (Stays in flow to maintain grid stability) */}
      <div
        id={`product-card-container-${product.id}`}
        onClick={onClick}
        className={cn(
          "group flex flex-col justify-between bg-white border rounded-xl p-2.5 sm:p-3.5 w-full max-w-full cursor-pointer h-full transition-all duration-300 overflow-hidden",
          isHovered
            ? "border-amber-500 shadow-xl ring-2 ring-amber-500/10 bg-amber-50/5"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        )}
      >
        <div>
          {/* Product Image Stage */}
          <div className="relative w-full aspect-square bg-stone-50 flex items-center justify-center overflow-hidden border border-slate-100 rounded-lg select-none mb-2.5">
            {/* Wishlist Heart Button */}
            {onToggleWishlist && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback(20);
                  onToggleWishlist(product.id, e);
                }}
                className={cn(
                  "absolute top-2 right-2 z-20 w-10 h-10 min-h-[44px] min-w-[44px] sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs",
                  isWishlisted
                    ? "bg-rose-500 text-white scale-105"
                    : "bg-white/90 text-slate-500 hover:text-rose-500 hover:bg-white"
                )}
                title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              >
                <Heart className={cn("w-4 h-4", isWishlisted && "fill-white")} />
              </button>
            )}

            {/* Floating Quick Add Button on Image for One-Tap Mobile Addition */}
            {!product.outOfStock && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback(30);
                  triggerFlourParticleBurst(e);
                  onAddToCart(product, selectedQty || 1, e);
                }}
                className="absolute bottom-2 right-2 z-20 min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl border border-amber-300 shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer"
                title="One-Tap Quick Add to Cart"
              >
                <span className="text-base sm:hidden leading-none">⚡</span>
                <Zap className="hidden sm:block w-4 h-4 fill-slate-950 shrink-0" />
                <span className="hidden sm:inline">+ Quick Add</span>
              </button>
            )}

            {product.productImage ? (
              <img
                src={product.productImage}
                alt={product.name}
                loading="lazy"
                decoding="async"
                width="400"
                height="400"
                referrerPolicy="no-referrer"
                className={cn(
                  "w-full h-full object-cover object-center transition-all duration-300 ease-out",
                  isHovered ? "scale-105" : "scale-100"
                )}
              />
            ) : (
              <ProductIcon
                category={product.category}
                productId={product.id}
                size={44}
                className={cn(
                  "w-20 h-20 transition-all duration-300 ease-out",
                  isHovered ? "scale-105 rotate-2 shadow-md" : "scale-100 shadow-sm"
                )}
              />
            )}
          </div>

          {/* Badge & Category Indicator */}
          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-h-[16px]">
            {product.outOfStock ? (
              <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                Out Of Stock
              </span>
            ) : product.badge ? (
              <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                {product.badge}
              </span>
            ) : (
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                {product.category?.replace("_", " ") || "Organic"}
              </span>
            )}
          </div>

          {/* Product Name / Title */}
          <h3
            className={cn(
              "font-sans font-black text-xs sm:text-sm tracking-tight uppercase line-clamp-2 min-h-[28px] sm:min-h-[36px] leading-tight mb-1.5 transition-colors duration-200",
              isHovered ? "text-amber-700" : "text-slate-900"
            )}
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Price Display */}
          <div className="flex items-baseline justify-between py-1 mb-1 border-y border-slate-100">
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Rs. {product.priceRange || (product.price ? product.price.toLocaleString() : "170")}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                / {product.unit || "Kg"}
              </span>
            </div>

            {selectedQty > 1 && !product.outOfStock && (
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Subtotal</span>
                <span className="text-xs font-black text-[#3b4414]">
                  Rs. {totalPrice.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Quantity Selector */}
          {!product.outOfStock && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 space-y-1 w-full max-w-full overflow-hidden"
            >
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span className="font-semibold">Quantity:</span>
                <span className="font-mono font-bold text-slate-800">
                  {displayFormattedQty(selectedQty, "Kg")}
                </span>
              </div>
              <WeightQtyEditor
                quantity={selectedQty}
                onChange={setSelectedQty}
                unit="Kg"
              />
            </div>
          )}
        </div>

        {/* Add to Cart Button */}
        {product.outOfStock ? (
          <button
            disabled
            onClick={(e) => {
              e.stopPropagation();
            }}
            id={`add-to-cart-btn-${product.id}`}
            aria-label={`${product.name} is out of stock`}
            className="w-full mt-3 py-3 min-h-[48px] text-slate-400 bg-slate-100 text-xs font-bold uppercase rounded-xl tracking-wider flex items-center justify-center cursor-not-allowed border border-slate-200"
          >
            OUT OF STOCK
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerHapticFeedback(35);
              triggerFlourParticleBurst(e);
              onAddToCart(product, selectedQty, e);
            }}
            id={`add-to-cart-btn-${product.id}`}
            aria-label={`Add ${product.name} to cart`}
            className={cn(
              "add-to-basket-btn w-full mt-3 py-3 px-3.5 justify-between text-xs font-black uppercase rounded-xl tracking-wider transition-all duration-200 cursor-pointer shadow-sm active:scale-98",
              isHovered 
                ? "bg-[#3b4414] text-white hover:bg-[#2f3513]" 
                : "bg-slate-900 hover:bg-slate-800 text-white"
            )}
            style={{ transformOrigin: "center center" }}
          >
            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <ShoppingBag className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="btn-text-label">ADD TO BASKET</span>
            </div>
            <span className="font-mono text-xs opacity-90 whitespace-nowrap font-extrabold">
              Rs. {totalPrice.toLocaleString()}
            </span>
          </button>
        )}
      </div>

      {/* Expanded Launcher-Style Hover Card (Smoothly comes forward in front of the card) */}
      <AnimatePresence>
        {isHovered && (
          <ProductExpandedHoverCard
            product={product}
            selectedQty={selectedQty}
            setSelectedQty={setSelectedQty}
            isWishlisted={isWishlisted}
            onToggleWishlist={onToggleWishlist}
            onClick={onClick}
            onAddToCart={(e) => {
              e.stopPropagation();
              onAddToCart(product, selectedQty, e as any);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
