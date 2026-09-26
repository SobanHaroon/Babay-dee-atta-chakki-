import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import type { Order } from '../types';
import { OrderReceiptSummary } from './OrderReceiptSummary';
import { useDialogFocus } from '../lib/useDialogFocus';
export function CheckoutConfirmation({order,busy,error,onBack,onConfirm}:{order:Order;busy:boolean;error:string;onBack:()=>void;onConfirm:()=>void}) {
  useDialogFocus(true,'#checkout-confirmation',()=>{if(!busy)onBack();});
  return <div className="checkout-confirmation-overlay" onClick={e=>{if(e.target===e.currentTarget&&!busy)onBack();}}><section id="checkout-confirmation" className="commerce-surface" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" tabIndex={-1}><header className="commerce-heading"><button className="confirmation-close" aria-label="Close order review" onClick={onBack} disabled={busy}><X size={20}/></button><span className="commerce-eyebrow">ONE LAST LOOK</span><h2 id="confirmation-title">Everything ready?</h2><p>Check your details and total, then place your order.</p></header><OrderReceiptSummary order={order}/>{error&&<p className="commerce-error mt-5" role="alert">{error}</p>}<footer className="checkout-navigation"><button className="commerce-back" onClick={onBack} disabled={busy}>Back to edit</button><button className="commerce-primary" onClick={onConfirm} disabled={busy}>{busy?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/ >}{busy?'Placing order...':'Confirm & place order'}</button></footer></section></div>;
}
