import { motion, AnimatePresence } from "motion/react";
import { CartItem } from "../types";
import { X, Trash2, ShoppingBag, Truck, CheckCircle2, Store, MapPin, Clock, ShieldCheck } from "lucide-react";
import { AnimatedNumber, AnimeCartItem } from "./AnimatedComponents";
import { ProductIcon } from "./ProductIcon";
import { WeightQtyEditor } from "./WeightQtyEditor";
import { triggerHapticFeedback } from "../lib/utils";

interface CartDrawerProps {
  isOpen: boolean;
  cartItems: CartItem[];
  fulfillmentType?: "delivery" | "pickup";
  onFulfillmentTypeChange?: (type: "delivery" | "pickup") => void;
  selectedArea: string;
  selectedSubLocation: string;
  onSubLocationChange: (subLoc: string) => void;
  customDistanceKm: number;
  onCustomDistanceChange: (dist: number) => void;
  onClose: () => void;
  onUpdateQuantity: (id: string, q: number) => void;
  onRemoveItem: (id: string) => void;
  onUndoRemove?: () => void;
  lastRemovedItem?: CartItem | null;
  onAreaChange: (area: string) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  cartItems,
  fulfillmentType = "delivery",
  onFulfillmentTypeChange,
  selectedArea,
  selectedSubLocation,
  onSubLocationChange,
  customDistanceKm,
  onCustomDistanceChange,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onUndoRemove,
  lastRemovedItem,
  onAreaChange,
  onCheckout,
}: CartDrawerProps) {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isPickup = fulfillmentType === "pickup";

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
                <ShoppingBag className="w-5 h-5 text-[#3b4414]" />
                <h3 className="font-sans font-bold text-lg text-slate-800">Your Basket</h3>
                <span className="bg-amber-100 text-amber-900 font-bold text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <AnimatedNumber value={cartItems.length} className="font-bold" />
                  <span>{cartItems.length === 1 ? "Product" : "Products"}</span>
                </span>
              </div>
              <button
                onClick={onClose}
                id="close-cart-btn"
                className="p-2.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer transition-colors hover:bg-slate-100 w-10 h-10 flex items-center justify-center"
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
                      {/* Fulfillment Method Selector Tab (Delivery vs Store Pickup) */}
                      <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback(15);
                            onFulfillmentTypeChange?.("delivery");
                          }}
                          className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            !isPickup
                              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Truck className={`w-3.5 h-3.5 ${!isPickup ? "text-amber-600" : "text-slate-400"}`} />
                          <span>Home Delivery</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback(15);
                            onFulfillmentTypeChange?.("pickup");
                          }}
                          className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPickup
                              ? "bg-white text-emerald-900 shadow-sm border border-emerald-300 ring-1 ring-emerald-400/30"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Store className={`w-3.5 h-3.5 ${isPickup ? "text-emerald-600" : "text-slate-400"}`} />
                          <span>Store Pick Up (FREE)</span>
                        </button>
                      </div>

                      {/* Items List */}
                      <div className="space-y-3">
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
                                {/* Visual + and - Stepper Button Layout */}
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

                      {/* Delivery or Pickup Indicator Card */}
                      {isPickup ? (
                        <div className="bg-emerald-50/90 p-3.5 border border-emerald-200 rounded-xl shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                              <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span>Self-Pickup from Chakki Counter</span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Rs. 0 Fee
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-700 space-y-1">
                            <p className="flex items-center gap-1.5 text-slate-800 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Rd, Rawalpindi</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>Open Daily: 8:00 AM – 9:00 PM (Freshly milled and packed on arrival)</span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-amber-50/90 to-emerald-50/60 p-3.5 border border-amber-200/80 rounded-xl shadow-2xs mt-2 shrink-0 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#3b4414]">
                            <Truck className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Direct Depot Delivery</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                            Live road routing and delivery charges are calculated at checkout based on your exact delivery pin from our central Chakki depot (Main Gulraiz Phase 3 / High Court Rd).
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Exact GPS Pin & Route Calculation in Next Step</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer actions & pricing */}
              {cartItems.length > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4 shrink-0">
                  {/* Calculations Panel */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Items Subtotal</span>
                      <span className="font-bold text-slate-800">Rs. {subtotal}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>{isPickup ? "Pickup Charge" : "Delivery Fee"}</span>
                      {isPickup ? (
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          Free (Rs. 0)
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                          Calculated at Checkout via Map Pin
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex justify-between pt-2 border-t border-slate-200/60 text-sm">
                      <span className="font-bold text-slate-800">Total</span>
                      <span className="font-black text-lg text-slate-900">
                        Rs. {subtotal}
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
                    className="w-full font-black px-4 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer h-11 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 uppercase tracking-wider text-xs"
                  >
                    <span>{isPickup ? "Proceed to Store Pickup Confirmation" : "Proceed to Delivery & Map Checkout"}</span>
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

export default CartDrawer;
