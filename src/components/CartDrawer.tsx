import { motion, AnimatePresence } from "motion/react";
import { CartItem, DeliveryArea, DeliveryCity } from "../types";
import { X, Plus, Minus, Trash2, ShoppingBag, Truck, Sparkles, Gift, Check, CheckCircle2, Navigation, Loader2 } from "lucide-react";
import { calculateDeliveryCharge, formatRs } from "../lib/deliveryCalculation";
import { DeliveryAreaSelector } from "./DeliveryAreaSelector";
import { AnimatedScore, AnimatedNumber, AnimeCartItem } from "./AnimatedComponents";
import { ProductIcon } from "./ProductIcon";
import { WeightQtyEditor, displayFormattedQty } from "./WeightQtyEditor";
import { triggerHapticFeedback } from "../lib/utils";

interface CartDrawerProps {
  isOpen: boolean;
  cartItems: CartItem[];
  selectedArea: string;
  selectedSubLocation: string;
  onSubLocationChange: (subLoc: string) => void;
  customDistanceKm: number;
  onCustomDistanceChange: (dist: number) => void;
  deliveryCity: DeliveryCity | "";
  deliveryAreaQuery: string;
  deliveryAreas: DeliveryArea[];
  selectedDeliveryArea: DeliveryArea | null;
  deliveryAreasLoading: boolean;
  deliveryAreasError: string;
  onDeliveryCityChange: (city: DeliveryCity) => void;
  onDeliveryAreaQueryChange: (query: string) => void;
  onDeliveryAreaSelect: (area: DeliveryArea) => void;
  onRetryDeliveryAreas: () => void;
  onClose: () => void;
  onUpdateQuantity: (id: string, q: number) => void;
  onRemoveItem: (id: string) => void;
  onUndoRemove?: () => void;
  lastRemovedItem?: CartItem | null;
  onAreaChange: (area: string) => void;
  onCheckout: () => void;
  onDetectLocation?: () => void;
  isDetectingLocation?: boolean;
}

