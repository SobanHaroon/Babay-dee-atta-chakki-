import React, { useEffect, useReducer, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MapPin, Package, ShieldCheck, Store, Truck } from "lucide-react";
import { useToast } from "./ToastContainer";
import "../checkout.css";
import { DeliveryPinConfirm } from './DeliveryPinConfirm';
import { deliveryReducer, initialDeliveryState, type DeliveryEvent, type DeliveryPoint } from '../lib/deliveryCheckout';

export interface CheckoutAddressData {
  checkoutContext: string; addressVersion: number; quoteExpiresAt: number;
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
  const [state, dispatch] = useReducer(deliveryReducer, initialDeliveryState(data.address, data.addressVersion));
  const stateRef = useRef(state); stateRef.current = state;
  const send = (event: DeliveryEvent) => { stateRef.current = deliveryReducer(stateRef.current, event); dispatch(event); };
  const request = useRef<AbortController | null>(null), requestEpoch = useRef(0);
  const [now, setNow] = useState(Date.now());
  const pickup = fulfillmentType === "pickup";
  const calculating = state.status === "resolving" || state.status === "quoting";
  const addressError = state.error;
  const quoted = !pickup && fee != null && props.isDeliverable === true && data.deliveryQuotedAddress === data.address.trim() && data.quoteExpiresAt > now && Boolean(props.customerCoordinates && data.deliveryQuoteToken);
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()),1000); return()=>{clearInterval(timer);request.current?.abort();}; }, []);
  const clearQuote = () => {
    request.current?.abort(); requestEpoch.current++; props.setCheckoutError("");
    props.setVerifiedDeliveryCharge?.(null); props.setIsDeliverable?.(false); props.setCustomerCoordinates?.(null); props.setCustomDistanceKm(0);
    setData(previous=>({...previous,deliveryQuoteToken:"",deliveryQuotedAddress:"",quoteExpiresAt:0}));
  };
  useEffect(()=>{
    if(data.quoteExpiresAt && data.quoteExpiresAt<=now){clearQuote();send({type:'tick',now});props.setCheckoutError('Your delivery quote expired. Calculate delivery again before continuing.');}
  },[now,data.quoteExpiresAt]);
  const invalidate = () => { clearQuote();send({type:'reset'});setData(previous=>({...previous,addressVersion:stateRef.current.version})); };
  const editAddress = (address:string) => {clearQuote();send({type:'edit',address});setData(previous=>({...previous,address,addressVersion:stateRef.current.version,matchedAddress:'',locationPrecision:''}));};
  const changePin = (pin:DeliveryPoint|null) => {clearQuote();send({type:'pin',pin});setData(previous=>({...previous,addressVersion:stateRef.current.version}));};
  const calculate = async (confirmedPin?:DeliveryPoint) => {
    clearQuote();
    const address=stateRef.current.address.trim(),version=stateRef.current.version,id=++requestEpoch.current,checkoutContext=data.checkoutContext;
    send({type:'begin',requestId:id,version,confirm:!!confirmedPin});
    if(address.length<12){send({type:'error',requestId:id,version,error:'Enter your house or building, street, area and city.'});return;}
    const controller=new AbortController();request.current=controller;
    try{
      const response=await fetch('/api/delivery/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,checkoutContext,addressVersion:version,confirmedPin,candidateToken:confirmedPin?stateRef.current.candidate?.candidateToken:undefined}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
      const quote=await response.json().catch(()=>{throw new Error('Address lookup is temporarily unavailable. Please try again.');});
      if(controller.signal.aborted||id!==requestEpoch.current||version!==stateRef.current.version)return;
      if(!response.ok||!quote.success)throw new Error(quote.error||'We could not calculate delivery. Please try again.');
      if(quote.checkoutContext!==checkoutContext||quote.addressVersion!==version)throw new Error('The address changed during lookup. Please calculate again.');
      if(quote.requiresPinConfirmation){
        if(!quote.candidate||!Number.isFinite(quote.candidate.latitude)||!Number.isFinite(quote.candidate.longitude))throw new Error('The map returned an invalid location. Please retry.');
        send({type:'candidate',requestId:id,version,candidate:quote.candidate,candidates:quote.candidates||[quote.candidate]});return;
      }
      if(!quote.deliverable||!Number.isFinite(quote.deliveryCharge)||!Number.isFinite(quote.distanceKm)||!Number.isFinite(quote.latitude)||!Number.isFinite(quote.longitude)||!quote.quoteToken||!Number.isFinite(quote.expiresAt)||quote.expiresAt<=Date.now())throw new Error('The delivery quote is incomplete or expired. Please calculate again.');
      send({type:'quote',requestId:id,version,quote});
      props.setCustomerCoordinates?.({lat:quote.latitude,lng:quote.longitude});props.setCustomDistanceKm(quote.distanceKm);props.setVerifiedDeliveryCharge?.(quote.deliveryCharge);props.setIsDeliverable?.(true);
      props.setSelectedArea(quote.city||'');props.setSelectedSubLocation(quote.area||'');
      setData(previous=>({...previous,deliveryQuoteToken:quote.quoteToken,deliveryQuotedAddress:address,quoteExpiresAt:quote.expiresAt,addressVersion:version,matchedAddress:quote.matchedAddress,locationPrecision:quote.type,city:quote.city||'',area:quote.area||''}));
    }catch(error:any){if(!controller.signal.aborted&&id===requestEpoch.current)send({type:'error',requestId:id,version,error:error.name==='TimeoutError'||error instanceof TypeError?'The connection took too long or was interrupted. Please try again.':error.message||'Connection failed. Please try again.'});}
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
        {pickup ? <div className="pickup-detail"><Store size={24} /><div><strong>Babay Dee Atta Chakki</strong><p>Main Gulraiz Phase 3 / High Court Road, Rawalpindi</p><a href="tel:+923215010846">0321 5010846</a></div></div> : <><div className="address-calculator"><label className="commerce-field" htmlFor="delivery-address">Complete delivery address<textarea id="delivery-address" name="street-address" autoComplete="street-address" rows={3} maxLength={600} value={data.address} aria-describedby="address-help address-error" onChange={e => editAddress(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();if(!calculating)void calculate();}}} placeholder="House 14, Main Gulraiz Road, Rawalpindi" /></label><button type="button" className="commerce-primary calculate-button" onClick={()=>void calculate()} disabled={calculating || data.address.trim().length < 12}>{calculating ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}<span>{calculating ? "Calculating..." : "Calculate delivery charges"}</span></button></div><p id="address-help" className="commerce-hint">Include your house or building, street, housing scheme or sector, and city. Press Enter to calculate.</p>{addressError && <p id="address-error" className="commerce-error" role="alert">{addressError}</p>}
          {state.candidate && <section className="approximate-location" aria-label="Confirm approximate location"><strong>Approximate location</strong><p>Matched area: {state.candidate.matchedAddress}</p><small>The map has not verified your doorstep. Confirm your delivery pin to calculate the road route.</small>
            {state.candidates.length>1&&<label className="commerce-field">Choose a match<select value={state.candidates.findIndex(c=>c.latitude===state.candidate?.latitude&&c.longitude===state.candidate?.longitude)} disabled={calculating} onChange={e=>{clearQuote();send({type:'select',candidate:state.candidates[Number(e.target.value)]});setData(previous=>({...previous,addressVersion:stateRef.current.version}));}}>{state.candidates.map((candidate,index)=><option key={index} value={index}>{candidate.matchedAddress}</option>)}</select></label>}
            <DeliveryPinConfirm point={state.pin} onChange={changePin} disabled={calculating}/>
            <button type="button" className="commerce-primary" disabled={calculating||!state.pin} onClick={()=>{if(state.pin)void calculate(state.pin);}}>{state.status==='quoting'?<Loader2 className="animate-spin" size={16}/>:<MapPin size={16}/>} Confirm pin &amp; calculate delivery</button>
          </section>}
          {quoted && <div className="delivery-quote" role="status"><div><span className="quote-label"><CheckCircle2 size={17}/> DELIVERY CALCULATED</span><p>{customDistanceKm.toFixed(2)} km by road to {data.locationPrecision==='pin'?'your confirmed pin':'the mapped building'}</p><small>{data.matchedAddress}</small><small>Your full address is kept for the rider. This route is not a guarantee of exact doorstep distance.</small><small>Quote valid until {new Date(data.quoteExpiresAt).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}.</small></div><strong>Rs. {fee!.toLocaleString('en-PK')}</strong></div>}
          {!quoted && !calculating && !addressError && <div className="quote-placeholder"><Package size={18} /><span>Your delivery charge will appear here before you continue.</span></div>}</>}
      </>}
      {step === 3 && <><div className="step-caption"><span>03 / REVIEW &amp; CONFIRM</span><h3>Your order, your time.</h3></div><div className="commerce-field-grid"><label className="commerce-field">Preferred {pickup ? "pickup" : "delivery"} date<select value={data.deliveryDate} onChange={e => setField("deliveryDate",e.target.value)}>{props.upcomingDays.map(day => <option key={day.value} value={day.value}>{day.label} · {day.formattedDate}</option>)}</select></label><label className="commerce-field">Preferred time<select value={data.deliverySlot} onChange={e => setField("deliverySlot",e.target.value)}>{(props.deliverySlots?.length ? props.deliverySlots : [{id:"express",name:"Express Same-Day",time:"During store hours"}]).map(slot => <option key={slot.id} value={slot.name}>{slot.name}{slot.time ? " · " + slot.time : ""}</option>)}</select></label></div><div className="order-review"><div><span>Customer</span><strong>{data.name}</strong><p>{data.phone}</p></div><div><span>{pickup ? "Collection" : "Delivery address"}</span><strong>{pickup ? "Babay Dee Atta Chakki" : data.address}</strong>{!pickup && <p>{customDistanceKm.toFixed(2)} km · Delivery Rs. {fee?.toLocaleString("en-PK")}</p>}</div><div><span>Payment</span><strong>{pickup ? "Pay at the store" : "Cash on delivery"}</strong><p>{props.cartItemsCount} item{props.cartItemsCount === 1 ? "" : "s"} in your basket</p></div></div><p className="commerce-hint"><ShieldCheck size={16} /> Check your details and basket total before placing your order.</p></>}
    </div>
    {checkoutError && <p role="alert" className="commerce-error">{checkoutError}</p>}
    <footer className="checkout-navigation"><button type="button" className="commerce-back" onClick={() => {props.setCheckoutError("");step === 1 ? props.onReturnToCart() : setStep(step - 1);}}><ArrowLeft size={16} />{step === 1 ? "Back to basket" : "Back"}</button><button type="submit" className="commerce-primary" disabled={step === 2 && !pickup && (!quoted || calculating)}>{step === 3 ? "Review order" : "Continue"}<ArrowRight size={17} /></button></footer>
  </form>;
}

export default CheckoutMultiStepForm;
