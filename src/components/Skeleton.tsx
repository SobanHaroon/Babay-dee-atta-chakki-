import React from "react";

/**
 * SkeletonProductCard mimics the exact dimensions and layout details of ProductCard.tsx
 * to present a seamless fluid transition during network fetch states.
 */
export function SkeletonProductCard() {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-4 w-full flex flex-col justify-between animate-pulse"
      style={{ contentVisibility: "auto" }}
    >
      <div>
        {/* Image area placeholder */}
        <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center p-4 mb-3.5 overflow-hidden border border-slate-100/50 rounded-md">
          <div className="w-[40%] h-[40%] bg-slate-200/80 rounded-lg" />
        </div>

        {/* Badge & Category Indicator Placeholder */}
        <div className="h-3.5 w-1/3 bg-slate-200 rounded-sm mb-3" />

        {/* Product Name placeholder */}
        <div className="space-y-1.5 mb-3 text-left">
          <div className="h-4 w-11/12 bg-slate-200 rounded-sm" />
          <div className="h-4 w-7/12 bg-slate-200 rounded-sm" />
        </div>

        {/* Subtle separator placeholder */}
        <div className="h-px bg-slate-100 w-full mb-3" />

        {/* Product Details placeholder */}
        <div className="flex flex-col space-y-2 text-left">
          <div className="flex justify-between">
            <div className="h-3 w-1/4 bg-slate-100 rounded-sm" />
            <div className="h-3 w-1/5 bg-slate-200 rounded-sm" />
          </div>
          <div className="flex justify-between">
            <div className="h-3 w-1/4 bg-slate-100 rounded-sm" />
            <div className="h-3 w-1/4 bg-slate-200 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Button placeholder */}
      <div className="h-9 w-full bg-slate-200/80 rounded mt-4" />
    </div>
  );
}

/**
 * SkeletonReviewItem mimics the detailed columns of ReviewsSection reviews
 * to increase user attention retention while fetching new reviews.
 */
export function SkeletonReviewItem() {
  return (
    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-xs animate-pulse space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1">
          {/* Reviewer name and verified badge */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
            <div className="h-3.5 w-14 bg-blue-100/70 rounded-full" />
          </div>
          {/* City and date */}
          <div className="h-3 w-1/3 bg-slate-100 rounded-md" />
        </div>

        {/* Stars placeholder */}
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full bg-amber-100/80" />
          ))}
        </div>
      </div>

      {/* Review text paragraphs */}
      <div className="space-y-1.5 pt-1">
        <div className="h-3.5 w-full bg-slate-100 rounded-sm" />
        <div className="h-3.5 w-11/12 bg-slate-100 rounded-sm" />
        <div className="h-3.5 w-4/5 bg-slate-100 rounded-sm" />
      </div>
    </div>
  );
}
