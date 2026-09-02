import React, { useState, useEffect, useRef } from "react";
import { Product } from "../types";
import { Star, X, ShoppingCart, Sparkles, Share2 } from "lucide-react";
import { ProductViewer360 } from "./ProductViewer360";
import { WeightQtyEditor } from "./WeightQtyEditor";
import { triggerHapticFeedback } from "../lib/utils";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProductIcon } from "./ProductIcon";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ProductDetailsModalProps {
  product: Product;
  allProducts: Product[];
  onClose: () => void;
  onAddToCart: (p: Product, q: number, e?: any) => void;
  onSelectProduct: (p: Product) => void;
  isWishlisted?: (productId: string) => boolean;
  onToggleWishlist?: (productId: string, e: React.MouseEvent) => void;
}

export function ProductDetailsModal({
  product,
  allProducts,
  onClose,
  onAddToCart,
  onSelectProduct,
}: ProductDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [activeDetailTab, setActiveDetailTab] = useState<"specs" | "nutrition">("specs");

  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add overflow-hidden to body to lock background scroll
    document.body.classList.add("overflow-hidden");

    // Trigger falling grains from top when modal opens
    window.dispatchEvent(new CustomEvent("grain-rain", { detail: { type: "modal-open" } }));

    // GSAP Entrance
    const backdrop = backdropRef.current;
    const modal = modalRef.current;

    if (backdrop) {
      gsap.fromTo(
        backdrop,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      );
    }

    if (modal) {
      gsap.fromTo(
        modal,
        { scale: 0.94, opacity: 0, filter: "blur(8px)" },
        { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power3.out" }
      );
    }

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 120);

    return () => {
      document.body.classList.remove("overflow-hidden");
      clearTimeout(timer);
    };
  }, [product.id]);

  const handleShareProduct = () => {
    const text = `Check out this premium *${product.name}* at Babay Dee Chakki!\nPrice: Rs. ${product.price} per ${product.unit}\n\n100% Traditional, Stone-Ground & Pure. Order Yours Now!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  // Cross-sell recommended products with fallback to other products in the catalog
  const sameCategoryProducts = allProducts.filter((p) => p.category === product.category && p.id !== product.id);
  const otherProducts = allProducts.filter((p) => p.category !== product.category && p.id !== product.id);
  const recommendedProducts = [...sameCategoryProducts, ...otherProducts].slice(0, 3);

  const handleSelectRecommended = (recProduct: Product) => {
    onSelectProduct(recProduct);
    setQuantity(1);
    setActiveDetailTab("specs");
    if (scrollContentRef.current) {
      scrollContentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      ref={backdropRef}
      id="product-details-backdrop"
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        id="product-details-container"
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col md:flex-row border border-slate-200/80"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          id="close-details-btn"
          aria-label="Close product details modal"
          className="absolute top-4 right-4 bg-slate-100/90 hover:bg-slate-200 text-slate-700 w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-all z-30 shadow-sm active:scale-95 border border-slate-200/60"
        >
          <X className="w-5 h-5" />
        </button>

        {/* =========================================================
            LEFT HALF: Full Area Product Visual Stage (Matching Image 2)
            ========================================================= */}
        <div className="md:w-1/2 bg-[#f9f7f2] p-5 sm:p-6 lg:p-7 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-200/80 w-full shrink-0 overflow-y-auto max-h-[48vh] md:max-h-[92vh]">
          <ProductViewer360 product={product} />
        </div>

        {/* =========================================================
            RIGHT HALF: Detailed Content & Actions Scrollable
            ========================================================= */}
        <div
          ref={scrollContentRef}
          className="md:w-1/2 p-5 sm:p-7 md:p-8 overflow-y-auto max-h-[52vh] md:max-h-[92vh] space-y-6 flex flex-col justify-between"
        >
          <div className="space-y-5">
            {/* Header area */}
            <div>
              {/* Category & Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-md border border-amber-300/60">
                  {product.category?.replace(/_/g, " ") || "Organic Flour"}
                </span>
                {product.badge && (
                  <span className="text-[11px] font-sans font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200/60">
                    {product.badge}
                  </span>
                )}
              </div>

              {/* Title & Price Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                    {product.name}
                  </h2>
                  {/* Rating Star Badge */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" />
                      ))}
                    </div>
                    <span className="text-xs font-black text-slate-800">4.9</span>
                    <span className="text-xs text-slate-400 font-medium">(120+ Verified Buyers)</span>
                  </div>
                </div>

                {/* Price Badge */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl px-4 py-2 shrink-0 text-center">
                  <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block">Price per {product.unit || "Kg"}</span>
                  <div className="flex items-baseline gap-1 justify-center">
                    <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
                      Rs. {product.priceRange || (product.price ? product.price.toLocaleString() : "170")}
                    </span>
                    <span className="text-xs text-amber-800 font-bold">/ {product.unit || "Kg"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Description */}
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-normal">
              {product.desc}
            </p>

            {/* Specifications & Nutritional Facts Tab Selection */}
            <div>
              {product.nutrition ? (
                <div className="flex border-b border-slate-200 mb-3.5 gap-4">
                  <button
                    type="button"
                    id="tab-specs-btn"
                    onClick={() => setActiveDetailTab("specs")}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                      activeDetailTab === "specs"
                        ? "text-amber-700 border-amber-600 font-extrabold"
                        : "text-slate-400 border-transparent hover:text-slate-600"
                    }`}
                  >
                    Specifications
                  </button>
                  <button
                    type="button"
                    id="tab-nutrition-btn"
                    onClick={() => setActiveDetailTab("nutrition")}
                    className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                      activeDetailTab === "nutrition"
                        ? "text-amber-700 border-amber-600 font-extrabold"
                        : "text-slate-400 border-transparent hover:text-slate-600"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    Nutritional Facts
                  </button>
                </div>
              ) : (
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
                  Guaranteed Specifications
                </h4>
              )}

              {/* Tab Contents */}
              {(!product.nutrition || activeDetailTab === "specs") ? (
                <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-slate-600">
                    {product.specs ? (
                      Object.entries(product.specs).map(([key, val]) => (
                        <div key={key} className="flex justify-between border-b border-slate-200/50 pb-1">
                          <span className="text-slate-400 font-sans">{key}</span>
                          <span className="text-slate-700 text-right font-semibold">{val}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex justify-between border-b border-slate-200/50 pb-1">
                          <span className="text-slate-400">Purity</span>
                          <span className="text-slate-700 font-semibold">100% Unadulterated</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-1">
                          <span className="text-slate-400">Milling</span>
                          <span className="text-slate-700 font-semibold">Slow Stone Chakki</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-xl p-3.5 border border-amber-100/60">
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-2 font-semibold">
                    Standard values per 100g of serving
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-2xs text-center flex flex-col justify-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Calories</span>
                      <span className="text-sm font-black text-amber-700 font-mono">{product.nutrition.calories}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-2xs text-center flex flex-col justify-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Protein</span>
                      <span className="text-sm font-black text-amber-800 font-mono">{product.nutrition.protein}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-2xs text-center flex flex-col justify-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Dietary Fiber</span>
                      <span className="text-sm font-black text-emerald-600 font-mono">{product.nutrition.fiber}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity Selector & Main Actions Block */}
            <div className="flex flex-col gap-3.5 bg-slate-50/90 border border-slate-200/70 rounded-2xl p-4">
              {!product.outOfStock && (
                <div className="w-full">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Select Weight / Quantity:
                  </span>
                  <WeightQtyEditor
                    quantity={quantity}
                    onChange={setQuantity}
                    unit={product.unit}
                  />
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center gap-2.5 w-full">
                {product.outOfStock ? (
                  <button
                    disabled
                    id="modal-add-to-cart-btn"
                    className="flex-1 bg-red-50 text-red-600 border border-red-200 font-bold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed h-12 text-xs uppercase tracking-wider"
                  >
                    <span>OUT OF STOCK</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      triggerHapticFeedback(40);
                      onAddToCart(product, quantity, e);
                      onClose();
                    }}
                    id="modal-add-to-cart-btn"
                    className="add-to-basket-btn flex-1 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black px-4 sm:px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer uppercase text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                    <span className="btn-text-label font-black">ADD TO BASKET • </span>
                    <span className="font-mono">Rs. {((product.price || 0) * quantity).toLocaleString()}</span>
                  </button>
                )}

                {/* Share Product Button */}
                <button
                  onClick={handleShareProduct}
                  id="modal-share-product-btn"
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold px-4 sm:px-5 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer h-12 shrink-0"
                  title="Share on WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================
              RECOMMENDED FOR YOU SECTION (Matching Image 1 Exactly)
              ========================================================= */}
          {recommendedProducts.length > 0 && (
            <div className="pt-5 border-t border-slate-200" id="modal-recommended-products-section">
              {/* Header with Sparkle Icon and Title */}
              <div className="flex items-center gap-2 mb-3.5">
                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0" />
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  Recommended for you
                </h3>
              </div>

              {/* 3-Card Grid matching Image 1 layout */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                {recommendedProducts.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => handleSelectRecommended(rec)}
                    className="bg-white rounded-2xl border border-slate-100 p-2.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-200 transition-all flex flex-col items-center justify-between text-center cursor-pointer group select-none"
                  >
                    {/* Flour Sack Image in Rounded Pill Stage */}
                    <div className="bg-stone-50/80 rounded-2xl p-2 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-2 border border-slate-100/80 shadow-inner group-hover:scale-105 transition-transform duration-300">
                      {rec.productImage ? (
                        <img
                          src={rec.productImage}
                          alt={rec.name}
                          className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ProductIcon
                          productId={rec.id}
                          category={rec.category}
                          size={32}
                          className="w-14 h-14 object-contain"
                        />
                      )}
                    </div>

                    {/* Product Name in Bold Dark Caps */}
                    <h4
                      className="font-black text-[11px] sm:text-xs text-slate-800 tracking-tight uppercase line-clamp-1 w-full mb-2 group-hover:text-amber-700 transition-colors"
                      title={rec.name}
                    >
                      {rec.name}
                    </h4>

                    {/* Action Button: Orange 'Add to Cart' or Pink 'OUT OF STOCK' */}
                    {rec.outOfStock ? (
                      <button
                        type="button"
                        disabled
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-2 bg-rose-50 text-red-500 border border-rose-100 font-bold text-[10px] sm:text-xs uppercase rounded-xl tracking-wider text-center cursor-not-allowed"
                      >
                        OUT OF STOCK
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHapticFeedback(30);
                          onAddToCart(rec, 1, e);
                        }}
                        className="w-full py-2 sm:py-2.5 px-2 bg-[#f59e0b] hover:bg-[#d97706] active:scale-95 text-slate-950 font-black text-[10px] sm:text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                      >
                        <ShoppingCart size={13} className="text-slate-950 stroke-[2.5] shrink-0" />
                        <span>Add to Cart</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
