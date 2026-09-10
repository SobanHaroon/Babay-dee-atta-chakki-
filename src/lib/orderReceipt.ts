function escapeReceiptValues(value: any): any {
  if (typeof value === "string") return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  if (Array.isArray(value)) return value.map(escapeReceiptValues);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, escapeReceiptValues(item)]));
  return value;
}

function formatRs(amount: number): string {
  return "Rs. " + (Math.round(amount || 0)).toLocaleString("en-PK");
}

/**
 * Generates an elegant, mobile-responsive HTML order summary receipt
 */
export function generateOrderReceiptHtml(order: any, appUrl: string = ""): string {
  order = escapeReceiptValues(order);
  const orderId = order.id || "BDEC-ORDER";
  const isPickup = order.fulfillmentType === "pickup";
  const customer = order.customer || {};
  const deliveryDetails = order.deliveryDetails || {};
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  
  const customerName = customer.name || order.name || "Valued Customer";
  const customerPhone = customer.phone || order.phone || "N/A";
  const customerEmail = customer.email || order.email || "N/A";
  const address = isPickup
    ? "Babay Dee Store Depot: Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Self-Pickup)"
    : (customer.address || customer.confirmAddress || order.address || "Rawalpindi / Islamabad");
  const city = customer.city || deliveryDetails.city || order.city || "Rawalpindi";
  const area = customer.area || deliveryDetails.area || order.area || "Gulraiz Phase 3";
  const paymentMethod = order.paymentMethod || (isPickup ? "Pay at Store Counter" : "Cash on Delivery");
  
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Karachi"
  });

  const subtotal = order.subtotal || items.reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
  const deliveryCharges = isPickup ? 0 : (order.deliveryCharges ?? order.deliveryFee ?? 0);
  const discount = order.discount || 0;
  const total = order.total || (subtotal + deliveryCharges - discount);

  // Direct user to official live order tracker on babaydeeattachakki.com
  const trackingLink = "https://babaydeeattachakki.com/?tab=tracker";

  const itemsRows = items.map((item, idx) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    const unitLabel = item.unit || "pack";
    return `
      <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background-color: #fafaf9;' : ''}">
        <td style="padding: 14px 16px; text-align: left; vertical-align: top;">
          <div style="font-weight: 700; color: #1c1917; font-size: 14px;">${item.name || "Atta / Chakki Item"}</div>
          <div style="font-size: 12px; color: #78716c; margin-top: 2px;">Cold-Stone Ground • 100% Pure Natural</div>
        </td>
        <td style="padding: 14px 12px; text-align: center; vertical-align: top; font-size: 13px; color: #44403c; font-weight: 600;">
          ${item.quantity || 1} <span style="font-size: 11px; color: #78716c;">${unitLabel}</span>
        </td>
        <td style="padding: 14px 12px; text-align: right; vertical-align: top; font-size: 13px; color: #44403c; font-family: monospace;">
          ${formatRs(item.price || 0)}
        </td>
        <td style="padding: 14px 16px; text-align: right; vertical-align: top; font-size: 14px; font-weight: 700; color: #1c1917; font-family: monospace;">
          ${formatRs(itemTotal)}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - Order ${orderId} | Babay Dee Atta Chakki</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #292524;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7e5e4; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
    
    <!-- BRAND HEADER -->
    <tr>
      <td style="background-color: #2b3316; padding: 32px 28px; text-align: center; border-bottom: 4px solid #d97706;">
        <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.12); padding: 6px 16px; border-radius: 9999px; margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #fef08a;">
            🌾 PURE STONE-GROUND CHAKKI ATTA & GRAINS
          </span>
        </div>
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
          BABAY DEE ATTA CHAKKI
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #d6d3d1; font-weight: 400;">
          Main Gulraiz Phase 3 / High Court Rd, Rawalpindi • Twin Cities Dispatch
        </p>
      </td>
    </tr>

    <!-- STATUS & RECEIPT NUMBER BANNER -->
    <tr>
      <td style="padding: 24px 28px; background-color: #fafaf9; border-bottom: 1px solid #f5f5f4;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; font-weight: 700;">
                Official Order Receipt
              </div>
              <div style="font-size: 22px; font-weight: 800; color: #1c1917; font-family: monospace; margin-top: 2px;">
                ${orderId}
              </div>
              <div style="font-size: 12px; color: #78716c; margin-top: 4px;">
                ${orderDate}
              </div>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 800; color: #047857;">
                  ${isPickup ? "🏬 STORE PICKUP" : "🚚 HOME DELIVERY"}
                </span>
              </div>
              <div style="margin-top: 6px; font-size: 11px; color: #059669; font-weight: 600;">
                ✓ Order Confirmed &amp; Queued
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CUSTOMER & DISPATCH DETAILS -->
    <tr>
      <td style="padding: 24px 28px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          <tr>
            <td width="50%" style="vertical-align: top; padding-right: 12px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                Customer Information
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                ${customerName}
              </div>
              <div style="font-size: 13px; color: #334155; margin-top: 2px; font-family: monospace;">
                📞 ${customerPhone}
              </div>
              ${customerEmail && customerEmail !== "N/A" ? `
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                  ✉️ ${customerEmail}
                </div>
              ` : ''}
              <div style="margin-top: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                Payment Method
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">
                💵 ${paymentMethod}
              </div>
            </td>
            <td width="50%" style="vertical-align: top; padding-left: 12px; border-left: 1px dashed #cbd5e1;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                ${isPickup ? "Pickup Depot Counter" : "Delivery Destination"}
              </div>
              <div style="font-size: 13px; color: #0f172a; font-weight: 600; margin-top: 4px; line-height: 1.4;">
                ${address}
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                📍 ${city} • ${area}
              </div>
              <div style="margin-top: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                Delivery Window
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">
                ⚡ ${order.deliverySlot || "Express Same-Day Dispatch"}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ITEM SUMMARY TABLE -->
    <tr>
      <td style="padding: 0 28px 16px 28px;">
        <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #44403c; letter-spacing: 0.5px; margin-bottom: 10px;">
          BASKET ITEMS SUMMARY
        </div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f5f5f4; border-bottom: 2px solid #e7e5e4;">
              <th style="padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #57534e; letter-spacing: 0.5px;">Product</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #57534e; letter-spacing: 0.5px;">Qty</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #57534e; letter-spacing: 0.5px;">Rate</th>
              <th style="padding: 10px 16px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #57534e; letter-spacing: 0.5px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || `
              <tr>
                <td colspan="4" style="padding: 16px; text-align: center; color: #78716c; font-size: 13px;">
                  Chakki Flour &amp; Grocery Products
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </td>
    </tr>

    <!-- FINANCIAL LEDGER BREAKDOWN -->
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-left: auto; max-width: 320px;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #57534e;">Sourced Subtotal:</td>
            <td style="padding: 6px 0; font-size: 13px; text-align: right; font-weight: 700; color: #1c1917; font-family: monospace;">
              ${formatRs(subtotal)}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #57534e;">
              ${isPickup ? "Store Self-Pickup:" : "Delivery Charges:"}
            </td>
            <td style="padding: 6px 0; font-size: 13px; text-align: right; font-weight: 700; font-family: monospace; color: ${isPickup ? '#059669' : '#1c1917'};">
              ${isPickup ? "FREE (Rs. 0)" : formatRs(deliveryCharges)}
            </td>
          </tr>
          ${discount > 0 ? `
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #059669;">Special Discount:</td>
              <td style="padding: 6px 0; font-size: 13px; text-align: right; font-weight: 700; color: #059669; font-family: monospace;">
                -${formatRs(discount)}
              </td>
            </tr>
          ` : ''}
          <tr style="border-top: 2px dashed #cbd5e1;">
            <td style="padding: 12px 0 0 0; font-size: 15px; font-weight: 800; color: #1c1917;">
              Grand Total Payable:
            </td>
            <td style="padding: 12px 0 0 0; font-size: 20px; text-align: right; font-weight: 900; color: #b45309; font-family: monospace;">
              ${formatRs(total)}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- TRACKING CTA BUTTON -->
    <tr>
      <td style="padding: 0 28px 28px 28px; text-align: center;">
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 14px; font-weight: 700; color: #854d0e; margin-bottom: 6px;">
            Follow Your Milling &amp; Rider Journey Live
          </div>
          <div style="font-size: 12px; color: #a16207; margin-bottom: 16px;">
            Track cold-stone grinding, quality packaging, and real-time rider GPS coordinates.
          </div>
          <a href="${trackingLink}" style="display: inline-block; background-color: #2b3316; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; padding: 12px 28px; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(43, 51, 22, 0.3);">
            🌾 Track Order Status Live →
          </a>
        </div>
      </td>
    </tr>

    <!-- STONE-GROUND GUARANTEE & HELPLINE FOOTER -->
    <tr>
      <td style="background-color: #fafaf9; border-top: 1px solid #e7e5e4; padding: 24px 28px; text-align: center; color: #78716c; font-size: 11.5px; line-height: 1.6;">
        <div style="font-weight: 700; color: #44403c; margin-bottom: 4px;">
          BABAY DEE QUALITY ASSURANCE
        </div>
        <div style="max-width: 480px; margin: 0 auto 12px auto;">
          Our whole wheat grains are triple-cleaned by machine, zero chemicals, zero artificial bleaching, and cold stone-ground fresh upon order confirmation to lock in natural fiber and essential vitamins.
        </div>
        <div style="padding-top: 10px; border-top: 1px solid #e7e5e4; font-size: 12px; color: #44403c;">
          <strong>Helpline / WhatsApp:</strong> 0321-5010846 &nbsp;|&nbsp; <strong>Support:</strong> orders@babaydeechakki.com
        </div>
        <div style="margin-top: 8px; font-size: 10.5px; color: #a8a29e;">
          Babay Dee Atta Chakki • Main Gulraiz Phase 3 / High Court Rd, Rawalpindi • Delivered with pride across Rawalpindi &amp; Islamabad.
        </div>
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates clean plain text fallback for text-only email clients
 */
export function generateOrderReceiptPlainText(order: any): string {
  const orderId = order.id || "BDEC-ORDER";
  const isPickup = order.fulfillmentType === "pickup";
  const customer = order.customer || {};
  const deliveryDetails = order.deliveryDetails || {};
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  
  const customerName = customer.name || order.name || "Valued Customer";
  const customerPhone = customer.phone || order.phone || "N/A";
  const address = isPickup
    ? "Babay Dee Store Depot: Main Gulraiz Phase 3 / High Court Rd, Rawalpindi (Self-Pickup)"
    : (customer.address || customer.confirmAddress || order.address || "Rawalpindi / Islamabad");
  const city = customer.city || deliveryDetails.city || order.city || "Rawalpindi";
  const area = customer.area || deliveryDetails.area || order.area || "Gulraiz Phase 3";
  const paymentMethod = order.paymentMethod || (isPickup ? "Pay at Store Counter" : "Cash on Delivery");

  const subtotal = order.subtotal || items.reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
  const deliveryCharges = isPickup ? 0 : (order.deliveryCharges ?? order.deliveryFee ?? 0);
  const total = order.total || (subtotal + deliveryCharges);

  const itemsList = items.map((it) => 
    `• ${it.name || "Item"} x ${it.quantity || 1} ${it.unit || "pack"} @ Rs. ${it.price || 0} = Rs. ${(it.price || 0) * (it.quantity || 1)}`
  ).join("\n");

  return `
========================================
🌾 BABAY DEE ATTA CHAKKI - ORDER RECEIPT
========================================
Order Code: ${orderId}
Status: Confirmed & Queued for Stone-Milling
Fulfillment: ${isPickup ? "Store Self-Pickup" : "Home Delivery"}
Date: ${new Date(order.createdAt || Date.now()).toLocaleString("en-US", { timeZone: "Asia/Karachi" })}

CUSTOMER DETAILS:
Name: ${customerName}
Phone: ${customerPhone}
Address: ${address}
City/Area: ${city} • ${area}
Payment: ${paymentMethod}

BASKET ITEMS:
${itemsList || "• Fresh Atta / Chakki Items"}

FINANCIAL SUMMARY:
----------------------------------------
Sourced Subtotal:   Rs. ${subtotal}
Delivery Charges:   ${isPickup ? "FREE (Rs. 0)" : "Rs. " + deliveryCharges}
----------------------------------------
GRAND TOTAL:        Rs. ${total}
========================================

Helpline: 0321-5010846 | orders@babaydeechakki.com
Track Order Live: https://babaydeeattachakki.com/?tab=tracker
Main Gulraiz Phase 3 / High Court Rd, Rawalpindi
Thank you for choosing Babay Dee Atta Chakki!
  `.trim();
}


/** Render the confirmed order locally so serverless cold starts cannot break receipts. */
export function openOrderReceipt(order: any): void {
  const url = URL.createObjectURL(new Blob([generateOrderReceiptHtml(order)], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadOrderReceipt(order: any): void {
  const url = URL.createObjectURL(new Blob([generateOrderReceiptHtml(order)], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `BabayDee_Invoice_${String(order.id).replace(/[^a-zA-Z0-9-]/g, "")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
