import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, Download, FileText, Loader2, Printer, ShoppingBag, Truck } from 'lucide-react';
import type { Order } from '../types';
import { openOrderReceipt, downloadOrderReceipt, printOrderReceipt } from '../lib/orderReceipt';
import { OrderReceiptSummary } from './OrderReceiptSummary';
import '../checkout.css';

interface OrderSuccessViewProps { order: Order; onClose: () => void; onTrack: () => void; onReorder: () => void }
export function OrderSuccessView({ order, onClose, onTrack, onReorder }: OrderSuccessViewProps) {
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState(order.customer.email || '');
  const [sending, setSending] = useState(false);
  const pickup = order.fulfillmentType === 'pickup';
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.id); setCopied(true); }
    catch { setNotice('Please select and copy the order code above.'); }
  };
  const sendReceipt = async (event: React.FormEvent) => {
    event.preventDefault(); if (sending) return; setSending(true); setNotice('');
    try {
      const res = await fetch('/api/order/send-receipt', { method:'POST', headers:{'Content-Type':'application/json','X-Order-Phone':order.customer.phone}, body:JSON.stringify({orderId:order.id,email:email.trim()}) });
      const data = await res.json();
      if (!res.ok || !(data.success || data.delivered)) throw new Error(data.error || 'The receipt could not be sent. Please try again.');
      setNotice('Receipt sent to ' + email.trim() + '.');
    } catch (error: any) { setNotice(error.message || 'Connection failed. Please try again.'); }
    finally { setSending(false); }
  };
  return <section className="confirmation-page commerce-surface" aria-labelledby="order-received-title">
    <header className="confirmation-hero commerce-heading"><div className="confirmation-mark"><CheckCircle2 size={29} strokeWidth={1.5} /></div><span className="commerce-eyebrow">THANK YOU FOR CHOOSING BABAY DEE</span><h1 id="order-received-title">Order received.<br /><em>Freshly prepared for you.</em></h1><p>{pickup ? 'We will prepare your basket for collection. Follow its progress using your order code.' : 'Your basket is with us. Keep your order code to follow preparation and delivery.'}</p></header>
    <div className="order-reference"><div><small>YOUR ORDER CODE</small><strong>{order.id}<button type="button" className="copy-code" aria-label={copied ? 'Order code copied' : 'Copy order code'} onClick={copy}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></strong></div><button type="button" className="commerce-primary" onClick={onTrack}><Truck size={17} />Track your order</button></div>
    <OrderReceiptSummary order={order} />
    <div className="receipt-footer"><p>Keep a copy for your records.</p><div className="commerce-actions"><button className="commerce-secondary" onClick={() => openOrderReceipt(order)}><FileText size={15} />View receipt</button><button className="commerce-secondary" onClick={() => downloadOrderReceipt(order)}><Download size={15} />Save</button><button className="commerce-secondary" onClick={() => printOrderReceipt(order)}><Printer size={15} />Print</button></div></div>
    <details className="email-receipt"><summary>Email a copy of your receipt</summary><form onSubmit={sendReceipt}><label className="commerce-field">Email address<input type="email" autoComplete="email" required value={email} maxLength={254} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><button className="commerce-primary" disabled={sending}>{sending && <Loader2 size={15} className="animate-spin" />}{sending ? 'Sending...' : 'Send receipt'}</button></form></details>
    {notice && <p className="commerce-hint mt-4" role="status">{notice}</p>}
    <footer className="receipt-footer"><p>Need a hand? <a href="tel:+923215010846">0321 5010846</a></p><div className="commerce-actions"><button className="commerce-back" onClick={onReorder}>Order these items again</button><button className="commerce-secondary" onClick={onClose}><ShoppingBag size={16} />Continue shopping</button></div></footer>
  </section>;
}
