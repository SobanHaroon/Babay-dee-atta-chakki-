import React, { useState, useEffect, useRef } from "react";
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
  FileText,
  ShoppingBag,
  Search,
  ChevronDown,
  Store
} from "lucide-react";
import { calculateDeliveryCharge } from "../deliveryData";
import { DeliveryMapPicker } from "./DeliveryMapPicker";
import { useToast } from "./ToastContainer";
import { triggerHapticFeedback } from "../lib/utils";
import { searchGeoapifyPlaces } from "../lib/mapUtils";

interface CheckoutMultiStepFormProps {
  checkoutFormData: {
    name: string;
    phone: string;
    address: string;
    confirmCompleteAddress?: string;
    city?: string;
    area: string;
    paymentMethod: string;
    sendingBank: string;
    transactionId: string;
    deliveryDate: string;
    deliverySlot: string;
    pickupNotes?: string;
  };
  setCheckoutFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      phone: string;
      address: string;
      confirmCompleteAddress?: string;
      city?: string;
      area: string;
      paymentMethod: string;
      sendingBank: string;
      transactionId: string;
      deliveryDate: string;
      deliverySlot: string;
      pickupNotes?: string;
    }>
  >;
  fulfillmentType?: "delivery" | "pickup";
  setFulfillmentType?: (type: "delivery" | "pickup") => void;
  checkoutError: string;
  setCheckoutError: (err: string) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  selectedSubLocation: string;
  setSelectedSubLocation: (subLoc: string) => void;
  customDistanceKm: number;
  setCustomDistanceKm: (dist: number) => void;
  customerCoordinates?: { lat: number; lng: number } | null;
  setCustomerCoordinates?: (coords: { lat: number; lng: number } | null) => void;
  isDeliverable?: boolean;
  setIsDeliverable?: (deliverable: boolean) => void;
  verifiedDeliveryCharge?: number | null;
  setVerifiedDeliveryCharge?: (fee: number | null) => void;
  handleCheckoutSubmit: (e: React.FormEvent) => void;
  onReturnToCart: () => void;
  upcomingDays: { value: string; label: string; formattedDate: string }[];
  deliverySlots?: { id: string; name: string; time: string; icon: string }[];
  cartItemsCount: number;
}

