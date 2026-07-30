import React, { useState, useEffect, useRef } from "react";
import { Product, Review } from "../types";
import { Star, X, Plus, Minus, ShieldCheck, ShoppingCart, Sparkles, Share2, Check } from "lucide-react";
import { AnimatedScore } from "./AnimatedComponents";
import { motion } from "motion/react";
import { ProductIcon } from "./ProductIcon";
import { WeightQtyEditor, displayFormattedQty } from "./WeightQtyEditor";
import { ProductCard } from "./ProductCard";
import { ProductViewer360 } from "./ProductViewer360";
import { triggerHapticFeedback } from "../lib/utils";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ProductDetailsModalProps {
  product: Product;
  allProducts: Product[];
  reviews: Review[];
  onClose: () => void;
  onAddToCart: (p: Product, q: number) => void;
  onSelectProduct: (p: Product) => void;
}

export function ProductDetailsModal({
  product,
  allProducts,
  reviews,
  onClose,
  onAddToCart,
  onSelectProduct,
}: ProductDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [activeDetailTab, setActiveDetailTab] = useState<"specs" | "nutrition">("specs");

  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add overflow-hidden to body to lock background scroll and pause heavy background canvas loops
    document.body.classList.add("overflow-hidden");

    // Trigger falling grains from top when modal opens
    window.dispatchEvent(new CustomEvent("grain-rain", { detail: { type: "modal-open" } }));

    // GSAP Entrance & ScrollTrigger Setup
    const backdrop = backdropRef.current;
    const modal = modalRef.current;
    const img = imageRef.current;
    const scrollContainer = scrollContentRef.current;

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
        { scale: 0.9, opacity: 0, filter: "blur(10px)" },
        { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power3.out" }
      );
    }

    const ctx = gsap.context(() => {
      if (img) {
        const scrollerEl = scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight
          ? scrollContainer
          : (backdrop && backdrop.scrollHeight > backdrop.clientHeight ? backdrop : window);

        gsap.to(img, {
          scale: 1.12,
          y: 20,
          ease: "none",
          scrollTrigger: {
            trigger: scrollContainer || modal,
            scroller: scrollerEl,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
          },
        });
      }
    }, modal || undefined);

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 120);

    return () => {
      document.body.classList.remove("overflow-hidden");
      clearTimeout(timer);
      ctx.revert();
    };
  }, [product.id]);

  const increment = () => setQuantity((q) => Math.min(q + 50, 100)); // limit bulk to 100 items per order
  const decrement = () => setQuantity((q) => Math.max(q - 1, 1));

  const handleShareProduct = () => {
    const text = `Check out this premium *${product.name}* at Babay Dee Chakki!\nPrice: Rs. ${product.price} per ${product.unit}\n\n100% Traditional, Stone-Ground & Pure. Order Yours Now!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  // Find related products in the same category (excluding current)
  const relatedProducts = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  // Filter reviews matching this specific product category (or general reviews if none)
  const productReviews = reviews.filter(
    (r) => 
      r.review.toLowerCase().includes(product.name.replace(/ \(.*\)/, "").toLowerCase()) ||
      r.review.toLowerCase().includes(product.category.toLowerCase())
  );

  // Cross-sell recommended products in the same category
  const recommendedProducts = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  return (
    <div
      ref={backdropRef}
      id="product-details-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        id="product-details-container"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col md:flex-row"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          id="close-details-btn"
          className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-700 w-11 h-11 flex items-center justify-center rounded-full cursor-pointer transition-colors z-10 shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Product Image & 360 Viewer Stage (approx 45%) */}
        <div className="md:w-[45%] bg-slate-50 dark:bg-slate-800/40 p-4 md:p-6 flex flex-col justify-center border-r border-slate-100 dark:border-slate-800 w-full">
          <div ref={imageRef} className="w-full">
            <ProductViewer360 product={product} />
          </div>
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Guaranteed Pure & Stone-Ground</span>
            </div>
          </div>
        </div>

        {/* Right: Detailed content (approx 55%) scrollable */}
        <div
          ref={scrollContentRef}
          className="md:w-[55%] p-6 md:p-8 overflow-y-auto max-h-[60vh] md:max-h-[90vh]"
        >
          {/* Category & Badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
              {product.category.replace("_", " ")}
            </span>
            {product.badge && (
              <span className="text-[11px] font-sans font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md">
                {product.badge}
              </span>
            )}
          </div>

          {/* Title & Price Header (Premium Layout) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
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
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl px-4 py-2.5 shrink-0 max-sm:w-full text-center">
              <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block">Price per {product.unit || "Kg"}</span>
              <div className="flex items-baseline gap-1 justify-center">
                <span className="text-xl sm:text-2xl font-black text-amber-700">
                  Rs. {product.priceRange || (product.price ? product.price.toLocaleString() : "170")}
                </span>
                <span className="text-xs text-amber-800 font-bold">/ {product.unit || "Kg"}</span>
              </div>
            </div>
          </div>

          {/* Product Description */}
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6 font-medium">
            {product.desc}
          </p>

          {/* Specifications & Nutritional Facts Tab Selection */}
          <div className="mb-6">
            {product.nutrition ? (
              <div className="flex border-b border-slate-200 mb-4 gap-4">
                <button
                  type="button"
                  id="tab-specs-btn"
                  onClick={() => setActiveDetailTab("specs")}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    activeDetailTab === "specs"
                      ? "text-blue-600 border-blue-600 font-extrabold"
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
                      ? "text-blue-600 border-blue-600 font-extrabold"
                      : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  Nutritional Facts
                </button>
              </div>
            ) : (
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2.5">
                Guaranteed Specifications
              </h4>
            )}

            {/* Tab Contents */}
            {(!product.nutrition || activeDetailTab === "specs") ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-slate-600">
                  {product.specs ? (
                    Object.entries(product.specs).map(([key, val]) => (
                      <div key={key} className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-slate-400 font-sans">{key}</span>
                        <span className="text-slate-700 text-right">{val}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-slate-400">Purity</span>
                        <span className="text-slate-700">100% Unadulterated</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-slate-400">Grade</span>
                        <span className="text-slate-700">A-Grade Premium</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl p-4 border border-blue-100/50">
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-3 font-semibold">
                  Standard values per 100g of serving
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {/* Calories card */}
                  <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-blue-100 shadow-2xs text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Calories</span>
                    <span className="text-sm font-black text-blue-600 font-mono">{product.nutrition.calories}</span>
                  </div>
                  {/* Protein card */}
                  <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-blue-100 shadow-2xs text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Protein</span>
                    <span className="text-sm font-black text-indigo-600 font-mono">{product.nutrition.protein}</span>
                  </div>
                  {/* Fiber card */}
                  <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-blue-100 shadow-2xs text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dietary Fiber</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">{product.nutrition.fiber}</span>
                  </div>
                </div>
                <div className="mt-3.5 flex items-start gap-1.5 text-[10px] text-slate-500 bg-white/50 px-2.5 py-2 rounded-lg border border-slate-100">
                  <span className="font-extrabold text-blue-600 shrink-0">💡 Note:</span>
                  <span>Milled under slow stone pressure at low temperatures to fully preserve natural grain germ nutrients and dietary fibers.</span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Selector & Main Actions Block */}
          <div className="flex flex-col gap-4 mb-8 bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
            {/* Quantity Selector Section */}
            {!product.outOfStock && (
              <div className="w-full">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Weight / Quantity:
                </span>
                <WeightQtyEditor
                  quantity={quantity}
                  onChange={setQuantity}
                  unit={product.unit}
                />
              </div>
            )}

            {/* Action Buttons Row (Placed directly UNDER the Quantity Selector) */}
            <div className="flex items-center gap-3 w-full pt-1">
              {product.outOfStock ? (
                <button
                  disabled
                  id="modal-add-to-cart-btn"
                  className="flex-1 bg-red-50 text-red-600 border border-red-200 font-bold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed h-12"
                >
                  <span>OUT OF STOCK</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    triggerHapticFeedback(40);
                    onAddToCart(product, quantity);
                    onClose();
                  }}
                  id="modal-add-to-cart-btn"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer h-12 sm:h-13 uppercase text-xs sm:text-sm tracking-wider"
                >
                  <ShoppingCart className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                  <span>ADD TO BASKET • Rs. {(product.price * quantity).toLocaleString()}</span>
                </button>
              )}

              {/* Share Product Button */}
              <button
                onClick={handleShareProduct}
                id="modal-share-product-btn"
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold px-4 sm:px-5 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer h-12 sm:h-13 shrink-0"
                title="Share on WhatsApp"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mb-8 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3.5">Related Sourced Products</h3>
              <div className="grid grid-cols-3 gap-2.5">
                {relatedProducts.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => {
                      onSelectProduct(rel);
                      setQuantity(1);
                      setActiveDetailTab("specs");
                    }}
                    className="p-2 border border-slate-100 hover:border-blue-200 rounded-lg cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all text-center flex flex-col items-center"
                  >
                    <ProductIcon
                      category={rel.category}
                      productId={rel.id}
                      productImage={rel.productImage}
                      size={24}
                      className="w-12 h-12 mb-1.5"
                    />
                    <h5 className="text-[11px] font-bold text-slate-700 truncate w-full">
                      {rel.name}
                    </h5>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section for reviews matching this product */}
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center gap-1.5">
              <span>Customer Feedback</span>
              <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 5.0 Rating
              </span>
            </h3>

            {productReviews.length > 0 ? (
              <div className="space-y-3">
                {productReviews.map((rev) => (
                  <div key={rev.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-700">
                        {rev.name} <span className="font-normal text-slate-400">({rev.city})</span>
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-500 leading-normal">{rev.review}</p>
                    <span className="text-[9px] text-slate-400 mt-1 block text-right">{rev.date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-400 text-center font-medium">
                No specific reviews for this item yet. Tap below in Reviews section to submit the very first feedback!
              </div>
            )}
          </div>

          {/* Recommended for you Section */}
          {recommendedProducts.length > 0 && (
            <div className="pt-6 border-t border-slate-100 mt-6" id="recommended-for-you-section">
              <h3 className="text-sm font-bold text-slate-800 mb-3.5 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                <span>Recommended for you</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recommendedProducts.map((rec) => (
                  <div
                    key={rec.id}
                    id={`recommended-product-${rec.id}`}
                    onClick={() => {
                      onSelectProduct(rec);
                      setQuantity(1);
                      setActiveDetailTab("specs");
                    }}
                    className="p-3 border border-slate-100 hover:border-amber-200 hover:shadow-sm rounded-xl bg-slate-50/40 hover:bg-white transition-all cursor-pointer flex flex-col justify-between text-center"
                  >
                    <div>
                      <div className="flex justify-center mb-2">
                        <ProductIcon
                          category={rec.category}
                          productId={rec.id}
                          productImage={rec.productImage}
                          size={32}
                          className="w-14 h-14"
                        />
                      </div>
                      <h4 className="text-xs font-bold text-slate-700 line-clamp-1 truncate w-full" title={rec.name}>
                        {rec.name}
                      </h4>
                      <div className="h-2" />
                    </div>

                    {rec.outOfStock ? (
                      <button
                        disabled
                        className="w-full text-[9px] font-bold py-1.5 px-2 rounded-lg bg-red-50 text-red-500 border border-red-100 cursor-not-allowed uppercase"
                      >
                        Out of Stock
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart(rec, 1);
                        }}
                        className="w-full text-[9px] font-bold py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ShoppingCart className="w-3 h-3" />
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
