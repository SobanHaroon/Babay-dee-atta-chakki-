import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";
import { DeliveryArea, DeliveryCity } from "../types";
import { formatRs } from "../lib/deliveryCalculation";

interface DeliveryAreaSelectorProps {
  city: DeliveryCity | "";
  query: string;
  areas: DeliveryArea[];
  selectedArea: DeliveryArea | null;
  loading: boolean;
  error?: string;
  onCityChange: (city: DeliveryCity) => void;
  onQueryChange: (query: string) => void;
  onSelect: (area: DeliveryArea) => void;
  onRetry?: () => void;
}

export function DeliveryAreaSelector({
  city,
  query,
  areas,
  selectedArea,
  loading,
  error,
  onCityChange,
  onQueryChange,
  onSelect,
  onRetry,
}: DeliveryAreaSelectorProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [areas, query, city]);

  const selectArea = (area: DeliveryArea) => {
    onSelect(area);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(areas.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && isOpen && areas[highlightedIndex]) {
      event.preventDefault();
      selectArea(areas[highlightedIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="delivery-city" className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
          Delivery City <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            id="delivery-city"
            value={city}
            onChange={(event) => onCityChange(event.target.value as DeliveryCity)}
            className="w-full h-11 appearance-none text-xs pl-9 pr-9 bg-slate-50 border border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10 rounded-xl outline-none cursor-pointer text-slate-800 font-medium"
          >
            <option value="">Select Rawalpindi or Islamabad</option>
            <option value="Rawalpindi">Rawalpindi</option>
            <option value="Islamabad">Islamabad</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="delivery-area-search" className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
          Search Delivery Area <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            id="delivery-area-search"
            role="combobox"
            aria-controls={listId}
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-activedescendant={isOpen && areas[highlightedIndex] ? `${listId}-${areas[highlightedIndex].id}` : undefined}
            value={selectedArea && !isOpen ? selectedArea.areaName : query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={!city}
            placeholder={city ? "Type Bahria, PWD, F-7..." : "Select a city first"}
            className="w-full h-11 text-xs pl-9 pr-9 bg-slate-50 border border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10 rounded-xl outline-none font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {(query || selectedArea) && (
            <button
              type="button"
              aria-label="Clear delivery area"
              onClick={() => {
                onQueryChange("");
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isOpen && city && (
          <div className="relative z-20">
            <div id={listId} role="listbox" className="absolute top-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-1">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading delivery areas...
                </div>
              ) : error ? (
                <div className="p-3 space-y-2 text-xs text-red-600">
                  <div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>
                  {onRetry && <button type="button" onClick={onRetry} className="font-bold underline">Try again</button>}
                </div>
              ) : areas.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-500">No delivery areas match your search.</div>
              ) : (
                areas.map((area, index) => (
                  <button
                    key={area.id}
                    id={`${listId}-${area.id}`}
                    type="button"
                    role="option"
                    aria-selected={selectedArea?.id === area.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectArea(area)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                      highlightedIndex === index ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold truncate">{area.areaName}</span>
                      <span className="block text-[10px] text-slate-400 truncate">{area.category || "Delivery area"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[10px] font-mono font-bold text-slate-700">{area.distanceKm} km</span>
                      <span className={`block text-[10px] font-bold ${area.available ? "text-emerald-600" : "text-red-600"}`}>
                        {area.available ? formatRs(area.deliveryCharge) : "Unavailable"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedArea && (
        <div className={`rounded-xl border p-3 ${selectedArea.available ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-start gap-2">
            {selectedArea.available ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold ${selectedArea.available ? "text-emerald-900" : "text-red-900"}`}>
                {selectedArea.available ? "Delivery area confirmed" : "Sorry, we currently do not deliver to this area."}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">{selectedArea.city} · {selectedArea.areaName}</p>
              {selectedArea.available && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-emerald-200/70 text-[10px]">
                  <div><span className="block text-slate-500">Distance</span><strong>{selectedArea.distanceKm} km</strong></div>
                  <div><span className="block text-slate-500">Rate</span><strong>Rs. {selectedArea.deliveryRatePerKm}/km</strong></div>
                  <div><span className="block text-slate-500">Delivery fee</span><strong>{formatRs(selectedArea.deliveryCharge)}</strong></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
