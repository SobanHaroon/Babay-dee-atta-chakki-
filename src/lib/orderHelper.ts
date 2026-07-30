import { supabase as supabaseClient } from "./supabaseClient";


export const NTFY_TOPIC = "baby_dee_chakki_orders_0c518";

export async function sendNtfyNotification(order: any): Promise<boolean> {
  try {
    const itemsText = (order.items || [])
      .map((item: any) => `• ${item.name} (${item.quantity} ${item.unit || "unit"}) @ Rs.${item.price} = Rs.${item.price * item.quantity}`)
      .join("\n");
    const formattedDateTime = new Date(order.createdAt || Date.now()).toLocaleString("en-US", { timeStyle: "medium", dateStyle: "long" });
    const deliverySummaryText = order.deliveryCharges === 0 ? "🌾 FREE SHIPPING milestone earned!" : `Rs. ${order.deliveryCharges}`;

    const ntfyBody = `🌾 NEW CHAKKI ORDER RECEIVED!
-------------------------------
Order Code: ${order.id}
Milled Date & Time: ${formattedDateTime}

[Customer Coordinates]
Name: ${order.customer?.name || "Valued Customer"}
Contact Number: ${order.customer?.phone || ""}
Address: ${order.customer?.address || ""}, ${order.customer?.area || ""}

[Basket Ledger Summary]
${itemsText}

Sourced Subtotal: Rs. ${order.subtotal}
Express Delivery Fee: ${deliverySummaryText}
${order.discount > 0 ? `Milestone Discount: Rs. ${order.discount}\n` : ""}-------------------------------
Grand Total Ledger: Rs. ${order.total}
Settlement Method: ${order.paymentMethod || "Cash on Delivery"}`;

    const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        "Title": `New Order Received: ${order.id}`,
        "Priority": "high",
        "Tags": "ear_of_rice,shopping_bags,bell"
      },
      body: ntfyBody
    });
    console.log("[Client Order Helper] Ntfy push status:", res.status);
    return res.ok;
  } catch (err) {
    console.error("[Client Order Helper] Ntfy push error:", err);
    return false;
  }
}

export async function insertOrderToSupabase(order: any): Promise<boolean> {
  try {
    const numericIdStr = String(order.id).replace("BDEC-", "").trim();
    const numericId = parseInt(numericIdStr, 10) || Math.floor(100000 + Math.random() * 900000);

    const serializedMetadata = {
      address: order.customer?.address || "",
      area: order.customer?.area || "Rawalpindi",
      paymentMethod: order.paymentMethod || "Cash on Delivery",
      subtotal: order.subtotal,
      deliveryCharges: order.deliveryCharges,
      discount: order.discount || 0,
      total: order.total,
      deliveryDate: order.deliveryDate,
      status: order.status || "Order Placed",
      statusHistory: order.statusHistory || [],
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    };
    const customerAddressValue = `${order.customer?.address || ""} | METADATA:${JSON.stringify(serializedMetadata)}`;

    const now = new Date(order.createdAt || Date.now());
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const insertPayload = {
      id: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
      created_at: now.toISOString(),
      "order id": numericId,
      "customer name": order.customer?.name || "Valued Customer",
      "contact number": order.customer?.phone || "",
      "customer address": customerAddressValue,
      date: dateStr,
      time: timeStr,
      Price: order.total
    };

    const { data, error } = await supabaseClient.from("orders").insert([insertPayload]).select();
    if (error) {
      console.error("[Client Order Helper] Supabase order insert error:", error);
      return false;
    }
    console.log(`[Client Order Helper] Successfully inserted order ${order.id} into Supabase!`, data);
    return true;
  } catch (err) {
    console.error("[Client Order Helper] Supabase exception:", err);
    return false;
  }
}
