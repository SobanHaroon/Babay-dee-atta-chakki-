import React, { useState, useEffect } from "react";
import { cn, triggerHapticFeedback } from "../lib/utils";
import { Minus, Plus } from "lucide-react";

export interface WeightQtyEditorProps {
  quantity: number;
  onChange: (qty: number) => void;
  unit?: string;
  className?: string;
  variant?: "full" | "stepper";
}

export function qtyToKgGrams(qty: number, unit: string = "Kg") {
  if (!unit || !unit.toLowerCase().includes("kg")) {
    return { kg: Math.round(qty), grams: 0 };
  }
  const kg = Math.floor(qty);
  const grams = Math.round((qty - kg) * 1000);
  return { kg, grams };
}

export function kgGramsToQty(kg: number, grams: number) {
  return kg + (grams / 1000);
}

export function displayFormattedQty(qty: number, unit: string = "Kg") {
  if (!unit || !unit.toLowerCase().includes("kg")) {
    const rounded = Math.round(qty);
    return `${rounded} ${unit || "Unit"}${rounded > 1 ? "s" : ""}`;
  }
  if (qty < 1) {
    return `${Math.round(qty * 1000)}g`;
  }
  const kg = Math.floor(qty);
  const grams = Math.round((qty - kg) * 1000);
  if (grams > 0) {
    return `${kg} Kg ${grams}g`;
  }
  return `${kg} Kg`;
}

export function WeightQtyEditor({
  quantity,
  onChange,
  unit = "Kg",
  className,
  variant = "full",
}: WeightQtyEditorProps) {
  const isWeight = unit.toLowerCase().includes("kg");
  const [inputValue, setInputValue] = useState(quantity.toString());
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    setInputValue(quantity.toString());
  }, [quantity]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || parsed <= 0) {
      const fallback = isWeight ? 0.25 : 1;
      onChange(fallback);
      setInputValue(fallback.toString());
    } else {
      const rounded = isWeight ? Math.round(parsed * 1000) / 1000 : Math.round(parsed);
      const finalVal = Math.max(isWeight ? 0.05 : 1, rounded);
      onChange(finalVal);
      setInputValue(finalVal.toString());
    }
  };

  const adjustQty = (amount: number) => {
    triggerHapticFeedback(18);
    const current = quantity;
    const minVal = isWeight ? 0.1 : 1;
    const newVal = Math.max(minVal, current + amount);
    const rounded = isWeight ? Math.round(newVal * 100) / 100 : Math.round(newVal);
    onChange(rounded);
    setInputValue(rounded.toString());
  };

  const getStepSize = (dir: -1 | 1 = 1) => {
    if (!isWeight) return 1;
    if (dir === -1) {
      if (quantity <= 0.5) return 0.1;
      if (quantity <= 1) return 0.25;
      if (quantity <= 5) return 0.5;
      return 1.0;
    } else {
      if (quantity < 1) return 0.25;
      if (quantity < 5) return 0.5;
      return 1.0;
    }
  };

  const weightPresets = [
    { label: "250g", value: 0.25 },
    { label: "500g", value: 0.5 },
    { label: "1 Kg", value: 1.0 },
    { label: "2 Kg", value: 2.0 },
    { label: "5 Kg", value: 5.0 },
  ];

  const unitPresets = [
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "5", value: 5 },
    { label: "10", value: 10 },
  ];

  const presets = isWeight ? weightPresets : unitPresets;

  const isPresetSelected = (val: number) => {
    return Math.abs(quantity - val) < 0.001;
  };

  if (variant === "stepper") {
    return (
      <div className={cn("relative inline-flex flex-col gap-1 select-none", className)}>
        {/* Visual + and - Stepper Layout (No Numeric Keyboard Input) */}
        <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-xl p-1 shadow-3xs">
          <button
            type="button"
            onClick={() => adjustQty(-getStepSize(-1))}
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 transition-all cursor-pointer font-bold shrink-0 min-h-[32px] min-w-[32px]"
            title="Decrease quantity"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          {/* Visual formatted display button that toggles quick weight preset chips on click */}
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-2.5 min-w-[62px] text-center hover:bg-slate-50 py-1 rounded-md transition-colors cursor-pointer group"
            title="Click for quick weight options"
          >
            <span className="font-sans font-black text-xs text-slate-900 whitespace-nowrap block group-hover:text-amber-600">
              {displayFormattedQty(quantity, unit)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => adjustQty(getStepSize(1))}
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition-all cursor-pointer font-bold shadow-2xs shrink-0 min-h-[32px] min-w-[32px]"
            title="Increase quantity"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>

        {/* Quick Weight Presets Popover / Toggle Pills */}
        {showPresets && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-slate-900 text-white p-2 rounded-xl shadow-xl border border-slate-800 flex flex-wrap gap-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[9px] text-slate-400 font-mono uppercase font-bold w-full mb-0.5 px-1">Quick Select:</span>
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onChange(p.value);
                  setShowPresets(false);
                }}
                className={cn(
                  "px-2 py-1 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer",
                  isPresetSelected(p.value)
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 w-full select-none", className)}>
      {/* Sleek unified single text input + stepper */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => adjustQty(-getStepSize(-1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200/50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer font-bold shadow-3xs"
          title="Decrease"
        >
          <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleBlur}
            className="w-16 text-center font-mono font-black text-sm text-slate-800 bg-transparent outline-none border-none p-0 focus:ring-0 focus:outline-none"
          />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => adjustQty(getStepSize(1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200/50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer font-bold shadow-3xs"
          title="Increase"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Preset pills selection */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {presets.map((preset) => {
          const selected = isPresetSelected(preset.value);
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => {
                onChange(preset.value);
                setInputValue(preset.value.toString());
              }}
              className={cn(
                "px-2 py-0.5 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer shadow-3xs",
                selected
                  ? "bg-amber-500 border-amber-600 text-slate-950 font-black"
                  : "bg-white border-slate-200/70 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
