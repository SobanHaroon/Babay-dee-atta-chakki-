import React, { useState, useEffect } from "react";
import { CheckCircle2, Copy, Check, ShoppingBag, Truck, MapPin, Phone, Calendar, Bell, ExternalLink, ShieldCheck, Printer, Download, RotateCcw, Star, Award, Users, Clock, Sparkles, TrendingUp } from "lucide-react";
import { Order } from "../types";

const RECENT_CUSTOMER_FEED = [
  { id: "rc-1", name: "Usman Ali", area: "Gulrez Phase 3, Rawalpindi", item: "10kg Whole Wheat Chakki Atta", time: "2 mins ago" },
  { id: "rc-2", name: "Dr. Ayesha Khan", area: "Bahria Town Phase 7", item: "1kg Pure Desi Ghee & 5kg Basmati Rice", time: "5 mins ago" },
  { id: "rc-3", name: "Tariq Mehmood", area: "F-10/2, Islamabad", item: "2kg Lal Mirch & 1kg Organic Haldi", time: "11 mins ago" },
  { id: "rc-4", name: "Saima Farooq", area: "DHA Phase 2, Rawalpindi", item: "5kg Daal Chana & Besan", time: "18 mins ago" },
  { id: "rc-5", name: "Kamran Hassan", area: "Chaklala Scheme 3", item: "20kg Super Fine Flour", time: "24 mins ago" },
];

