import { supabase as supabaseClient } from "./supabaseClient";

export const NTFY_TOPIC = "baby_dee_chakki_orders_0c518";

/**
 * Sends Ntfy order push notification.
 * Prefers the server-side proxy `/api/notifications/ntfy` to avoid browser iframe CORS restrictions.
 */
export async function sendNtfyNotification(order: any): Promise<boolean> {
  try {
    // 1. Try server-side proxy route first (bypasses browser CORS & iframe sandboxes)
    try {
      const res = await fetch("/api/notifications/ntfy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log("[Client Order Helper] Ntfy push proxy succeeded");
          return true;
        }
      }
    } catch {
      // Server proxy not reachable, proceed to direct fallback
    }

    // 2. Direct fallback (if permitted by network/CORS)
    const itemsText = (order.items || [])
      .map(
        (item: any) =>
          `• ${item.name} (${item.quantity} ${item.unit || "unit"}) @ Rs.${item.price} = Rs.${item.price * item.quantity}`
      )
      .join("\n");
    const formattedDateTime = new Date(order.createdAt || Date.now()).toLocaleString("en-US", {
      timeStyle: "medium",
      dateStyle: "long",
    });
    const deliverySummaryText = `Rs. ${order.deliveryCharges}`;

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
        Title: `New Order Received: ${order.id}`,
        Priority: "high",
        Tags: "ear_of_rice,shopping_bags,bell",
      },
      body: ntfyBody,
    });
    return res.ok;
  } catch (err) {
    console.warn("[Client Order Helper] Ntfy notification skipped/unavailable:", err);
    return false;
  }
}

/**
 * Dispatches SMS confirmation text via backend SMS gateway (SMSPK / Twilio)
 */
export async function sendOrderConfirmationSMSClient(order: any): Promise<boolean> {
  try {
    const res = await fetch("/api/notifications/order-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log("[Client Order Helper] SMS dispatch result:", data);
      return data.success;
    }
    return false;
  } catch (err) {
    console.warn("[Client Order Helper] SMS dispatch unavailable in current network context:", err);
    return false;
  }
}

/**
 * Inserts order record to Supabase with schema resilience.
 */
export async function insertOrderToSupabase(order: any): Promise<boolean> {
  try {
    if (!supabaseClient) {
      console.log("[Client Order Helper] Supabase client not initialized (skipping direct client insert)");
      return false;
    }

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
        quantity: item.quantity,
      })),
    };
    const customerAddressValue = `${order.customer?.address || ""} | METADATA:${JSON.stringify(serializedMetadata)}`;

    const now = new Date(order.createdAt || Date.now());
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const subtotalVal = typeof order.subtotal === "number" ? order.subtotal : order.total - (order.deliveryCharges || 0);
    const deliveryChargeVal = typeof order.deliveryCharges === "number" ? order.deliveryCharges : 0;

    const hasCoords = typeof order.customer?.latitude === "number" && typeof order.customer?.longitude === "number";

    const rawInsertPayload: Record<string, any> = {
      id: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
      created_at: now.toISOString(),
      "order id": numericId,
      "customer name": order.customer?.name || "Valued Customer",
      "contact number": order.customer?.phone || "",
      "customer address": customerAddressValue,
      date: dateStr,
      time: timeStr,
      Price: order.total,
      "Delivery charges": deliveryChargeVal,
      "Order pricing": subtotalVal,
      ...(hasCoords
        ? {
            "customer latitude": order.customer.latitude,
            "customer longitude": order.customer.longitude,
            "customer Latitude": order.customer.latitude,
            "customer Longitude": order.customer.longitude,
            customer_latitude: order.customer.latitude,
            customer_longitude: order.customer.longitude,
            latitude: order.customer.latitude,
            longitude: order.customer.longitude,
            "delivery latitude": order.customer.latitude,
            "delivery longitude": order.customer.longitude,
            delivery_latitude: order.customer.latitude,
            delivery_longitude: order.customer.longitude,
            delivery_distance_km: order.deliveryDetails?.distanceKm || 0,
            delivery_charge: deliveryChargeVal,
            delivery_address: order.customer?.address || "",
          }
        : {}),
    };

    let insertPayload = { ...rawInsertPayload };

    for (let attempt = 0; attempt < 15; attempt++) {
      const { data, error } = await supabaseClient.from("orders").insert([insertPayload]).select();
      if (!error) {
        console.log(`[Client Order Helper] Successfully inserted order ${order.id} into Supabase! Fields:`, Object.keys(insertPayload), data);
        return true;
      }

      const match = error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        delete insertPayload[match[1]];
      } else {
        console.warn("[Client Order Helper] Supabase direct client write:", error.message || error);
        return false;
      }
    }

    return false;
  } catch (err: any) {
    console.warn("[Client Order Helper] Supabase direct write bypassed:", err.message || err);
    return false;
  }
}
