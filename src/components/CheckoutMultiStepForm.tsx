import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Store, Truck } from "lucide-react";
import { useToast } from "./ToastContainer";
import "../checkout.css";
import { DELIVERY_CHARGES_NOTE } from '../lib/orderWhatsApp';

export interface CheckoutAddressData {
  checkoutContext: string; addressVersion: number;
  name: string; phone: string; email?: string; address: string;
  city?: string; area: string; paymentMethod: string; sendingBank: string; transactionId: string;
  deliveryDate: string; deliverySlot: string; pickupNotes?: string;
}
interface CheckoutMultiStepFormProps {
  checkoutFormData: CheckoutAddressData;
  setCheckoutFormData: React.Dispatch<React.SetStateAction<CheckoutAddressData>>;
  fulfillmentType?: "delivery" | "pickup"; setFulfillmentType?: (type: "delivery" | "pickup") => void;
  checkoutError: string; setCheckoutError: (error: string) => void;
  handleCheckoutSubmit: (e: React.FormEvent) => void; onReturnToCart: () => void;
  upcomingDays: { value: string; label: string; formattedDate: string }[];
  deliverySlots?: { id: string; name: string; time: string; icon: string }[]; cartItemsCount: number;
}
export function CheckoutMultiStepForm(props: CheckoutMultiStepFormProps) {
  const { checkoutFormData: data, setCheckoutFormData: setData, fulfillmentType = "delivery", checkoutError } = props;
  const toast = useToast();
  const [step, setStep] = useState(1);
  const pickup = fulfillmentType === "pickup";
  const validate = (stage: number) => {
    let message = "";
    if (stage === 1) {
      const phone = data.phone.replace(/\D/g, "").replace(/^92/, "0");
      if (data.name.trim().length < 2) message = "Please enter your full name.";
      else if (!/^03\d{9}$/.test(phone)) message = "Enter a valid mobile number, such as 0321 1234567.";
      else if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) message = "Please check your email address.";
    }
    if (stage === 2 && !pickup && data.address.trim().length < 8) message = "Please enter your complete delivery address.";
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
      {step === 2 && <><div className="step-caption"><span>02 / {pickup ? "PICKUP" : "DELIVERY"}</span><h3>{pickup ? "Meet us at the chakki." : "Where should we deliver?"}</h3></div><div className="fulfillment-options" role="group" aria-label="Order fulfillment">{(["delivery", "pickup"] as const).map(type => <button type="button" key={type} aria-pressed={fulfillmentType === type} onClick={() => { if (fulfillmentType !== type) { props.setCheckoutError(""); props.setFulfillmentType?.(type); } }}><span className="fulfillment-icon">{type === "delivery" ? <Truck size={20} /> : <Store size={20} />}</span><span><strong>{type === "delivery" ? "Home delivery" : "Collect from store"}</strong><small>{type === "delivery" ? "Delivery confirmed on WhatsApp" : "No delivery charge"}</small></span><span className="selection-dot" /></button>)}</div>
        {pickup ? <div className="pickup-detail"><Store size={24} /><div><strong>Babay Dee Atta Chakki</strong><p>Main Gulraiz Phase 3 / High Court Road, Rawalpindi</p><a href="tel:+923215010846">0321 5010846</a></div></div> : <><label className="commerce-field" htmlFor="delivery-address">Complete delivery address<textarea id="delivery-address" name="street-address" autoComplete="street-address" rows={3} maxLength={600} value={data.address} aria-describedby="address-help" onChange={e => setField("address", e.target.value)} placeholder="House 14, Main Gulraiz Road, Rawalpindi" required /></label><p id="address-help" className="commerce-hint">Include your house or building, street, area and city.</p><p className="commerce-hint">{DELIVERY_CHARGES_NOTE}</p></>}
      </>}
      {step === 3 && <><div className="step-caption"><span>03 / REVIEW &amp; CONFIRM</span><h3>Your order, your time.</h3></div><div className="commerce-field-grid"><label className="commerce-field">Preferred {pickup ? "pickup" : "delivery"} date<select value={data.deliveryDate} onChange={e => setField("deliveryDate",e.target.value)}>{props.upcomingDays.map(day => <option key={day.value} value={day.value}>{day.label} · {day.formattedDate}</option>)}</select></label><label className="commerce-field">Preferred time<select value={data.deliverySlot} onChange={e => setField("deliverySlot",e.target.value)}>{(props.deliverySlots?.length ? props.deliverySlots : [{id:"express",name:"Express Same-Day",time:"During store hours"}]).map(slot => <option key={slot.id} value={slot.name}>{slot.name}{slot.time ? " · " + slot.time : ""}</option>)}</select></label></div><div className="order-review"><div><span>Customer</span><strong>{data.name}</strong><p>{data.phone}</p></div><div><span>{pickup ? "Collection" : "Delivery address"}</span><strong>{pickup ? "Babay Dee Atta Chakki" : data.address}</strong>{!pickup && <p>{DELIVERY_CHARGES_NOTE}</p>}</div><div><span>Payment</span><strong>{pickup ? "Pay at the store" : "Cash on delivery"}</strong><p>{props.cartItemsCount} item{props.cartItemsCount === 1 ? "" : "s"} in your basket</p></div></div><p className="commerce-hint"><ShieldCheck size={16} /> Check your details and basket total before placing your order.</p></>}
    </div>
    {checkoutError && <p role="alert" className="commerce-error">{checkoutError}</p>}
    <footer className="checkout-navigation"><button type="button" className="commerce-back" onClick={() => {props.setCheckoutError("");step === 1 ? props.onReturnToCart() : setStep(step - 1);}}><ArrowLeft size={16} />{step === 1 ? "Back to basket" : "Back"}</button><button type="submit" className="commerce-primary">{step === 3 ? "Review order" : "Continue"}<ArrowRight size={17} /></button></footer>
  </form>;
}

export default CheckoutMultiStepForm;