export function CheckoutMultiStepForm({
  checkoutFormData,
  setCheckoutFormData,
  fulfillmentType = "delivery",
  setFulfillmentType,
  checkoutError,
  setCheckoutError,
  selectedArea,
  setSelectedArea,
  selectedSubLocation,
  setSelectedSubLocation,
  customDistanceKm,
  setCustomDistanceKm,
  customerCoordinates,
  setCustomerCoordinates,
  isDeliverable = true,
  setIsDeliverable,
  verifiedDeliveryCharge,
  setVerifiedDeliveryCharge,
  handleCheckoutSubmit,
  onReturnToCart,
  upcomingDays,
  deliverySlots,
  cartItemsCount
}: CheckoutMultiStepFormProps) {
  const toast = useToast();
  const isPickup = fulfillmentType === "pickup";

  const STEPS = [
    { id: 1, title: "Customer Info", subtitle: "Name & Contact", icon: User },
    { id: 2, title: isPickup ? "Store Pickup" : "Delivery Address", subtitle: isPickup ? "Depot Location" : "Location & Address", icon: isPickup ? Store : MapPin },
    { id: 3, title: isPickup ? "Pickup & Confirm" : "Schedule & Pay", subtitle: isPickup ? "Time & Review" : "Date & Method", icon: Calendar }
  ];

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [mapSelectedAddress, setMapSelectedAddress] = useState<string>(checkoutFormData.address || "");
  const [isSyncingMap, setIsSyncingMap] = useState<boolean>(false);
  const [addressPredictions, setAddressPredictions] = useState<
    Array<{
      placeId: string;
      mainText: string;
      secondaryText: string;
      description: string;
    }>
  >([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState<boolean>(false);
  const syncTimeoutRef = useRef<any>(null);

  // Fetch real-time Geoapify predictions for typed address
  const fetchAddressPredictions = async (inputVal: string) => {
    const trimmed = inputVal.trim();
    if (trimmed.length < 2) {
      setAddressPredictions([]);
      setShowAddressDropdown(false);
      return;
    }

    try {
      const results = await searchGeoapifyPlaces(trimmed);
      if (results && results.length > 0) {
        const mapped = results.slice(0, 5).map((p) => ({
          placeId: p.placeId,
          mainText: p.mainText,
          secondaryText: p.secondaryText,
          description: p.formatted,
          lat: p.lat,
          lng: p.lng,
          city: p.city,
          area: p.area
        }));
        setAddressPredictions(mapped as any);
        setShowAddressDropdown(true);
      } else {
        setAddressPredictions([]);
        setShowAddressDropdown(false);
      }
    } catch (err) {
      console.warn("Geoapify autocomplete error in checkout form:", err);
    }
  };

  // Handle selecting a Geoapify suggestion from the checkout address input dropdown
  const handleSelectAddressPrediction = (placeId: string, description: string, itemLat?: number, itemLng?: number, itemCity?: string, itemArea?: string) => {
    setShowAddressDropdown(false);
    setFieldErrors((prev) => ({ ...prev, address: "" }));
    setCheckoutFormData((prev) => ({
      ...prev,
      address: description,
      area: itemArea || (description.toLowerCase().includes("islamabad") ? "Islamabad" : "Rawalpindi")
    }));
    setMapSelectedAddress(description);

    if (itemLat && itemLng && setCustomerCoordinates) {
      setCustomerCoordinates({ lat: itemLat, lng: itemLng });
      if (itemCity) setSelectedArea(itemCity);
      if (itemArea) setSelectedSubLocation(itemArea);
    } else {
      forceAddressMapSync(description);
    }
  };

  // Forward geocode manually typed address to move the map pin and recalculate route
  const forceAddressMapSync = async (addressToGeocode: string) => {
    const trimmed = addressToGeocode.trim();
    if (trimmed.length < 3) return;

    setIsSyncingMap(true);
    try {
      // 1. Server geocode endpoint (uses Geoapify Geocoding API + Twin Cities spatial database)
      try {
        const srvRes = await fetch("/api/delivery/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmed })
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData.success && srvData.latitude && srvData.longitude) {
            if (setCustomerCoordinates) {
              setCustomerCoordinates({ lat: srvData.latitude, lng: srvData.longitude });
            }
            if (srvData.city) setSelectedArea(srvData.city);
            if (srvData.area) setSelectedSubLocation(srvData.area);
            setIsSyncingMap(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Server geocode sync warning:", e);
      }

      // 2. Client Geoapify search fallback
      try {
        const results = await searchGeoapifyPlaces(trimmed);
        if (results && results.length > 0) {
          const first = results[0];
          if (setCustomerCoordinates) {
            setCustomerCoordinates({ lat: first.lat, lng: first.lng });
          }
          if (first.city) setSelectedArea(first.city);
          if (first.area) setSelectedSubLocation(first.area);
          setIsSyncingMap(false);
          return;
        }
      } catch (err) {
        console.warn("Client Geoapify search sync warning:", err);
      }

      // 3. Fallback: Nominatim OpenStreetMap
      try {
        const res2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=pk&q=${encodeURIComponent(trimmed)}`
        );
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2 && data2.length > 0) {
            const lat = parseFloat(data2[0].lat);
            const lng = parseFloat(data2[0].lon);
            if (setCustomerCoordinates) {
              setCustomerCoordinates({ lat, lng });
            }
            setIsSyncingMap(false);
            return;
          }
        }
      } catch (e2) {
        console.warn("Nominatim address sync warning:", e2);
      }
    } finally {
      setIsSyncingMap(false);
    }
  };

  const triggerManualAddressMapSync = (typedAddress: string) => {
    fetchAddressPredictions(typedAddress);
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      forceAddressMapSync(typedAddress);
    }, 850);
  };

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
      if (isPickup) {
        // Automatically populate Chakki store address for store pickup
        if (!checkoutFormData.address || !checkoutFormData.address.trim()) {
          setCheckoutFormData((prev) => ({
            ...prev,
            address: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Store Pickup)",
            confirmCompleteAddress: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Store Pickup)",
            city: "Rawalpindi",
            area: "Depot Pickup"
          }));
        }
        return true;
      }

      if (isDeliverable === false) {
        errors.address = "Selected location is outside our maximum delivery radius (Max 45 km). Please choose a closer location.";
      }

      if (!checkoutFormData.address || !checkoutFormData.address.trim()) {
        errors.address = "Complete address from map is required. Please select or search your location on the map.";
      }

      if (!checkoutFormData.confirmCompleteAddress || !checkoutFormData.confirmCompleteAddress.trim()) {
        errors.confirmCompleteAddress = "Confirm Complete Address is mandatory. Please manually enter your full address (House #, Street #, Sector/Area, Landmark) to proceed.";
      } else if (checkoutFormData.confirmCompleteAddress.trim().length < 5) {
        errors.confirmCompleteAddress = "Please enter a detailed confirmed address (at least 5 characters).";
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
            className="h-full bg-gradient-to-r from-[#3b4414] via-[#5c6d20] to-amber-500 rounded-full shadow-sm relative"
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
                    <span>Step 1: Customer Contact &amp; Order Mode</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Choose between direct home delivery or self-pickup from our Chakki store.
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  1 of 3
                </span>
              </motion.div>

              {/* Fulfillment Method Selector: Home Delivery vs Store Pick Up */}
              <motion.div custom={direction} variants={fieldItemVariants} className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback(15);
                    setFulfillmentType?.("delivery");
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    !isPickup
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-amber-500/20"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Truck className={`w-4 h-4 ${!isPickup ? "text-amber-600" : "text-slate-400"}`} />
                  <span>🚚 Direct Home Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback(15);
                    setFulfillmentType?.("pickup");
                    setCheckoutFormData((prev: any) => ({
                      ...prev,
                      address: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Store Pickup)",
                      confirmCompleteAddress: "Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Store Pickup)",
                      city: "Rawalpindi",
                      area: "Depot Pickup"
                    }));
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isPickup
                      ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 ring-2 ring-emerald-500/20"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Store className={`w-4 h-4 ${isPickup ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>🏬 Store Pick Up (FREE)</span>
                </button>
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

          {/* STEP 2: DELIVERY LOCATION & ADDRESS / STORE PICKUP */}
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
                    {isPickup ? <Store className="w-4 h-4 text-emerald-700" /> : <MapPin className="w-4 h-4 text-[#3b4414]" />}
                    <span>{isPickup ? "Step 2: Store Self-Pickup Information" : "Step 2: Delivery Coordinates & Address"}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isPickup
                      ? "Collect your freshly ground flour directly from our main Chakki milling counter."
                      : "Sourced directly from our Chakki store in High Court Rd / Gulrez Rawalpindi."}
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

              {isPickup ? (
                /* STORE PICKUP DEPOT CARD */
                <motion.div custom={direction} variants={fieldItemVariants} className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 rounded-2xl border border-emerald-200/80 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-emerald-950">
                            Babay Dee Atta Chakki Depot
                          </h4>
                          <span className="text-[11px] text-emerald-800 font-semibold">
                            Central Stone-Milling &amp; Packing Store
                          </span>
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-900 font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Free (Rs. 0)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-emerald-100 space-y-2.5 text-xs text-slate-700">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-900">
                            Main Gulraiz Phase 3 / High Court Road, Rawalpindi
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Near Judicial Colony / Gulraiz Commercial Center
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Store Hours: <strong>8:00 AM – 9:00 PM</strong> (Open 7 Days a Week)</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Counter Helpline: <strong>+92 321 5010846</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Pickup Timing & Person Notes */}
                  <div className="space-y-1.5">
                    <label htmlFor="chk-form-pickup-notes" className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                      Pickup Person Name / Estimated Arrival Time (Optional)
                    </label>
                    <textarea
                      id="chk-form-pickup-notes"
                      rows={2}
                      value={checkoutFormData.pickupNotes || ""}
                      onChange={(e) => setCheckoutFormData((prev: any) => ({ ...prev, pickupNotes: e.target.value }))}
                      placeholder="e.g. 'I will arrive around 5:30 PM today', or 'My driver/brother will collect the order'"
                      className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-800 resize-none shadow-2xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-[11.5px] text-amber-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>Your order will be fresh-milled on order confirmation and kept prepared at the express collection counter.</span>
                  </div>
                </motion.div>
              ) : (
                /* DELIVERY MAP & ADDRESS SECTION */
                <>
                  {/* Delivery Location & Route Picker */}
                  <motion.div custom={direction} variants={fieldItemVariants} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#3b4414]" />
                        <span>Select Delivery Location On Map</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Search or tap on map to place pin
                      </span>
                    </div>

                    <DeliveryMapPicker
                      initialLat={customerCoordinates?.lat}
                      initialLng={customerCoordinates?.lng}
                      initialAddress={checkoutFormData.address}
                      onLocationChange={(data) => {
                        if (setCustomerCoordinates) {
                          setCustomerCoordinates({ lat: data.lat, lng: data.lng });
                        }
                        if (setIsDeliverable) {
                          setIsDeliverable(data.deliverable);
                        }
                        if (setVerifiedDeliveryCharge) {
                          setVerifiedDeliveryCharge(data.deliveryCharge);
                        }
                        if (data.distanceKm !== undefined && data.distanceKm !== null) {
                          setCustomDistanceKm(data.distanceKm);
                        }
                        if (data.address) {
                          setMapSelectedAddress(data.address);
                          setSelectedArea(data.city);
                          setSelectedSubLocation(data.area);
                          setCheckoutFormData((prev: any) => {
                            const shouldUpdateConfirm = !prev.confirmCompleteAddress || 
                              prev.confirmCompleteAddress.startsWith("Pinned Location") || 
                              prev.confirmCompleteAddress.startsWith("Location (") || 
                              prev.confirmCompleteAddress.startsWith("Delivery Pin");
                            return {
                              ...prev,
                              address: data.address,
                              confirmCompleteAddress: shouldUpdateConfirm ? data.address : prev.confirmCompleteAddress,
                              city: data.city || prev.city || "Rawalpindi",
                              area: data.area || prev.area || "Gulraiz Phase 3"
                            };
                          });
                        }
                        if (fieldErrors.address && data.deliverable) {
                          setFieldErrors((prev) => ({ ...prev, address: "", confirmCompleteAddress: "" }));
                        }
                      }}
                    />
                  </motion.div>

                  {/* Verified Map Location, City & Area / Sector Display Card */}
                  <motion.div
                    custom={direction}
                    variants={fieldItemVariants}
                    className="p-3.5 bg-gradient-to-r from-amber-50/90 via-slate-50 to-emerald-50/60 border border-amber-200/80 rounded-xl space-y-2 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Map Verified City &amp; Area / Sector</span>
                      </span>
                      {customerCoordinates && (
                        <span className="font-mono text-[10px] text-slate-600 bg-white/90 px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                          {customerCoordinates.lat.toFixed(5)}, {customerCoordinates.lng.toFixed(5)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                      <div className="bg-white/80 p-2 rounded-lg border border-slate-100 space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">City</span>
                        <span className="text-xs font-black text-slate-850 block truncate">
                          {checkoutFormData.city || selectedArea || "Rawalpindi"}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-slate-100 space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Area / Sector</span>
                        <span className="text-xs font-black text-amber-900 block truncate">
                          {checkoutFormData.area || selectedSubLocation || "Gulraiz Phase 3"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] pt-1 text-slate-600 font-medium">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Road Distance: <strong className="text-slate-850 font-mono">{customDistanceKm ? Number(customDistanceKm).toFixed(1) : "5.0"} km</strong></span>
                      </span>
                      <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        Delivery Fee: Rs. {verifiedDeliveryCharge !== null && verifiedDeliveryCharge !== undefined ? verifiedDeliveryCharge : calculateDeliveryCharge(customDistanceKm || 5)}
                      </span>
                    </div>
                  </motion.div>

              {/* INPUT FIELD 1: Complete Address (Auto-Filled from Map Location Pin) */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="chk-form-complete-address"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#3b4414]" />
                    <span>Complete Address</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                      Auto-Filled from Map Pin
                    </span>
                  </label>
                  {isSyncingMap && (
                    <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                      Updating map pin...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    id="chk-form-complete-address"
                    name="completeAddress"
                    rows={2}
                    value={checkoutFormData.address}
                    onChange={(e) => {
                      const newAddr = e.target.value;
                      setFieldErrors((prev) => ({ ...prev, address: "" }));
                      setCheckoutFormData((prev: any) => ({ ...prev, address: newAddr }));
                      triggerManualAddressMapSync(newAddr);
                    }}
                    onFocus={() => {
                      if (checkoutFormData.address.trim().length >= 2 && addressPredictions.length > 0) {
                        setShowAddressDropdown(true);
                      }
                    }}
                    placeholder="Auto-populated when pin is placed on map. E.g. Street 4, Sector F-10/2, Islamabad"
                    className={`w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none font-medium text-slate-800 resize-none leading-relaxed transition-all ${
                      fieldErrors.address
                        ? "border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-slate-200 focus:border-[#3b4414] focus:bg-white focus:ring-2 focus:ring-[#3b4414]/10"
                    }`}
                  />

                  {/* Real-time Geoapify Places Autocomplete Suggestions Dropdown */}
                  {showAddressDropdown && addressPredictions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-fade-in max-h-48 overflow-y-auto">
                      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1 text-amber-900 font-bold">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Suggested Addresses
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddressDropdown(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                      {addressPredictions.map((pred: any) => (
                        <button
                          key={pred.placeId}
                          type="button"
                          onClick={() => handleSelectAddressPrediction(pred.placeId, pred.description, pred.lat, pred.lng, pred.city, pred.area)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50/80 flex items-start gap-2 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-xs truncate">{pred.mainText}</p>
                            <p className="text-[10px] text-slate-500 truncate">{pred.secondaryText}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Auto-filled from map pin. Moves dynamically as you move the map pin.
                  </span>
                  <button
                    type="button"
                    onClick={() => forceAddressMapSync(checkoutFormData.address)}
                    disabled={isSyncingMap || !checkoutFormData.address.trim()}
                    className="text-[#3b4414] hover:underline font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <Navigation className="w-2.5 h-2.5 text-amber-600" />
                    Sync Pin to Address
                  </button>
                </div>

                {fieldErrors.address && (
                  <span className="text-[10.5px] text-red-500 font-medium block">
                    {fieldErrors.address}
                  </span>
                )}
              </motion.div>

              {/* INPUT FIELD 2: Confirm Complete Address (Mandatory Manual Input) */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="chk-form-confirm-complete-address"
                    className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#3b4414]" />
                    <span>Confirm Complete Address</span>
                    <span className="text-red-500 font-bold">*</span>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.2 rounded">
                      Mandatory Entry
                    </span>
                  </label>
                  {checkoutFormData.address && (
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutFormData((prev: any) => ({
                          ...prev,
                          confirmCompleteAddress: prev.address
                        }));
                        if (fieldErrors.confirmCompleteAddress) {
                          setFieldErrors((prev) => ({ ...prev, confirmCompleteAddress: "" }));
                        }
                      }}
                      className="text-[10.5px] text-[#3b4414] hover:underline font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      Copy from Map
                    </button>
                  )}
                </div>

                <textarea
                  id="chk-form-confirm-complete-address"
                  name="confirmCompleteAddress"
                  required
                  rows={2}
                  value={checkoutFormData.confirmCompleteAddress || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (fieldErrors.confirmCompleteAddress) {
                      setFieldErrors((prev) => ({ ...prev, confirmCompleteAddress: "" }));
                    }
                    setCheckoutFormData((prev: any) => ({ ...prev, confirmCompleteAddress: val }));
                  }}
                  placeholder="Please manually enter: e.g. House # 14-B, Street 25, Sector F-10/2 (or Gulraiz Phase 3), Near Markaz, Islamabad"
                  className={`w-full text-xs p-2.5 bg-white border rounded-xl outline-none font-medium text-slate-800 resize-none leading-relaxed transition-all shadow-2xs ${
                    fieldErrors.confirmCompleteAddress
                      ? "border-red-400 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                      : "border-slate-300 focus:border-[#3b4414] focus:ring-2 focus:ring-[#3b4414]/15"
                  }`}
                />

                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Please manually enter and confirm your complete address details (House/Flat #, Street #, Sector/Society, Landmark) to proceed to the next step.
                </p>

                {fieldErrors.confirmCompleteAddress && (
                  <div className="flex items-center gap-1.5 text-[10.5px] text-red-600 font-bold bg-red-50 border border-red-200 p-2 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span>{fieldErrors.confirmCompleteAddress}</span>
                  </div>
                )}
              </motion.div>
            </>
          )}
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
                    <span>{isPickup ? "Step 3: Confirm Self-Pickup & Settlement" : "Step 3: Preferred Schedule & Settlement Method"}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isPickup
                      ? "Review your pickup details and finalize your store order."
                      : "Select your preferred delivery date & time slot."}
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  3 of 3
                </span>
              </motion.div>

              {/* Order Summary Chips */}
              <motion.div custom={direction} variants={fieldItemVariants} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Customer Contact:</span>
                  <span className="font-bold text-slate-850">{checkoutFormData.name} ({checkoutFormData.phone})</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-500 font-medium">Fulfillment Type:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${isPickup ? "text-emerald-900 bg-emerald-100 border border-emerald-300" : "text-amber-900 bg-amber-50 border border-amber-200/60"}`}>
                    {isPickup ? "🏬 Store Self-Pickup (FREE)" : "🚚 Direct Home Delivery"}
                  </span>
                </div>

                {isPickup ? (
                  <>
                    <div className="flex items-start justify-between border-t border-slate-200/60 pt-1.5 gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Store Depot:</span>
                      <span className="font-bold text-slate-850 text-right">Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi</span>
                    </div>
                    {checkoutFormData.pickupNotes && (
                      <div className="flex items-start justify-between border-t border-slate-200/60 pt-1.5 gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Pickup Notes:</span>
                        <span className="font-medium text-slate-800 text-right">{checkoutFormData.pickupNotes}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">Delivery Charges:</span>
                      <span className="font-bold text-emerald-700 font-mono">Free (Rs. 0)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">City &amp; Area / Sector:</span>
                      <span className="font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                        {checkoutFormData.city || selectedArea || "Rawalpindi"} — {checkoutFormData.area || selectedSubLocation || "Gulraiz Phase 3"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between border-t border-slate-200/60 pt-1.5 gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Complete Address (Map):</span>
                      <span className="font-bold text-slate-800 text-right truncate max-w-[250px]">{checkoutFormData.address}</span>
                    </div>

                    <div className="flex items-start justify-between border-t border-slate-200/60 pt-1.5 gap-2">
                      <span className="text-slate-500 font-medium shrink-0">Confirmed Address (Manual):</span>
                      <span className="font-bold text-emerald-900 text-right max-w-[250px] leading-tight">
                        {checkoutFormData.confirmCompleteAddress || checkoutFormData.address}
                      </span>
                    </div>

                    {customerCoordinates && (
                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                        <span className="text-slate-500 font-medium">Map GPS Coordinates:</span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {customerCoordinates.lat.toFixed(5)}, {customerCoordinates.lng.toFixed(5)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">Estimated Route Distance:</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {customDistanceKm ? Number(customDistanceKm).toFixed(1) : "5.0"} km
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">Delivery Charges:</span>
                      <span className="font-bold text-emerald-800 font-mono">
                        Rs. {verifiedDeliveryCharge !== null && verifiedDeliveryCharge !== undefined ? verifiedDeliveryCharge : calculateDeliveryCharge(customDistanceKm || 5)}
                      </span>
                    </div>
                  </>
                )}
              </motion.div>

              {/* Delivery Schedule Picker (or Pickup Readiness Notice) */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{isPickup ? "Store Pickup Schedule" : "Delivery Schedule Slot"}</span>
                </div>

                {/* Date Picker Cards */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                    {isPickup ? "Select Preferred Pickup Date" : "Select Delivery Date"}
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
                  <span>
                    {isPickup
                      ? "Your fresh flour will be freshly ground and packed on order confirmation for instant express counter pickup."
                      : "Fresh Express Milling & Same-Day Dispatch (Delivered fresh within 2 to 4 hours)"}
                  </span>
                </div>
              </motion.div>

              {!isPickup && (
                /* Delivery Notes & Rider Tip Options */
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
              )}

              {/* Settlement Method (Cash on Delivery or Counter Payment) */}
              <motion.div custom={direction} variants={fieldItemVariants} className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                  Settlement Method
                </label>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <span className="text-sm">💵</span>
                    <span>{isPickup ? "Pay at Store Counter (Cash / Card / Mobile Transfer)" : "Cash on Delivery (COD) / Direct Mobile Transfer"}</span>
                  </div>
                  <p className="text-[10.5px] text-emerald-800 leading-relaxed font-medium">
                    {isPickup
                      ? "Pay easily in cash, via card POS, or through JazzCash/Easypaisa/Bank App when you collect your freshly milled flour from our depot."
                      : "Pay easily in cash, card, or via JazzCash/Easypaisa/Bank App once your fresh flour is delivered to your doorstep."}
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
              className="add-to-basket-btn flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer uppercase text-center"
            >
              <ShoppingBag className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="btn-text-label font-bold">Return to Basket</span>
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

export default CheckoutMultiStepForm;

