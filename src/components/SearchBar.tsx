import React, { useState, useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal, ArrowUp, ArrowDown, Tag, Flame, TrendingUp } from "lucide-react";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: { id: string; name: string; count?: number }[];
  totalResults: number;
  sortOption: string;
  onSortChange: (sort: string) => void;
  placeholder?: string;
  popularTags?: string[];
}

const TRENDING_KEYWORDS = ["Atta", "CHAWAL", "MIRCH", "RICE", "DAAL", "Kalonji", "Besan", "Chana Dal", "Gurr", "Chia Seeds"];

export function SearchBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  totalResults,
  sortOption,
  onSortChange,
  placeholder = "Inquire products (e.g. Chakki Atta, Basmati Kainat, Kalonji)...",
  popularTags = ["Atta", "CHAWAL", "MIRCH", "RICE", "DAAL"]
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleClear = () => {
    onSearchChange("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSelectKeyword = (keyword: string) => {
    onSearchChange(keyword);
    setShowSuggestions(false);
  };

  const filteredTrending = searchQuery.trim()
    ? TRENDING_KEYWORDS.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    : TRENDING_KEYWORDS;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 transition-all">
      {/* Primary Search Input Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        
        {/* Real-time Input Field with Trending Suggestions (6 cols on MD) */}
        <div ref={containerRef} className="col-span-1 md:col-span-6 relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center z-10">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          
          <input
            ref={inputRef}
            type="text"
            aria-label="Search catalog products"
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onClick={() => setShowSuggestions(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder={placeholder}
            className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl outline-none font-medium text-slate-800 transition-all placeholder:text-slate-400 h-11"
          />

          {searchQuery && (
            <button
              onClick={handleClear}
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors text-xs cursor-pointer z-10"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Real-time Trending Searches Dropdown Overlay */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-2.5 px-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                  <span>Trending Searches</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Click to search</span>
              </div>

              {filteredTrending.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {filteredTrending.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSelectKeyword(item)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <TrendingUp className="w-3 h-3 text-amber-500 group-hover:scale-110 transition-transform" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-2 text-center">
                  No matching trending keywords found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Dropdown (3 cols on MD) */}
        <div className="col-span-1 md:col-span-3">
          <select
            aria-label="Filter products by category"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl outline-none cursor-pointer text-slate-700 h-11 transition-all"
          >
            <option value="all">📁 All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sorting Dropdown (3 cols on MD) */}
        <div className="col-span-1 md:col-span-3 flex items-center gap-2">
          <select
            aria-label="Sort products"
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value)}
            className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl outline-none cursor-pointer text-slate-700 h-11 transition-all"
          >
            <option value="default">⇅ Sort: Default</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="alphabetic">Alphabetical: A to Z</option>
          </select>

          <div
            className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border transition-all ${
              sortOption === "price-asc" || sortOption === "alphabetic"
                ? "bg-blue-50 border-blue-200 text-blue-600"
                : sortOption === "price-desc"
                ? "bg-amber-50 border-amber-200 text-amber-600"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            {(sortOption === "price-asc" || sortOption === "alphabetic") && (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
            {sortOption === "price-desc" && (
              <ArrowDown className="w-4 h-4 stroke-[2.5]" />
            )}
            {sortOption !== "price-asc" && sortOption !== "alphabetic" && sortOption !== "price-desc" && (
              <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
            )}
          </div>
        </div>

      </div>

      {/* Live Feedback & Popular Quick Tags Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-slate-100">
        
        {/* Results count indicator */}
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {searchQuery ? (
              <>
                Matching <strong className="text-slate-800">{totalResults}</strong> items for &ldquo;
                <span className="text-blue-600 font-bold">{searchQuery}</span>&rdquo;
              </>
            ) : selectedCategory !== "all" ? (
              <>
                Category: <strong className="text-slate-800">{categories.find(c => c.id === selectedCategory)?.name || selectedCategory}</strong> ({totalResults} items)
              </>
            ) : (
              <>
                Showing <strong className="text-slate-800">{totalResults}</strong> items in catalog
              </>
            )}
          </span>
        </div>

        {/* Quick Search Tag Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Tag className="w-3 h-3" /> Quick:
          </span>
          {popularTags.map((tag) => {
            const isActive = searchQuery.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSearchChange(isActive ? "" : tag)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
