import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Navigation,
  ShieldCheck,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  FileText
} from "lucide-react";
import { DELIVERY_LOCATIONS, CHARGE_PER_KM } from "../deliveryData";
import { useToast } from "./ToastContainer";
import { triggerHapticFeedback } from "../lib/utils";

interface CheckoutMultiStepFormProps {
  checkoutFormData: {
    name: string;
    phone: string;
    address: string;
    area: string;
    neighborhood: string;
    paymentMethod: string;
    sendingBank: string;
    transactionId: string;
    deliveryDate: string;
    deliverySlot: string;
  };
  setCheckoutFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      phone: string;
      address: string;
      area: string;
      neighborhood: string;
      paymentMethod: string;
      sendingBank: string;
      transactionId: string;
      deliveryDate: string;
      deliverySlot: string;
    }>
  >;
  checkoutError: string;
  setCheckoutError: (err: string) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  selectedSubLocation: string;
  setSelectedSubLocation: (subLoc: string) => void;
  customDistanceKm: number;
  setCustomDistanceKm: (dist: number) => void;
  isDetectingLocation: boolean;
  handleDetectLocation: () => void;
  handleCheckoutSubmit: (e: React.FormEvent) => void;
  onReturnToCart: () => void;
  upcomingDays: { value: string; label: string; formattedDate: string }[];
  deliverySlots?: { id: string; name: string; time: string; icon: string }[];
  cartItemsCount: number;
}

const STEPS = [
  { id: 1, title: "Customer Info", subtitle: "Name & Phone", icon: User },
  { id: 2, title: "Delivery Address", subtitle: "Location & Address", icon: MapPin },
  { id: 3, title: "Schedule & Pay", subtitle: "Date & Method", icon: Calendar }
];

