import React from "react";
import { SkeletonProductCard } from "./Skeleton";

export function SkeletonLoaderScreen() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      
      {/* Top Supabase Sync Loading Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-amber-50 to-emerald-50 border border-blue-200/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/10 border border-blue-400/30 flex items-center justify-center shrink-0">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <div className="h-4 w-64 bg-slate-200/80 rounded-md mb-1.5" />
            <div className="h-3 w-48 bg-slate-200/60 rounded-md" />
          </div>
        </div>
        <div className="h-7 w-32 bg-blue-100/80 rounded-full shrink-0" />
      </div>

      {/* Hero Banner Skeleton */}
      <div className="w-full h-64 md:h-80 rounded-3xl bg-slate-200/70 p-6 md:p-10 flex flex-col justify-end space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-300/80 via-transparent to-transparent" />
        <div className="relative z-10 space-y-2 max-w-xl">
          <div className="h-4 w-28 bg-slate-300/90 rounded-md" />
          <div className="h-8 w-3/4 bg-slate-300/90 rounded-lg" />
          <div className="h-4 w-full bg-slate-300/70 rounded-md" />
          <div className="h-10 w-36 bg-slate-400/80 rounded-xl pt-2" />
        </div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="col-span-1 md:col-span-6 h-11 bg-slate-100 rounded-xl" />
        <div className="col-span-1 md:col-span-3 h-11 bg-slate-100 rounded-xl" />
        <div className="col-span-1 md:col-span-3 h-11 bg-slate-100 rounded-xl" />
      </div>

      {/* Category Pills Skeleton Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`cat-skel-${i}`}
            className="h-10 w-28 md:w-32 bg-slate-200/80 rounded-full shrink-0"
          />
        ))}
      </div>

      {/* Product Cards Grid Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
          <div className="h-4 w-24 bg-slate-100 rounded-md" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonProductCard key={`page-skeleton-${i}`} />
          ))}
        </div>
      </div>

    </div>
  );
}
