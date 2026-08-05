import React, { MouseEvent, useState, useRef, useEffect } from "react";
import { Product } from "../types";
import { AnimeHover3D } from "./AnimatedComponents";
import { triggerFlourParticleBurst } from "./GsapAnimations";
import { Sparkles, ShieldCheck, ShoppingBag, Layers, Info, Heart, ArrowRightLeft, Zap } from "lucide-react";
import { animate } from "animejs";
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

interface ProductHoverPopoverProps {
  product: Product;
  align: "left" | "right";
  isHovered: boolean;
  onAddToCart: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function ProductHoverPopover({ product, align, isHovered, onAddToCart }: ProductHoverPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (popoverRef.current && isHovered) {
      // Set initial styles to avoid flashes before animation starts
      popoverRef.current.style.opacity = "0";
      const startTranslateX = align === "right" ? -15 : 15;
      const startRotateY = align === "right" ? -25 : 25;

      animate(popoverRef.current, {
        opacity: [0, 1],
        scale: [0.92, 1],
        rotateY: [startRotateY, 0],
        translateX: [startTranslateX, 0],
        duration: 500,
        easing: "easeOutExpo",
        transformPerspective: 1000,
      });
    }
  }, [align, isHovered]);

  return (
    <div
      ref={popoverRef}
      className={cn(
        "absolute top-[-20px] z-50 w-80 bg-neutral-950/95 backdrop-blur-md text-white border border-white/10 rounded-2xl shadow-2xl overflow-hidden select-none hidden md:block",
        align === "right" ? "left-[104%]" : "right-[104%]"
      )}
      style={{
        transformStyle: "preserve-3d",
        transformOrigin: align === "right" ? "left center" : "right center",
      }}
    >
      {/* Premium Media Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-[#2f3513] via-stone-900 to-[#4d571a]/40 flex items-center justify-center p-6 border-b border-white/10">
        {/* Subtle decorative grid/grain texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
        
        {/* Floating background glows */}
        <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-amber-400/5 blur-xl" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-[#3b4414]/15 blur-2xl" />

        <ProductIcon
          category={product.category}
          productId={product.id}
          productImage={product.productImage}
          size={56}
          className={cn(
            "w-20 h-20 border-white/20 shadow-xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition-all duration-500",
            isHovered ? "scale-105 rotate-3" : "scale-100"
          )}
        />

        {/* Console-style slide dot indicators (visual ornament) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          <span className="w-4 h-1 rounded-full bg-amber-400 block animate-pulse" />
          <span className="w-1 h-1 rounded-full bg-white/30 block" />
          <span className="w-1 h-1 rounded-full bg-white/30 block" />
          <span className="w-1 h-1 rounded-full bg-white/30 block" />
        </div>

        {/* Quality Seal floating badge */}
        <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500/80 to-amber-600/80 border border-amber-400/40 text-slate-950 text-[7px] uppercase tracking-widest font-black px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
          <Sparkles size={8} className="fill-slate-950 animate-spin-slow" /> PREMIUM SELECTION
        </div>
      </div>

      {/* Popover Body Content */}
      <div className="p-5 space-y-4">
        {/* Badges & Title */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
              {product.category?.toUpperCase() || "ORGANIC"}
            </span>
            {product.badge && (
              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                {product.badge}
              </span>
            )}
            <span className="bg-white/5 text-slate-300 border border-white/5 text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck size={8} className="text-emerald-400" /> Pure
            </span>
          </div>
          
          <h4 className="text-white font-sans font-black text-sm tracking-tight uppercase leading-snug">
            {product.name}
          </h4>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Description */}
        <p className="text-slate-300 font-sans text-xs leading-relaxed font-light">
          {product.desc}
        </p>

        {/* Dynamic Specifications / Nutritional Data */}
        {product.specs && Object.keys(product.specs).length > 0 && (
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              <Layers size={10} className="text-amber-400" />
              <span>Nutrition & Integrity Metrics</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="space-y-0.5 border-l border-white/10 pl-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block tracking-tight">{key}</span>
                  <span className="text-[11px] text-slate-100 font-semibold block truncate" title={value}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-white/5 w-full" />

        {/* Cart CTA */}
        <div className="pt-1">
          {product.outOfStock ? (
            <button
              disabled
              className="w-full py-2.5 bg-red-950/40 border border-red-500/20 text-red-400 text-[10px] font-black uppercase rounded tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              OUT OF STOCK
            </button>
          ) : (
            <button
              onClick={(e) => {
                triggerHapticFeedback(35);
                triggerFlourParticleBurst(e);
                onAddToCart(e);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 text-[10px] font-black uppercase rounded tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-400/10 hover:shadow-amber-400/20"
            >
              <ShoppingBag size={11} className="stroke-[3]" /> ADD TO BASKET
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-1.5 justify-center text-[9px] text-slate-500 pt-1.5 border-t border-white/5">
          <Info size={10} className="text-amber-400/60" />
          <span>Click card to inspect complete 3D interactive field</span>
        </div>
      </div>
    </div>
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
  const [popoverAlign, setPopoverAlign] = useState<"left" | "right">("right");
  const [selectedQty, setSelectedQty] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  const totalPrice = product.price * selectedQty;

  const handleMouseEnter = () => {
    if (window.innerWidth >= 768) {
      setIsHovered(true);
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        if (rect.left + rect.width / 2 > window.innerWidth / 2) {
          setPopoverAlign("left");
        } else {
          setPopoverAlign("right");
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("relative h-full transition-all duration-300", isHovered ? "z-50" : "z-10")}
    >
      <AnimeHover3D className="h-full">
        <div
          id={`product-card-container-${product.id}`}
          onClick={onClick}
          className={cn(
            "group flex flex-col justify-between bg-white border rounded-xl p-3.5 w-full cursor-pointer h-full transition-all duration-300",
            isHovered 
              ? "border-amber-500 shadow-xl ring-2 ring-amber-500/10 bg-amber-50/10 scale-[1.01]" 
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
                  className="absolute bottom-2 right-2 z-20 px-3 py-2 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl border border-amber-300 shadow-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  title="One-Tap Quick Add to Cart"
                >
                  <Zap className="w-4 h-4 fill-slate-950 shrink-0" />
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
              <div className="mt-1.5 space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span className="font-semibold">Quantity:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {displayFormattedQty(selectedQty, product.unit)}
                  </span>
                </div>
                <WeightQtyEditor
                  quantity={selectedQty}
                  onChange={setSelectedQty}
                  unit={product.unit}
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
                "w-full mt-3 py-3 px-3.5 min-h-[48px] text-xs font-black uppercase rounded-xl tracking-wider transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer shadow-sm active:scale-98",
                isHovered 
                  ? "bg-[#3b4414] text-white hover:bg-[#2f3513]" 
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              )}
              style={{ transformOrigin: "center center" }}
            >
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>ADD TO BASKET</span>
              </div>
              <span className="font-mono text-xs opacity-90 whitespace-nowrap">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </button>
          )}
        </div>
      </AnimeHover3D>

      {/* 3D Anime.js detailed Popover */}
      {isHovered && (
        <ProductHoverPopover
          product={product}
          align={popoverAlign}
          isHovered={isHovered}
          onAddToCart={(e) => {
            e.stopPropagation();
            onAddToCart(product, selectedQty, e as any);
          }}
        />
      )}
    </div>
  );
}