export function CheckoutMultiStepForm({
  checkoutFormData,
  setCheckoutFormData,
  checkoutError,
  setCheckoutError,
  selectedArea,
  setSelectedArea,
  selectedSubLocation,
  setSelectedSubLocation,
  customDistanceKm,
  setCustomDistanceKm,
  isDetectingLocation,
  handleDetectLocation,
  handleCheckoutSubmit,
  onReturnToCart,
  upcomingDays,
  deliverySlots,
  cartItemsCount
}: CheckoutMultiStepFormProps) {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const validateStep = (step: number): boolean => {
    setCheckoutError("");
    const errors: { [key: string]: string } = {};

    if (step === 1) {
      if (!checkoutFormData.name.trim()) {
        errors.name = "Customer full name is required.";
      }
      const cleanPhone = checkoutFormData.phone.trim();
      if (!cleanPhone) {
        errors.phone = "Phone number is required.";
      } else if (cleanPhone.length < 10) {
        errors.phone = "Enter a valid local phone number (at least 10 digits).";
      }
    } else if (step === 2) {
      if (!checkoutFormData.area) {
        errors.area = "Please select a delivery city.";
      } else {
        const cleanArea = checkoutFormData.area.toLowerCase().trim();
        const isRawalpindi = cleanArea.includes("rawalpindi") || cleanArea === "pindi" || cleanArea.includes("rwp");
        const isIslamabad = cleanArea.includes("islamabad") || cleanArea === "isb" || cleanArea.includes("islo");
        if (!isRawalpindi && !isIslamabad) {
          errors.area = "Delivery is currently available only in Rawalpindi and Islamabad.";
        }
      }

      if (!checkoutFormData.address.trim()) {
        errors.address = "Full home address is required.";
      } else if (checkoutFormData.address.trim().length < 5) {
        errors.address = "Please enter a detailed address (street, house #, sector).";
      }

      if (!checkoutFormData.neighborhood?.trim()) {
        errors.neighborhood = "Please enter the area or neighborhood for delivery.";
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstErr = Object.values(errors)[0];
      setCheckoutError(firstErr);
      toast.error(firstErr);
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      triggerHapticFeedback(25);
      setDirection(1);
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    triggerHapticFeedback(15);
    setCheckoutError("");
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleJumpToStep = (targetStep: number) => {
    if (targetStep < currentStep) {
      triggerHapticFeedback(15);
      setCheckoutError("");
      setDirection(-1);
      setCurrentStep(targetStep);
    } else if (targetStep > currentStep) {
      // Validate current step before advancing
      if (validateStep(currentStep)) {
        triggerHapticFeedback(25);
        setDirection(1);
        setCurrentStep(targetStep);
      }
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(1) && validateStep(2)) {
      triggerHapticFeedback([40, 60, 50]);
      handleCheckoutSubmit(e);
    }
  };

  // Motion slide variants for step transitions
  const slideVariants: any = {
    initial: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
      scale: 0.98,
      filter: "blur(2px)",
    }),
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        x: { type: "spring", stiffness: 320, damping: 28, mass: 0.8 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
        filter: { duration: 0.2 },
        staggerChildren: 0.06,
        delayChildren: 0.04
      }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 60 : -60,
      opacity: 0,
      scale: 0.98,
      filter: "blur(2px)",
      transition: {
        x: { duration: 0.18, ease: "easeIn" },
        opacity: { duration: 0.15 },
        scale: { duration: 0.15 },
        filter: { duration: 0.15 }
      }
    })
  };

  const fieldItemVariants: any = {
    initial: (dir: number) => ({
      x: dir >= 0 ? 24 : -24,
      opacity: 0,
      y: 10
    }),
    animate: {
      x: 0,
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 340,
        damping: 26
      }
    }
  };

  const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-lg space-y-6 overflow-hidden">
      
      {/* 1. MULTI-STEP PROGRESS BAR HEADER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-800">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Checkout Step {currentStep} of {STEPS.length}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-mono text-xs border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>

        {/* Progress Bar Line Track */}
        <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <motion.div
            className="h-full bg-gradient-to-r from-[#3b4414] via-[#5c6d20] to-amber-500 rounded-full shadow-sm relative will-change-transform"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 25 }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/40 blur-[2px] rounded-full animate-pulse" />
          </motion.div>
        </div>

        {/* Step Nodes Badges */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {STEPS.map((step) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleJumpToStep(step.id)}
                className={`flex flex-col sm:flex-row items-center sm:items-start gap-2 p-2.5 rounded-xl border text-center sm:text-left transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? "bg-[#3b4414]/5 border-[#3b4414] text-[#3b4414] shadow-xs ring-2 ring-[#3b4414]/20"
                    : isCompleted
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 hover:bg-emerald-100/80"
                    : "bg-slate-50/60 border-slate-200 text-slate-400 hover:border-slate-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeStepIndicatorHalo"
                    className="absolute inset-0 bg-[#3b4414]/5 rounded-xl border-2 border-[#3b4414] pointer-events-none"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                {/* Step Circle */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black transition-all relative z-10 ${
                    isCompleted
                      ? "bg-emerald-600 text-white shadow-sm"
                      : isActive
                      ? "bg-[#3b4414] text-white shadow-md ring-2 ring-[#3b4414]/30 scale-105"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                {/* Step Label */}
                <div className="hidden sm:block min-w-0 relative z-10">
                  <span
                    className={`block text-xs font-bold leading-snug truncate ${
                      isActive
                        ? "text-[#3b4414]"
                        : isCompleted
                        ? "text-emerald-900"
                        : "text-slate-500"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {step.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {checkoutError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{checkoutError}</span>
        </motion.div>
      )}

      {/* 2. ANIMATED MULTI-STEP FORM BODY */}
      <form onSubmit={handleSubmitForm} className="relative min-h-[300px]">
        <AnimatePresence mode="wait" custom={direction}>
          {/* STEP 1: CONTACT INFORMATION */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <motion.div custom={direction} variants={fieldItemVariants} className="pb-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#3b4414]" />
                    <span>Step 1: Customer Contact Information</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    We will send order confirmation &amp; milling updates to this phone number.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  1 of 3
                </span>
              </motion.div>

              {/* Customer Full Name */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                <label
                  htmlFor="chk-form-name"
                  className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                >
                  Customer Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="chk-form-name"
                    type="text"
                    required
                    value={checkoutFormData.name}
                    onChange={(e) => {
                      setFieldErrors((prev) => ({ ...prev, name: "" }));
                      setCheckoutFormData((prev) => ({ ...prev, name: e.target.value }));
                    }}
                    placeholder="e.g. Brigadier Raja Jahangir"
                    className={`w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl outline-none font-medium text-slate-800 transition-all ${
                      fieldErrors.name
                        ? "border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10"
                    }`}
                  />
                </div>
                {fieldErrors.name && (
                  <span className="text-[10.5px] text-red-500 font-medium block">
                    {fieldErrors.name}
                  </span>
                )}
              </motion.div>

              {/* Phone Number */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                <label
                  htmlFor="chk-form-phone"
                  className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                >
                  Local Phone Number (WhatsApp / Mobile) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="chk-form-phone"
                    type="tel"
                    required
                    value={checkoutFormData.phone}
                    onChange={(e) => {
                      setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      setCheckoutFormData((prev) => ({
                        ...prev,
                        phone: e.target.value.replace(/\D/g, "")
                      }));
                    }}
                    placeholder="e.g. 03215010846"
                    className={`w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl outline-none font-medium text-slate-800 transition-all ${
                      fieldErrors.phone
                        ? "border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10"
                    }`}
                  />
                </div>
                {fieldErrors.phone ? (
                  <span className="text-[10.5px] text-red-500 font-medium block">
                    {fieldErrors.phone}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 block">
                    Enter local Pakistani mobile number (e.g. 03001234567).
                  </span>
                )}
              </motion.div>

              {/* Step 1 Informational Note */}
              <motion.div custom={direction} variants={fieldItemVariants} className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl flex items-start gap-2.5 text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold block">Privacy &amp; Direct Milling Dispatch</span>
                  Your details are protected. Our rider will contact this phone number directly upon arrival.
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* STEP 2: DELIVERY LOCATION & ADDRESS */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <motion.div custom={direction} variants={fieldItemVariants} className="pb-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#3b4414]" />
                    <span>Step 2: Delivery Coordinates &amp; Address</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sourced directly from our Chakki store in High Court Rd / Gulrez Rawalpindi.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  2 of 3
                </span>
              </motion.div>

              {/* Contact Summary Badge */}
              <motion.div custom={direction} variants={fieldItemVariants} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#3b4414]" />
                  <span className="font-bold">{checkoutFormData.name}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-mono text-slate-600">{checkoutFormData.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleJumpToStep(1)}
                  className="text-[11px] text-[#3b4414] hover:underline font-bold"
                >
                  Edit Contact
                </button>
              </motion.div>

              {/* Delivery Area City Picker */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="chk-form-area"
                    className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                  >
                    Delivery Area City <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Locating...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>Detect GPS Location</span>
                      </>
                    )}
                  </button>
                </div>

                <select
                  id="chk-form-area"
                  value={checkoutFormData.area}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCheckoutFormData((prev) => ({ ...prev, area: val }));
                    setSelectedArea(val);
                    if (val === "Rawalpindi") {
                      setSelectedSubLocation("Gulrez Housing Scheme (Phase 1-5)");
                      setCustomDistanceKm(1.5);
                    } else if (val === "Islamabad") {
                      setSelectedSubLocation("Sector I-8 / I-9");
                      setCustomDistanceKm(12);
                    }
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-[#3b4414] focus:bg-white rounded-xl outline-none cursor-pointer text-slate-800 font-medium h-10"
                >
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Lahore">Lahore (No Delivery available)</option>
                  <option value="Karachi">Karachi (No Delivery available)</option>
                </select>
              </motion.div>

              {/* Sub-location Selector */}
              {checkoutFormData.area &&
                (checkoutFormData.area === "Islamabad" || checkoutFormData.area === "Rawalpindi") && (
                  <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                    <label
                      htmlFor="chk-form-sublocation"
                      className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                    >
                      Area / Sector (Rs. {CHARGE_PER_KM} / km from Store)
                    </label>
                    <select
                      id="chk-form-sublocation"
                      value={selectedSubLocation}
                      onChange={(e) => setSelectedSubLocation(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 focus:border-[#3b4414] focus:bg-white rounded-xl outline-none cursor-pointer text-slate-800 font-medium h-10"
                    >
                      {DELIVERY_LOCATIONS.filter((l) => l.city === checkoutFormData.area).map((loc) => (
                        <option key={loc.name} value={loc.name}>
                          {loc.name} ({loc.distanceKm} km - Rs. {loc.distanceKm * CHARGE_PER_KM})
                        </option>
                      ))}
                      <option value="Custom">Other / Custom Distance...</option>
                    </select>
                  </motion.div>
                )}

              {/* Custom Area / Distance Input */}
              {checkoutFormData.area &&
                (checkoutFormData.area === "Islamabad" || checkoutFormData.area === "Rawalpindi") &&
                selectedSubLocation === "Custom" && (
                  <>
                    <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1 p-3 bg-blue-50/80 border border-blue-100 rounded-xl">
                      <p className="text-xs font-semibold text-blue-900 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">ℹ️</span>
                        <span>Enter your custom location details below and use the distance slider to set the delivery distance from our store.</span>
                      </p>
                    </motion.div>
                    
                    <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                      <label
                        htmlFor="chk-form-custom-area"
                        className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                      >
                        Area / Location Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="chk-form-custom-area"
                        type="text"
                        placeholder="e.g. G-7, Peshawar Road, Wah Cantonment, Officers Colony"
                        className="w-full text-xs p-2.5 bg-amber-50/40 border border-amber-300/50 rounded-xl outline-none font-medium text-slate-800 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Enter the area or location name for accurate delivery.
                      </span>
                    </motion.div>
                    
                    <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1.5 p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Distance from Store (High Court Rd, Gulrez):</span>
                        <span className="text-[#3b4414] font-bold text-sm">{customDistanceKm} km</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="45"
                        step="0.5"
                        value={customDistanceKm}
                        onChange={(e) => setCustomDistanceKm(parseFloat(e.target.value))}
                        className="w-full accent-[#3b4414] cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono font-semibold">
                        <span>1 km (Rs. 50)</span>
                        <span>45 km (Rs. 2,250)</span>
                      </div>
                      <div className="mt-3 pt-3 border-t-2 border-amber-200/50">
                        <div className="flex justify-between items-center bg-white/60 p-2 rounded-lg">
                          <span className="text-xs font-bold text-amber-900">💳 Estimated Delivery Charge:</span>
                          <span className="text-lg font-black text-amber-700">Rs. {Math.round(customDistanceKm * CHARGE_PER_KM).toLocaleString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}

              {/* Area / Neighborhood */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                <label
                  htmlFor="chk-form-neighborhood"
                  className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                >
                  Area / Neighborhood <span className="text-red-500">*</span>
                </label>
                <input
                  id="chk-form-neighborhood"
                  type="text"
                  value={checkoutFormData.neighborhood || ""}
                  onChange={(e) => {
                    setFieldErrors((prev) => ({ ...prev, neighborhood: "" }));
                    setCheckoutFormData((prev) => ({ ...prev, neighborhood: e.target.value }));
                  }}
                  placeholder="e.g. Sector F-11/2, Gulrez, Bahria Phase 7"
                  className={`w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none font-medium text-slate-800 transition-all ${
                    fieldErrors.neighborhood
                      ? "border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10"
                  }`}
                />
                {fieldErrors.neighborhood ? (
                  <span className="text-[10.5px] text-red-500 font-medium block">
                    {fieldErrors.neighborhood}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 block">
                    Enter the area or neighborhood clearly so delivery charges can be calculated precisely.
                  </span>
                )}
              </motion.div>

              {/* Full Address */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1">
                <label
                  htmlFor="chk-form-address"
                  className="text-xs font-bold text-slate-600 uppercase tracking-wide block"
                >
                  Full Sourced Home Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="chk-form-address"
                  required
                  rows={3}
                  value={checkoutFormData.address}
                  onChange={(e) => {
                    setFieldErrors((prev) => ({ ...prev, address: "" }));
                    setCheckoutFormData((prev) => ({ ...prev, address: e.target.value }));
                  }}
                  placeholder="e.g. House 23-B, Street 18, Sector F-11/2 (Near Markaz), Islamabad"
                  className={`w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none font-medium text-slate-800 resize-none leading-relaxed transition-all ${
                    fieldErrors.address
                      ? "border-red-400 focus:ring-2 focus:ring-red-200"
                      : "border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10"
                  }`}
                />
                {fieldErrors.address ? (
                  <span className="text-[10.5px] text-red-500 font-medium block">
                    {fieldErrors.address}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 block">
                    Include sector tags, landmarks, house or street identifiers for smooth dispatch.
                  </span>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* STEP 3: SCHEDULE, SETTLEMENT & FINAL SUBMIT */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <motion.div custom={direction} variants={fieldItemVariants} className="pb-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#3b4414]" />
                    <span>Step 3: Preferred Schedule &amp; Settlement Method</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Select your preferred delivery date &amp; time slot.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  3 of 3
                </span>
              </motion.div>

              {/* Order Summary Chips */}
              <motion.div custom={direction} variants={fieldItemVariants} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-slate-800">{checkoutFormData.name} ({checkoutFormData.phone})</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-1">
                  <span className="text-slate-500 font-medium">Delivery Destination:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{checkoutFormData.area} - {selectedSubLocation}</span>
                </div>
              </motion.div>

              {/* Delivery Schedule Picker */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Delivery Schedule Slot</span>
                </div>

                {/* Date Picker Cards */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                    Select Delivery Date
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {upcomingDays.map((day) => {
                      const isSelected = checkoutFormData.deliveryDate === day.value;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            setCheckoutFormData((prev) => ({ ...prev, deliveryDate: day.value }))
                          }
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#3b4414] border-[#3b4414] text-white shadow-xs"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${
                              isSelected ? "text-amber-300" : "text-slate-400"
                            }`}
                          >
                            {day.label}
                          </span>
                          <span className="text-xs font-extrabold mt-0.5">
                            {day.formattedDate}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs font-medium text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Fresh Express Milling & Same-Day Dispatch (Delivered fresh within 2 to 4 hours)</span>
                </div>
              </motion.div>

              {/* Delivery Notes & Rider Tip Options */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <label htmlFor="chk-form-notes" className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Special Delivery Instructions / Gate Notes
                  </label>
                  <input
                    id="chk-form-notes"
                    type="text"
                    placeholder="e.g. 'Leave with security guard', 'Ring doorbell twice'"
                    value={(checkoutFormData as any).notes || ""}
                    onChange={(e) =>
                      setCheckoutFormData((prev: any) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-200/60">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Tip for Express Delivery Rider (Optional)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 50, 100, 200].map((tipVal) => {
                      const currentTip = (checkoutFormData as any).riderTip || 0;
                      const isSel = currentTip === tipVal;
                      return (
                        <button
                          key={tipVal}
                          type="button"
                          onClick={() =>
                            setCheckoutFormData((prev: any) => ({ ...prev, riderTip: tipVal }))
                          }
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                            isSel
                              ? "bg-amber-500 border-amber-500 text-slate-950 font-black shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {tipVal === 0 ? "No Tip" : `Rs. ${tipVal}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Settlement Method (Cash on Delivery) */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                  Settlement Method
                </label>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <span className="text-sm">💵</span>
                    <span>Cash on Delivery (COD) / Direct Mobile Transfer</span>
                  </div>
                  <p className="text-[10.5px] text-emerald-800 leading-relaxed font-medium">
                    Pay easily in cash, card, or via JazzCash/Easypaisa/Bank App once your fresh flour is delivered to your doorstep.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. STEP NAVIGATION CONTROLS & ACTION BUTTONS */}
        <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-100">
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={onReturnToCart}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase text-center h-11"
            >
              Return to Cart
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase text-center h-11 flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs py-3 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer uppercase tracking-wider text-center h-11 flex items-center justify-center gap-1.5"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              id="proc-checkout-btn"
              className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs py-3 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider text-center h-11 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>Confirm &amp; Review Order</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
