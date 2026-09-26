import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MapPin, Package, ShieldCheck, Store, Truck } from "lucide-react";
import { useToast } from "./ToastContainer";
import "../checkout.css";

export interface CheckoutAddressData {
  name: string; phone: string; email?: string; address: string;
  city?: string; area: string; paymentMethod: string; sendingBank: string; transactionId: string;
  deliveryDate: string; deliverySlot: string; pickupNotes?: string;
  deliveryQuoteToken?: string; deliveryQuotedAddress?: string; matchedAddress?: string; locationPrecision?: string;
}
interface CheckoutMultiStepFormProps {
  checkoutFormData: CheckoutAddressData;
  setCheckoutFormData: React.Dispatch<React.SetStateAction<CheckoutAddressData>>;
  fulfillmentType?: "delivery" | "pickup"; setFulfillmentType?: (type: "delivery" | "pickup") => void;
  checkoutError: string; setCheckoutError: (error: string) => void;
  selectedArea: string; setSelectedArea: (area: string) => void;
  selectedSubLocation: string; setSelectedSubLocation: (area: string) => void;
  customDistanceKm: number; setCustomDistanceKm: (distance: number) => void;
  customerCoordinates?: { lat: number; lng: number } | null;
  setCustomerCoordinates?: (point: { lat: number; lng: number } | null) => void;
  isDeliverable?: boolean; setIsDeliverable?: (value: boolean) => void;
  verifiedDeliveryCharge?: number | null; setVerifiedDeliveryCharge?: (fee: number | null) => void;
  handleCheckoutSubmit: (e: React.FormEvent) => void; onReturnToCart: () => void;
  upcomingDays: { value: string; label: string; formattedDate: string }[];
  deliverySlots?: { id: string; name: string; time: string; icon: string }[]; cartItemsCount: number;
}
export function CheckoutMultiStepForm(props: CheckoutMultiStepFormProps) {
  const { checkoutFormData: data, setCheckoutFormData: setData, fulfillmentType = "delivery", verifiedDeliveryCharge: fee, customDistanceKm, checkoutError } = props;
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [calculating, setCalculating] = useState(false);
  const [addressError, setAddressError] = useState("");
  const request = useRef<AbortController | null>(null);
  const currentAddress = useRef(data.address); currentAddress.current = data.address;
  const pickup = fulfillmentType === "pickup";
  const quoted = !pickup && fee != null && props.isDeliverable === true && data.deliveryQuotedAddress === data.address.trim() && Boolean(props.customerCoordinates && data.deliveryQuoteToken);
  useEffect(() => () => request.current?.abort(), []);
  const invalidate = () => {
    request.current?.abort(); setCalculating(false); setAddressError(""); props.setCheckoutError("");
    props.setVerifiedDeliveryCharge?.(null); props.setIsDeliverable?.(false); props.setCustomerCoordinates?.(null); props.setCustomDistanceKm(0);
  };
  const calculate = async () => {
    const address = data.address.trim();
    invalidate();
    if (address.length < 12) { setAddressError("Enter your house or building, street, area and city."); return; }
    const controller = new AbortController(); request.current = controller; setCalculating(true);
    try {
      const response = await fetch("/api/delivery/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
      const quote = await response.json().catch(() => { throw new Error("Address lookup is temporarily unavailable. Please try Calculate delivery charges again."); });
      if (controller.signal.aborted || currentAddress.current.trim() !== address) return;
      if (!response.ok || !quote.success || !quote.deliverable || !Number.isFinite(quote.deliveryCharge) || !Number.isFinite(quote.distanceKm) || !Number.isFinite(quote.latitude) || !Number.isFinite(quote.longitude) || !quote.quoteToken) throw new Error(quote.error || "We could not calculate delivery for this address. Please check the street, sector or phase, and city.");
      props.setCustomerCoordinates?.({ lat: quote.latitude, lng: quote.longitude });
      props.setCustomDistanceKm(quote.distanceKm); props.setVerifiedDeliveryCharge?.(quote.deliveryCharge); props.setIsDeliverable?.(true);
      props.setSelectedArea(quote.city || ""); props.setSelectedSubLocation(quote.area || "");
      setData(prev => ({ ...prev, deliveryQuoteToken: quote.quoteToken, deliveryQuotedAddress: address, matchedAddress: quote.matchedAddress, locationPrecision: quote.type, city: quote.city || "", area: quote.area || "" }));
    } catch (error: any) { if (!controller.signal.aborted) setAddressError(error.name === "TimeoutError" || error instanceof TypeError ? "The connection took too long or was interrupted. Please try Calculate delivery charges again." : error.message || "Connection failed. Please try again."); }
    finally { if (!controller.signal.aborted) setCalculating(false); }
  };
  const validate = (stage: number) => {
    let message = "";
    if (stage === 1) {
      const phone = data.phone.replace(/\D/g, "").replace(/^92/, "0");
      if (data.name.trim().length < 2) message = "Please enter your full name.";
      else if (!/^03\d{9}$/.test(phone)) message = "Enter a valid mobile number, such as 0321 1234567.";
      else if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) message = "Please check your email address.";
    }
    if (stage === 2 && !pickup && (!quoted || calculating)) message = "Calculate delivery charges for your address before continuing.";
    if (stage === 3 && (!data.deliveryDate || !data.deliverySlot)) message = "Choose your preferred date and time.";
    props.setCheckoutError(message); if (message) toast.error(message); return !message;
  };
  const setField = (key: keyof CheckoutAddressData, value: string) => { props.setCheckoutError(""); setData(prev => ({ ...prev, [key]: value })); };
  const labels = ["Your details", pickup ? "Pickup" : "Delivery", "Review"];
  return <form className="checkout-flow commerce-surface" noValidate onSubmit={e => {
    e.preventDefault();
    if (step < 3) { if (validate(step)) setStep(step + 1); return; }
    for (const stage of [1, 2, 3]) if (!validate(stage)) { setStep(stage); return; }
    props.handleCheckoutSubmit(e);
  }}>
    <header className="commerce-heading"><span className="commerce-eyebrow">FROM OUR CHAKKI TO YOUR HOME</span><h2>A few details.<br /><em>Freshness follows.</em></h2><p>Three simple steps to place your order.</p></header>
    <ol className="checkout-steps" aria-label="Checkout progress">{labels.map((label, i) => <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={step === i + 1 ? "current" : step > i + 1 ? "complete" : ""}><button type="button" disabled={i + 1 >= step} onClick={() => {props.setCheckoutError("");setStep(i + 1);}}><span>{step > i + 1 ? <Check size={14} /> : '0' + (i + 1)}</span>{label}</button></li>)}</ol>
    <div className="checkout-step-body" key={step}>
      {step === 1 && <><div className="step-caption"><span>01 / YOUR DETAILS</span><h3>Who are we packing for?</h3></div><label className="commerce-field">Full name<input autoComplete="name" name="name" value={data.name} onChange={e => setField("name", e.target.value)} placeholder="Your full name" maxLength={120} required /></label><div className="commerce-field-grid"><label className="commerce-field">Mobile number<input autoComplete="tel" name="phone" inputMode="tel" value={data.phone} onChange={e => setField("phone", e.target.value)} placeholder="03XX XXXXXXX" required /></label><label className="commerce-field">Email <span className="optional">optional</span><input autoComplete="email" type="email" name="email" value={data.email || ""} onChange={e => setField("email", e.target.value)} placeholder="For your receipt" /></label></div><p className="commerce-hint"><ShieldCheck size={16} /> We use these details to confirm and deliver your order.</p></>}
      {step === 2 && <><div className="step-caption"><span>02 / {pickup ? "PICKUP" : "DELIVERY"}</span><h3>{pickup ? "Meet us at the chakki." : "Where should we deliver?"}</h3></div><div className="fulfillment-options" role="group" aria-label="Order fulfillment">{(["delivery", "pickup"] as const).map(type => <button type="button" key={type} aria-pressed={fulfillmentType === type} onClick={() => { if (fulfillmentType !== type) { invalidate(); props.setFulfillmentType?.(type); } }}><span className="fulfillment-icon">{type === "delivery" ? <Truck size={20} /> : <Store size={20} />}</span><span><strong>{type === "delivery" ? "Home delivery" : "Collect from store"}</strong><small>{type === "delivery" ? "Calculated from your address" : "No delivery charge"}</small></span><span className="selection-dot" /></button>)}</div>
        {pickup ? <div className="pickup-detail"><Store size={24} /><div><strong>Babay Dee Atta Chakki</strong><p>Main Gulraiz Phase 3 / High Court Road, Rawalpindi</p><a href="tel:+923215010846">0321 5010846</a></div></div> : <><div className="address-calculator"><label className="commerce-field" htmlFor="delivery-address">Complete delivery address<textarea id="delivery-address" name="street-address" autoComplete="street-address" rows={3} maxLength={600} value={data.address} aria-describedby="address-help address-error" onChange={e => {invalidate();setData(prev => ({...prev,address:e.target.value,deliveryQuoteToken:"",deliveryQuotedAddress:"",matchedAddress:""}));}} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();if(!calculating)void calculate();}}} placeholder="House 14, Main Gulraiz Road, Rawalpindi" /></label><button type="button" className="commerce-primary calculate-button" onClick={calculate} disabled={calculating || data.address.trim().length < 12}>{calculating ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}<span>{calculating ? "Calculating..." : "Calculate delivery charges"}</span></button></div><p id="address-help" className="commerce-hint">Include your house or building, street, housing scheme or sector, and city. Press Enter to calculate.</p>{addressError && <p id="address-error" className="commerce-error" role="alert">{addressError}</p>}
          {quoted && <div className="delivery-quote" role="status"><div><span className="quote-label"><CheckCircle2 size={17} /> {data.locationPrecision === "neighborhood" ? "NEIGHBOURHOOD ESTIMATE" : "DELIVERY CALCULATED"}</span><p>{customDistanceKm.toFixed(2)} km by road from our store</p>{data.matchedAddress && <small>Location found: {data.matchedAddress}</small>}{data.locationPrecision === "street" && <small>Delivery is priced to this street. Your full house address is kept for the rider.</small>}{data.locationPrecision === "neighborhood" && <small className="quote-precision">Your exact house or street is not mapped. This charge uses the road distance to the matched neighbourhood shown above. Your full address is kept for the rider.</small>}{["sector", "phase"].includes(data.locationPrecision || "") && <small className="quote-precision">Delivery is priced to the matched {data.locationPrecision} shown above because a closer house or street could not be located. Your full address is kept for the rider.</small>}</div><strong>Rs. {fee!.toLocaleString("en-PK")}</strong></div>}
          {!quoted && !calculating && !addressError && <div className="quote-placeholder"><Package size={18} /><span>Your delivery charge will appear here before you continue.</span></div>}</>}
      </>}
      {step === 3 && <><div className="step-caption"><span>03 / REVIEW &amp; CONFIRM</span><h3>Your order, your time.</h3></div><div className="commerce-field-grid"><label className="commerce-field">Preferred {pickup ? "pickup" : "delivery"} date<select value={data.deliveryDate} onChange={e => setField("deliveryDate",e.target.value)}>{props.upcomingDays.map(day => <option key={day.value} value={day.value}>{day.label} · {day.formattedDate}</option>)}</select></label><label className="commerce-field">Preferred time<select value={data.deliverySlot} onChange={e => setField("deliverySlot",e.target.value)}>{(props.deliverySlots?.length ? props.deliverySlots : [{id:"express",name:"Express Same-Day",time:"During store hours"}]).map(slot => <option key={slot.id} value={slot.name}>{slot.name}{slot.time ? " · " + slot.time : ""}</option>)}</select></label></div><div className="order-review"><div><span>Customer</span><strong>{data.name}</strong><p>{data.phone}</p></div><div><span>{pickup ? "Collection" : "Delivery address"}</span><strong>{pickup ? "Babay Dee Atta Chakki" : data.address}</strong>{!pickup && <p>{customDistanceKm.toFixed(2)} km · Delivery Rs. {fee?.toLocaleString("en-PK")}</p>}</div><div><span>Payment</span><strong>{pickup ? "Pay at the store" : "Cash on delivery"}</strong><p>{props.cartItemsCount} item{props.cartItemsCount === 1 ? "" : "s"} in your basket</p></div></div><p className="commerce-hint"><ShieldCheck size={16} /> Check your details and basket total before placing your order.</p></>}
    </div>
    {checkoutError && <p role="alert" className="commerce-error">{checkoutError}</p>}
    <footer className="checkout-navigation"><button type="button" className="commerce-back" onClick={() => {props.setCheckoutError("");step === 1 ? props.onReturnToCart() : setStep(step - 1);}}><ArrowLeft size={16} />{step === 1 ? "Back to basket" : "Back"}</button><button type="submit" className="commerce-primary" disabled={step === 2 && !pickup && (!quoted || calculating)}>{step === 3 ? "Review order" : "Continue"}<ArrowRight size={17} /></button></footer>
  </form>;
}

export default CheckoutMultiStepForm;