export function CartDrawer({
  isOpen,
  cartItems,
  selectedArea,
  selectedSubLocation,
  onSubLocationChange,
  customDistanceKm,
  onCustomDistanceChange,
  deliveryCity,
  deliveryAreaQuery,
  deliveryAreas,
  selectedDeliveryArea,
  deliveryAreasLoading,
  deliveryAreasError,
  onDeliveryCityChange,
  onDeliveryAreaQueryChange,
  onDeliveryAreaSelect,
  onRetryDeliveryAreas,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onUndoRemove,
  lastRemovedItem,
  onAreaChange,
  onCheckout,
  onDetectLocation,
  isDetectingLocation,
}: CartDrawerProps) {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const deliveryCharges = selectedDeliveryArea
    ? calculateDeliveryCharge(selectedDeliveryArea.distanceKm, selectedDeliveryArea.deliveryRatePerKm)
    : 0;
  const total = subtotal + deliveryCharges;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="cart-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end h-screen"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            id="cart-drawer-container"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
            className="bg-white w-full max-w-md h-screen max-h-screen flex flex-col overflow-hidden shadow-2xl relative"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                <h3 className="font-sans font-bold text-lg text-slate-800">Your Basket</h3>
                <span className="bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <AnimatedNumber value={cartItems.reduce((acc, item) => acc + item.quantity, 0)} className="font-bold" />
                  <span>Items</span>
                </span>
              </div>
              <button
                onClick={onClose}
                id="close-cart-btn"
                className="p-3 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors hover:bg-slate-100 w-11 h-11 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable entire cart content, including details and location selection */}
            <div className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="flex-1 flex flex-col">
                {/* Cart Items List & Location Selector Section */}
                <div className="p-4 space-y-4 flex-1">
                  {cartItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <span className="text-4xl mb-3">🌾</span>
                      <h4 className="font-bold text-slate-700 text-sm mb-1">Your basket is empty</h4>
                      <p className="text-xs text-slate-400 max-w-[240px]">
                        Browse Babay Dee's local selection of stone-ground atta, premium basmati rice, lentils, dry fruits, and herbs.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {cartItems.map((item) => (
                          <AnimeCartItem
                            key={item.id}
                            id={item.id}
                            className="flex gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all shadow-3xs"
                          >
                            {/* Thumb */}
                            <ProductIcon
                              productId={item.id}
                              productImage={item.productImage}
                              size={24}
                              className="w-16 h-16 shrink-0 rounded-xl shadow-2xs self-center"
                            />

                            {/* Info */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <h4 className="text-xs font-black text-slate-900 line-clamp-1 truncate">
                                    {item.name}
                                  </h4>
                                  <span className="text-[10px] text-slate-500 font-medium block">
                                    Rs. {item.price} / {item.unit || "Kg"}
                                  </span>
                                </div>
                                <button
                                  onClick={() => onRemoveItem(item.id)}
                                  id={`remove-item-btn-${item.id}`}
                                  className="text-slate-400 hover:text-red-500 cursor-pointer p-2 transition-colors rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0 min-h-[36px] min-w-[36px]"
                                  title="Remove product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-200/60">
                                {/* Visual + and - Stepper Button Layout (No Numeric Keyboard Input) */}
                                <WeightQtyEditor
                                  quantity={item.quantity}
                                  onChange={(qty) => onUpdateQuantity(item.id, qty)}
                                  unit={item.unit}
                                  variant="stepper"
                                />

                                {/* Calculated Total Price */}
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 font-mono uppercase font-bold block">Total</span>
                                  <span className="text-xs sm:text-sm font-black text-slate-900 font-sans">
                                    Rs. {Math.round(item.price * item.quantity).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </AnimeCartItem>
                        ))}
                      </div>

                      {/* Database-backed delivery destination selection */}
                      <div className="space-y-3 bg-white p-3 border border-slate-200/60 rounded-xl shadow-xs mt-2 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Delivery Destination</span>
                          {onDetectLocation && (
                            <button
                              type="button"
                              onClick={onDetectLocation}
                              disabled={isDetectingLocation}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isDetectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                              <span>{isDetectingLocation ? "Locating..." : "Detect Location"}</span>
                            </button>
                          )}
                        </div>
                        <DeliveryAreaSelector
                          city={deliveryCity}
                          query={deliveryAreaQuery}
                          areas={deliveryAreas}
                          selectedArea={selectedDeliveryArea}
                          loading={deliveryAreasLoading}
                          error={deliveryAreasError}
                          onCityChange={onDeliveryCityChange}
                          onQueryChange={onDeliveryAreaQueryChange}
                          onSelect={onDeliveryAreaSelect}
                          onRetry={onRetryDeliveryAreas}
                        />
                        {selectedDeliveryArea && selectedDeliveryArea.available && (
                          <div className="flex items-center gap-1.5 text-[10.5px] text-[#3b4414] font-medium bg-[#3b4414]/5 p-2 rounded-lg">
                            <Truck className="w-3.5 h-3.5 text-[#3b4414]" />
                            <span>Verified distance: <strong>{selectedDeliveryArea.distanceKm} km</strong> · {formatRs(deliveryCharges)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer actions & pricing (shows only if products are present) */}
              {cartItems.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4 shrink-0">
                  {/* Calculations Panel */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Basket Subtotal</span>
                      <span className="font-bold text-slate-800">Rs. {subtotal}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Express Delivery Charges</span>
                      <span className="font-bold text-slate-805">
                        {!selectedDeliveryArea ? (
                          <span className="text-slate-400">Select destination area</span>
                        ) : (
                          formatRs(deliveryCharges)
                        )}
                      </span>
                    </div>

                    {/* Strict Disclaimer for Price Truth */}
                    <div className="flex justify-between pt-2 border-t border-slate-200/60 text-sm">
                      <span className="font-bold text-slate-800">Est. Order Sum</span>
                      <span className="font-black text-lg text-blue-600">
                        Rs. {total}
                      </span>
                    </div>
                  </div>

                  {/* Proceed to checkout */}
                  <button
                    onClick={() => {
                      triggerHapticFeedback(25);
                      onCheckout();
                    }}
                    id="cart-drawer-checkout-btn"
                    disabled={!selectedDeliveryArea || !selectedDeliveryArea.available}
                    className={`w-full font-bold px-4 py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer h-11 ${
                      selectedDeliveryArea?.available
                        ? "bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-md"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <span>{selectedDeliveryArea?.available ? "Proceed to Shipping" : "Select an available area"}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