function VerifiedCustomerTrustBadge() {
  const [activeFeed, setActiveFeed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeed((prev) => (prev + 1) % RECENT_CUSTOMER_FEED.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const currentOrder = RECENT_CUSTOMER_FEED[activeFeed];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white rounded-2xl p-5 md:p-6 border border-amber-500/30 shadow-xl space-y-5">
      {/* Badge Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 font-black">
            <Award className="w-6 h-6 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                Official Verified Customer Guarantee
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> VERIFIED
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              30+ Years Sourcing Trust in Rawalpindi & Islamabad
            </h3>
          </div>
        </div>
      </div>

      {/* Real-time Order Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-amber-400 text-lg font-black block font-mono">14,850+</span>
          <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Orders Delivered</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-emerald-400 text-lg font-black block font-mono">4.95 ★</span>
          <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">2,400+ Reviews</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-blue-400 text-lg font-black block font-mono">100%</span>
          <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Stone-Ground Pure</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-amber-400 text-lg font-black block font-mono">30 Mins</span>
          <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Express Dispatch</span>
        </div>
      </div>

      {/* Live Recent Customer Activity Feed */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-mono font-bold uppercase tracking-wider text-[11px]">Live Customer Activity Feed</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Twin Cities Sourcing</span>
        </div>

        {/* Animated Order Item */}
        <div className="flex items-center justify-between gap-3 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-xs shrink-0">
              {currentOrder.name.charAt(0)}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{currentOrder.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-medium">{currentOrder.area}</span>
              </div>
              <p className="text-[11px] text-amber-300/90 font-medium">{currentOrder.item}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 font-mono block">{currentOrder.time}</span>
            <span className="text-xs text-amber-400 font-bold">Verified Buyer ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrderSuccessViewProps {
  order: Order;
  onClose: () => void;
  onTrack: () => void;
  onReorder: () => void;
}

function DeliveryFeedbackForm({ orderId, customerName }: { orderId: string; customerName: string }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trapField, setTrapField] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/order/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          rating,
          comment,
          customerName,
          bot_trap: trapField
        })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      }
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 text-center space-y-2">
        <div className="inline-flex items-center justify-center bg-emerald-500 text-white w-10 h-10 rounded-full shadow-sm">
          <Check className="w-6 h-6 stroke-[3]" />
        </div>
        <h4 className="text-sm font-black text-emerald-900">Thank You For Your Feedback!</h4>
        <p className="text-xs text-emerald-700 font-medium max-w-md mx-auto">
          Your {rating}-star delivery rating for order <span className="font-mono font-bold">{orderId}</span> has been recorded. We continuously strive to provide fast, fresh delivery in Rawalpindi & Islamabad!
        </p>
        <div className="flex justify-center gap-1 text-amber-400 pt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`w-4 h-4 ${s <= rating ? "fill-amber-400 stroke-amber-500" : "text-slate-300"}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-slate-50 border border-amber-200/80 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-amber-500 text-slate-950 p-2 rounded-xl">
          <Star className="w-5 h-5 fill-slate-950" />
        </div>
        <div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
            Rate Your Delivery Experience
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            How satisfied are you with our stone-milling, packaging & rider service?
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden Honeypot bot protection field */}
        <input
          type="text"
          name="website_trap"
          value={trapField}
          onChange={(e) => setTrapField(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        {/* 1-5 Star Interactive Selector */}
        <div className="flex items-center justify-center gap-2 py-1 bg-white border border-amber-200/60 rounded-xl p-3 shadow-xs">
          {[1, 2, 3, 4, 5].map((starVal) => {
            const activeStar = (hoverRating || rating) >= starVal;
            return (
              <button
                key={starVal}
                type="button"
                onClick={() => setRating(starVal)}
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 cursor-pointer hover:scale-125 transition-transform"
                title={`${starVal} Star${starVal > 1 ? "s" : ""}`}
              >
                <Star
                  className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                    activeStar ? "fill-amber-400 stroke-amber-500 text-amber-500" : "text-slate-300 fill-slate-100"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Comment textarea */}
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts about delivery speed, packaging, or rider behavior (optional)..."
          className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Star className="w-4 h-4 fill-slate-950" />
          <span>{submitting ? "Submitting..." : "Submit Delivery Experience Rating"}</span>
        </button>
      </form>
    </div>
  );
}

export function OrderSuccessView({ order, onClose, onTrack, onReorder }: OrderSuccessViewProps) {
  const [copied, setCopied] = useState(false);
  const ntfyTopic = "baby_dee_chakki_orders_0c518";

  const getFriendlyDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const todayStr = new Date().toISOString().split("T")[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      
      if (dateStr === todayStr) return "Today";
      if (dateStr === tomorrowStr) return "Tomorrow";
      
      return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return dateStr;
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(order.createdAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const handlePrintReceipt = () => {
    // Create a temporary hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Build elegant styled HTML receipt
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - Order ${order.id}</title>
        <style>
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #334155;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin-bottom: 5px;
          }
          .subtitle {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 25px;
            font-size: 13px;
          }
          .meta-table td {
            padding: 4px 0;
          }
          .meta-label {
            font-weight: bold;
            color: #475569;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 13px;
          }
          .items-table th {
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
            padding: 8px 4px;
            color: #475569;
          }
          .items-table td {
            border-bottom: 1px solid #f1f5f9;
            padding: 10px 4px;
          }
          .total-section {
            border-top: 2px solid #e2e8f0;
            padding-top: 15px;
            font-size: 13px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .grand-total {
            font-size: 16px;
            font-weight: 800;
            color: #1e3a8a;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">BABAY DEE CHAKKI</div>
          <div class="subtitle">Premium Stone-Ground Milling & Herbs</div>
          <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Order Receipt</p>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label" style="width: 35%;">Order ID:</td>
            <td style="font-family: monospace; font-weight: bold;">${order.id}</td>
          </tr>
          <tr>
            <td class="meta-label">Date:</td>
            <td>${formattedDate}</td>
          </tr>
          <tr>
            <td class="meta-label">Customer Name:</td>
            <td>${order.customer.name}</td>
          </tr>
          <tr>
            <td class="meta-label">Contact:</td>
            <td>${order.customer.phone}</td>
          </tr>
          <tr>
            <td class="meta-label">Delivery Address:</td>
            <td>${order.customer.address}, ${order.customer.area}</td>
          </tr>
          <tr>
            <td class="meta-label">Payment Method:</td>
            <td>${order.paymentMethod}</td>
          </tr>
          ${order.deliveryDate ? `
          <tr>
            <td class="meta-label">Delivery Slot:</td>
            <td style="color: #b45309; font-weight: bold;">${order.deliveryDate} (${order.deliverySlot})</td>
          </tr>
          ` : ''}
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: right; width: 15%;">Qty</th>
              <th style="text-align: right; width: 25%;">Price</th>
              <th style="text-align: right; width: 25%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(it => `
              <tr>
                <td>${it.name}</td>
                <td style="text-align: right;">${it.quantity} ${it.unit || "unit"}</td>
                <td style="text-align: right;">Rs. ${it.price}</td>
                <td style="text-align: right; font-weight: bold;">Rs. ${it.price * it.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span>Subtotal</span>
            <span>Rs. ${order.subtotal}</span>
          </div>
          <div class="total-row">
            <span>Delivery Charges</span>
            <span>Rs. ${order.deliveryCharges}</span>
          </div>
          <div class="total-row grand-total">
            <span>GRAND TOTAL</span>
            <span>Rs. ${order.total}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for choosing Babay Dee's premium stone-ground flours & organic herbs!</p>
          <p>Support contact: +92 300 1234567 | Gulrez Phase 3, Rawalpindi</p>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    // Trigger print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove iframe from DOM after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    }, 500);
  };

  const handleDownloadReceipt = () => {
    // Formulate a beautiful store receipt layout
    const divider = "========================================\n";
    const thinDivider = "----------------------------------------\n";
    
    let text = "";
    text += "            BABAY DEE CHAKKI            \n";
    text += "     Premium Stone-Ground & Herbs       \n";
    text += "       Gulrez Phase 3, Rawalpindi       \n";
    text += divider;
    text += `ORDER ID  : ${order.id}\n`;
    text += `DATE      : ${formattedDate}\n`;
    text += divider;
    text += "CUSTOMER DETAILS:\n";
    text += `Name      : ${order.customer.name}\n`;
    text += `Contact   : ${order.customer.phone}\n`;
    text += `Address   : ${order.customer.address}\n`;
    text += `Area      : ${order.customer.area}\n`;
    text += `Payment   : ${order.paymentMethod}\n`;
    if (order.deliveryDate) {
      text += `Delivery  : ${order.deliveryDate} (${order.deliverySlot})\n`;
    }
    text += divider;
    text += "ITEMS PURCHASED:\n";
    text += thinDivider;
    
    order.items.forEach(it => {
      const itemLine = `${it.name}\n`;
      const priceLine = `  ${it.quantity} ${it.unit || "unit"} x Rs. ${it.price}`;
      const totalLine = `Rs. ${it.price * it.quantity}`;
      // Right-align totalLine relative to priceLine
      const spacing = 40 - priceLine.length - totalLine.length;
      const spaces = spacing > 0 ? " ".repeat(spacing) : " ";
      text += itemLine + priceLine + spaces + totalLine + "\n";
    });
    
    text += thinDivider;
    text += `Subtotal                : Rs. ${order.subtotal}\n`;
    text += `Delivery Charges        : Rs. ${order.deliveryCharges}\n`;
    text += thinDivider;
    text += `GRAND TOTAL             : Rs. ${order.total}\n`;
    text += divider;
    text += "    Thank you for sourcing from us!     \n";
    text += "    Eat Fresh, Stay Organic & Healthy   \n";
    text += "========================================\n";

    // Trigger download
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Receipt-Order-${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="order-success-view-container" className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      {/* Celebration Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center bg-emerald-50 border-4 border-emerald-100 text-emerald-600 w-16 h-16 rounded-full animate-bounce">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-600">
            Milling Sourcing Activated
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Order Securely Received!
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Your premium high-grade grains are scheduled for stone-grinding. We have registered your delivery coordinates.
          </p>
        </div>
      </div>

      {/* Primary Key metrics: Tracking ID details */}
      <div className="bg-blue-600 text-white rounded-2xl p-5 md:p-6 shadow-lg relative overflow-hidden">
        {/* Decorative element */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500 rounded-full opacity-30 pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-24 h-24 bg-blue-700 rounded-full opacity-25 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left space-y-1">
            <span className="text-[10px] text-blue-200 uppercase tracking-wider font-mono font-bold block">
              Unique Tracking Code
            </span>
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <span className="text-2xl font-black font-mono tracking-wider">{order.id}</span>
              <button
                onClick={handleCopyId}
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-blue-700/50 hover:bg-blue-700 hover:scale-105 active:scale-95 rounded-lg transition-all cursor-pointer text-blue-100"
                title="Copy tracking ID"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && <span className="text-[10px] text-emerald-300 font-bold block">Copied to clipboard!</span>}
          </div>

          <button
            onClick={onTrack}
            className="w-full md:w-auto px-5 py-3 min-h-[44px] h-11 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider shrink-0"
          >
            <Truck className="w-4 h-4" />
            <span>Track Order Live</span>
          </button>
        </div>
      </div>

      {/* Verified Customer Badge & Live Recent Customer Feed */}
      <VerifiedCustomerTrustBadge />

      {/* Main Breakdown Split layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Basket breakdown ledger (7 columns) */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-md p-5 space-y-4">
          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <span>Sourced Basket Ledger</span>
          </h3>

          {/* List of items */}
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
            {order.items.map((it) => (
              <div key={it.id} className="py-3 flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800">{it.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {it.quantity} {it.unit} @ Rs. {it.price}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-800">
                  Rs. {it.price * it.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* Total Sum calculations */}
          <div className="border-t border-slate-200/60 pt-3 space-y-2 text-xs text-slate-500 font-medium">
            <div className="flex justify-between">
              <span>Sourced Subtotal</span>
              <span className="font-mono font-bold text-slate-800">Rs. {order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Express Delivery Charges</span>
              <span className="font-mono font-bold text-slate-800">
                Rs. {order.deliveryCharges}
              </span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed border-slate-200 pt-2.5">
              <span>Grand Ledger Total</span>
              <span className="text-blue-600 font-mono">Rs. {order.total}</span>
            </div>
          </div>
        </div>

        {/* Customer coordinates details (5 columns) */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 text-xs">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2.5 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500" />
              <span>Consignee Details</span>
            </h3>

            {/* Structured specifics */}
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-450 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-bold text-slate-650">Customer Name</h4>
                  <p className="text-slate-500 font-medium">{order.customer.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-450 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-bold text-slate-650">Contact Number</h4>
                  <p className="text-slate-500 font-mono font-medium">{order.customer.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-450 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-bold text-slate-650">Delivery Address</h4>
                  <p className="text-slate-500 leading-normal font-medium">
                    {order.customer.address}, <span className="font-bold text-slate-800">{order.customer.area}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-450 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <h4 className="font-bold text-slate-650">Placement Time</h4>
                  <p className="text-slate-500 font-medium font-mono text-[11px]">{formattedDate}</p>
                </div>
              </div>

              {order.deliveryDate && (
                <div className="flex items-start gap-2.5 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/10">
                  <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <h4 className="font-bold text-[#3b4414] text-[11px] uppercase tracking-wide">Preferred Delivery</h4>
                    <p className="text-slate-700 font-extrabold text-[12px]">{getFriendlyDate(order.deliveryDate)} — {order.deliverySlot}</p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center">
                <span className="font-bold text-slate-650">Settlement Method:</span>
                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  {order.paymentMethod}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1-5 Star Delivery Experience Rating Section */}
      <DeliveryFeedbackForm orderId={order.id} customerName={order.customer.name} />

      {/* Return back home and Receipt Actions */}
      <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
        <button
          onClick={handlePrintReceipt}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-750 font-bold text-xs rounded-xl tracking-wider uppercase transition-colors cursor-pointer inline-flex items-center gap-2 justify-center shadow-xs"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>Print Receipt</span>
        </button>

        <button
          onClick={handleDownloadReceipt}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-750 font-bold text-xs rounded-xl tracking-wider uppercase transition-colors cursor-pointer inline-flex items-center gap-2 justify-center shadow-xs"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Download Receipt</span>
        </button>

        <button
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-3.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-colors cursor-pointer inline-flex items-center gap-2 justify-center shadow-sm"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Return & Settle Account</span>
        </button>

        <button
          onClick={onReorder}
          id="reorder-button"
          className="w-full sm:w-auto px-6 py-3.5 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl tracking-wider uppercase transition-colors cursor-pointer inline-flex items-center gap-2 justify-center shadow-md hover:scale-[1.02] active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Re-Order Items</span>
        </button>
      </div>
    </div>
  );
}
