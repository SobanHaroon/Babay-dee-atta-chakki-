import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, XCircle, Wheat, X } from "lucide-react";
import { Toast, ToastType } from "../types";

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  wheat: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    toast(message, "success", duration);
  }, [toast]);

  const error = useCallback((message: string, duration?: number) => {
    toast(message, "error", duration);
  }, [toast]);

  const warning = useCallback((message: string, duration?: number) => {
    toast(message, "warning", duration);
  }, [toast]);

  const info = useCallback((message: string, duration?: number) => {
    toast(message, "info", duration);
  }, [toast]);

  const wheat = useCallback((message: string, duration?: number) => {
    toast(message, "wheat", duration);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, wheat }}>
      {children}
      {/* Toast Portal Container */}
      <div className="fixed bottom-6 right-6 z-100 flex flex-col gap-3 max-w-md w-[calc(100%-3rem)] pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            // Pick color styles and icons based on ToastType
            let icon = <Info className="w-5 h-5" />;
            let bgStyle = "bg-white border-slate-200 text-slate-800 shadow-xl";
            let progressColor = "bg-slate-400";
            let iconColor = "text-blue-500";

            switch (t.type) {
              case "success":
                icon = <CheckCircle2 className="w-5 h-5" />;
                bgStyle = "bg-emerald-50 border-emerald-200 text-emerald-950 shadow-emerald-100/40 shadow-lg";
                progressColor = "bg-emerald-500";
                iconColor = "text-emerald-600";
                break;
              case "error":
                icon = <XCircle className="w-5 h-5" />;
                bgStyle = "bg-rose-50 border-rose-200 text-rose-950 shadow-rose-100/40 shadow-lg";
                progressColor = "bg-rose-500";
                iconColor = "text-rose-600";
                break;
              case "warning":
                icon = <AlertTriangle className="w-5 h-5" />;
                bgStyle = "bg-amber-50 border-amber-200 text-amber-950 shadow-amber-100/40 shadow-lg";
                progressColor = "bg-amber-500";
                iconColor = "text-amber-600";
                break;
              case "wheat":
                icon = <Wheat className="w-5 h-5" />;
                bgStyle = "bg-[#3b4414] border-[#3b4414]/20 text-stone-50 shadow-amber-950/20 shadow-xl";
                progressColor = "bg-amber-400";
                iconColor = "text-amber-400";
                break;
              case "info":
              default:
                icon = <Info className="w-5 h-5" />;
                bgStyle = "bg-blue-50 border-blue-200 text-blue-950 shadow-blue-100/40 shadow-lg";
                progressColor = "bg-blue-500";
                iconColor = "text-blue-600";
                break;
            }

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3.5 p-4 rounded-2xl border ${bgStyle} min-w-[280px]`}
              >
                {/* Left Colored Ribbon Edge */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${progressColor}`} />

                {/* Icon wrapper */}
                <div className={`shrink-0 mt-0.5 ${iconColor}`}>
                  {icon}
                </div>

                {/* Message Body */}
                <div className="flex-1 text-sm font-semibold tracking-wide leading-snug pr-3">
                  {t.message}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 text-current opacity-40 hover:opacity-90 transition-opacity p-0.5 rounded-lg hover:bg-black/5"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Time Indicator Line Progress bar */}
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: (t.duration || 4000) / 1000, ease: "linear" }}
                  className={`absolute bottom-0 left-0 h-0.75 ${progressColor}`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
