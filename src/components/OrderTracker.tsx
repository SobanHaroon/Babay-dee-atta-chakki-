import React, { useState, useEffect } from 'react';
import { Search, Loader2, Clock, Check, Package, Truck } from 'lucide-react';
import type { Order } from '../types';
import { OrderReceiptSummary } from './OrderReceiptSummary';
import { openOrderReceipt } from '../lib/orderReceipt';
import { orderProgress } from '../lib/commerce';
import '../checkout.css';

export function OrderTracker() {
  const [orderIdInput, setOrderIdInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('order') || params.get('orderId') || params.get('track') || new URLSearchParams(window.location.hash.slice(1)).get('track') || localStorage.getItem('last_tracking_id') || '').toUpperCase();
  });
  const [phoneInput, setPhoneInput] = useState('');
  const [lookup, setLookup] = useState<{id:string;phone:string;attempt:number} | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState('');
  useEffect(() => {
    if (!lookup) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let inFlight = false;
    setOrder(null); setUpdated(''); setLoading(true);
    const refresh = async () => {
      if (inFlight || controller.signal.aborted) return;
      clearTimeout(timer); inFlight = true;
      try {
        const response = await fetch('/api/order/' + encodeURIComponent(lookup.id), { headers:{'X-Order-Phone':lookup.phone}, signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]) });
        if (!response.ok) {
          if ([400,401,403,404].includes(response.status)) {setOrder(null); throw new Error('No order found with these details. Check your order code and the mobile number used at checkout.');}
          throw new Error('We could not refresh your order. Please try again shortly.');
        }
        const data = await response.json();
        if (!data.id || !data.customer || !Array.isArray(data.items)) throw new Error('Order details are temporarily unavailable. Please try again.');
        if (!controller.signal.aborted) {setOrder(data);setError('');setUpdated(new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Karachi',hour:'2-digit',minute:'2-digit',second:'2-digit'}));}
      } catch (failure: any) { if (!controller.signal.aborted) setError(failure.message === 'Failed to fetch' ? 'Connection lost. We will retry shortly.' : failure.message || 'Unable to load your order.'); }
      finally {inFlight=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(refresh,15000);}}
    };
    void refresh();
    const onUpdate = () => {void refresh();};
    window.addEventListener('order-realtime-update',onUpdate);
    return () => {controller.abort();clearTimeout(timer);window.removeEventListener('order-realtime-update',onUpdate);};
  },[lookup]);
  const progress = order ? orderProgress(order.status,order.fulfillmentType === 'pickup') : null;
  return <section id="order-tracker-card" className="tracking-page commerce-surface" aria-labelledby="tracking-title">
    <header className="commerce-heading"><span className="commerce-eyebrow">FROM THE CHAKKI, WITH CARE</span><h1 id="tracking-title">Your order.<br /><em>Every step of the way.</em></h1><p>Enter your order code and the mobile number you used at checkout to see the latest update.</p></header>
    <form className="tracking-search" onSubmit={event => {event.preventDefault();setError('');const id=orderIdInput.trim().toUpperCase();setLookup(prev=>({id,phone:phoneInput.trim(),attempt:(prev?.attempt||0)+1}));localStorage.setItem('last_tracking_id',id);}}>
      <label className="commerce-field">Order code<input name="order-code" value={orderIdInput} onChange={e=>setOrderIdInput(e.target.value)} placeholder="BDEC-123456789" maxLength={80} required /></label>
      <label className="commerce-field">Mobile number<input type="tel" name="phone" autoComplete="tel" value={phoneInput} onChange={e=>setPhoneInput(e.target.value)} placeholder="03XX XXXXXXX" maxLength={24} required /></label>
      <button id="track-order-btn" className="commerce-primary" disabled={loading}>{loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}{loading ? 'Finding order...' : 'Track order'}</button>
    </form>
    {error && <p className="commerce-error mt-5" role="alert">{error}</p>}
    {!order && !error && <div className="tracking-empty" role="status"><Package size={35} strokeWidth={1.2} /><p>{loading ? 'Checking the latest order details...' : 'Your order code is on your receipt. Your preparation and delivery updates will appear here.'}</p></div>}
    {order && progress && <><div className="tracking-summary"><div><small>ORDER DETAILS</small><h2>{order.id}</h2></div><span className={'status-chip'+(progress.cancelled?' cancelled':'')}><Clock size={13} />{order.status}</span></div>
      {!progress.cancelled && <ol className="order-timeline" aria-label="Order progress">{progress.steps.map((label,i)=><li key={label} className={i<progress.index?'done':i===progress.index?'active':''} aria-current={i===progress.index?'step':undefined}><span>{i<progress.index?<Check size={15}/>:i===3?<Truck size={15}/>:<Package size={15}/>}</span><strong>{label}</strong><small>{i<progress.index?'Completed':i===progress.index?'Current stage':'Upcoming'}</small></li>)}</ol>}
      {progress.cancelled && <p className="commerce-error mb-6">This order was cancelled. Call <a href="tel:+923215010846">0321 5010846</a> if you need help.</p>}
      <OrderReceiptSummary order={order}/>
      {order.statusHistory?.length>0 && <section className="status-history"><h3>Updates from our store</h3><ol>{order.statusHistory.map((entry,i)=><li key={i}><time>{entry.time}</time><div><strong>{entry.status}</strong><p>{entry.detail}</p></div></li>)}</ol></section>}
      <footer className="receipt-footer"><p className="tracking-update" role="status">Last checked {updated} PKT. Refreshes automatically</p><button className="commerce-secondary" onClick={()=>openOrderReceipt(order)}>View receipt</button></footer>
    </>}
  </section>;
}

export default OrderTracker;
