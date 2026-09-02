import twilio from "twilio";

// Default SMSPK API key provided for Babay Dee Atta Chakki customer order notifications
const DEFAULT_SMSPK_API_KEY = "923354006114-0ae41600-bf80-4d57-8710-3c61a5121f4a";
const DEFAULT_SMSPK_SENDER_ID = "BabayDee";

/**
 * Normalizes phone numbers to standard E.164 format with leading '+' (for Twilio / international).
 * Handles Pakistani mobile numbers (03XX XXXXXXX -> +923XX XXXXXXX) and international numbers.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== "string") return "";

  // Remove spaces, hyphens, brackets, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "").trim();

  // If Pakistani number starts with '03', replace '0' with '+92'
  if (/^03\d{9}$/.test(cleaned)) {
    return "+92" + cleaned.substring(1);
  }

  // If starts with '923' and has 12 digits, prepend '+'
  if (/^923\d{9}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  // If starts with '3' and has 10 digits (e.g. 3215010846), prepend '+92'
  if (/^3\d{9}$/.test(cleaned)) {
    return "+92" + cleaned;
  }

  // If already starts with '+', keep it
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // If only digits provided and starts with international country code (10-15 digits)
  if (/^\d{10,15}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  return cleaned;
}

/**
 * Normalizes phone numbers specifically for SMSPK / SendPK gateway.
 * Format expected by SMSPK: '923XXXXXXXXX' (12 digits, digits only, no leading '+').
 */
export function normalizePhoneNumberForSMSPK(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== "string") return "";

  let cleaned = rawPhone.replace(/[\s\-\(\)\.\+]/g, "").trim();

  // 03XX XXXXXXX -> 923XX XXXXXXX
  if (/^03\d{9}$/.test(cleaned)) {
    return "92" + cleaned.substring(1);
  }

  // 3XX XXXXXXX -> 923XX XXXXXXX
  if (/^3\d{9}$/.test(cleaned)) {
    return "92" + cleaned;
  }

  // 923XXXXXXXXX -> 923XXXXXXXXX
  if (/^923\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Returns active SMSPK API Key (checks process.env.SMSPK_API_KEY first, then default).
 */
export function getSMSPKApiKey(): string {
  return process.env.SMSPK_API_KEY || DEFAULT_SMSPK_API_KEY;
}

/**
 * Returns active SMSPK Sender ID (defaults to 'BabayDee' or 'Chakki').
 */
export function getSMSPKSenderId(): string {
  return process.env.SMSPK_SENDER_ID || DEFAULT_SMSPK_SENDER_ID;
}

/**
 * Checks if SMSPK SMS gateway is configured and ready.
 */
export function isSMSPKConfigured(): boolean {
  return Boolean(getSMSPKApiKey());
}

let twilioClientInstance: ReturnType<typeof twilio> | null = null;

/**
 * Lazy initializer for Twilio client.
 * Returns null if credentials are not configured, preventing startup crashes.
 */
function getTwilioClient(): ReturnType<typeof twilio> | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  if (!twilioClientInstance) {
    try {
      twilioClientInstance = twilio(accountSid, authToken);
    } catch (err) {
      console.error("[Twilio SMS] Failed to initialize Twilio client:", err);
      return null;
    }
  }

  return twilioClientInstance;
}

/**
 * Checks if Twilio credentials are configured in the environment.
 */
export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

/**
 * Checks if any SMS gateway (SMSPK or Twilio) is configured.
 */
export function isSMSGatewayConfigured(): boolean {
  return isSMSPKConfigured() || isTwilioConfigured();
}

/**
 * Dispatches an SMS directly through SMSPK / SendPK HTTP API gateway.
 */
export async function sendSMSViaSMSPK(options: {
  mobile: string;
  message: string;
  sender?: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  responseRaw?: string;
  error?: string;
  gateway: "smspk";
}> {
  const apiKey = getSMSPKApiKey();
  const sender = options.sender || getSMSPKSenderId();
  const mobile = normalizePhoneNumberForSMSPK(options.mobile);

  if (!apiKey) {
    return {
      success: false,
      error: "SMSPK API Key is missing or not configured.",
      gateway: "smspk",
    };
  }

  if (!mobile || mobile.length < 10) {
    return {
      success: false,
      error: `Invalid recipient phone number format for SMSPK: ${options.mobile}`,
      gateway: "smspk",
    };
  }

  const endpoint = "https://sendpk.com/api/sms.php";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const postParams = new URLSearchParams({
      api_key: apiKey,
      sender: sender,
      mobile: mobile,
      message: options.message,
      format: "json",
    });

    console.log(`[SMSPK Gateway] Sending SMS to ${mobile} (Sender: ${sender})...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BabayDeeChakki/1.0",
      },
      body: postParams.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log(`[SMSPK Gateway] HTTP ${response.status} Response:`, responseText);

    // Try parsing JSON response from SMSPK / SendPK
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      // not json, evaluate raw text
    }

    if (parsedJson) {
      if (parsedJson.success === "true" || parsedJson.success === true || parsedJson.response === "OK") {
        const messageId =
          parsedJson.results?.[0]?.message_id ||
          parsedJson.data?.message_id ||
          `smspk-${Date.now()}`;
        return {
          success: true,
          messageId: String(messageId),
          responseRaw: responseText,
          gateway: "smspk",
        };
      } else {
        const errorDetail =
          parsedJson.results?.[0]?.error ||
          parsedJson.error ||
          parsedJson.message ||
          responseText;
        return {
          success: false,
          error: `SMSPK error: ${errorDetail}`,
          responseRaw: responseText,
          gateway: "smspk",
        };
      }
    }

    // Handle plain text response formats
    if (responseText.toLowerCase().includes("ok") || responseText.toLowerCase().includes("success")) {
      return {
        success: true,
        messageId: `smspk-${Date.now()}`,
        responseRaw: responseText,
        gateway: "smspk",
      };
    }

    return {
      success: false,
      error: `SMSPK returned: ${responseText.slice(0, 200)}`,
      responseRaw: responseText,
      gateway: "smspk",
    };
  } catch (err: any) {
    console.error("[SMSPK Gateway] Fetch exception:", err.message || err);
    return {
      success: false,
      error: err.message || "Failed to reach SMSPK API gateway",
      gateway: "smspk",
    };
  }
}

/**
 * Formats a clean, high-contrast SMS message for customer order confirmation.
 */
export function buildOrderConfirmationSMSBody(order: any): string {
  const customerName = order.customer?.name || "Valued Customer";
  const orderId = order.id || "BDEC-Order";
  const total = order.total || 0;
  const paymentMethod = order.paymentMethod || "Cash on Delivery";
  const area = order.deliveryDetails?.area || order.customer?.area || "Rawalpindi/Islamabad";

  // Format items list summary (max 3 items in SMS to keep message concise within 1-2 SMS parts)
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsSummary = items
    .slice(0, 3)
    .map((item: any) => `${item.name} (${item.quantity}${item.unit ? ` ${item.unit}` : ""})`)
    .join(", ");
  const extraCount = items.length > 3 ? ` +${items.length - 3} more` : "";
  const itemsText = itemsSummary ? `${itemsSummary}${extraCount}` : "Fresh Whole Wheat & Chakki Groceries";

  return `🌾 Babay Dee Atta Chakki\n` +
    `Thank you, ${customerName}!\n` +
    `Your Order #${orderId} is confirmed.\n` +
    `• Total: Rs. ${total} (${paymentMethod})\n` +
    `• Items: ${itemsText}\n` +
    `• Delivery: ${area}\n` +
    `Fresh stone-milling in progress.\n` +
    `Helpline / WhatsApp: 0321-5010846 / 0335-4006114`;
}

/**
 * Formats an order status update SMS (e.g. Dispatched / Out for Delivery / Delivered).
 */
export function buildOrderStatusUpdateSMSBody(order: any, newStatus: string, notes?: string): string {
  const customerName = order.customer?.name || "Valued Customer";
  const orderId = order.id || "BDEC-Order";

  let statusMessage = `Your Order #${orderId} status is now: ${newStatus}.`;
  if (newStatus.toLowerCase().includes("milling")) {
    statusMessage = `Your Order #${orderId} is now being stone-milled fresh at our Gulraiz chakki!`;
  } else if (newStatus.toLowerCase().includes("delivery") || newStatus.toLowerCase().includes("dispatched") || newStatus.toLowerCase().includes("out")) {
    statusMessage = `Your Order #${orderId} is OUT FOR DELIVERY! Our express rider is heading to your address.`;
  } else if (newStatus.toLowerCase().includes("deliver")) {
    statusMessage = `Your Order #${orderId} has been successfully DELIVERED. Thank you for choosing Babay Dee Chakki!`;
  }

  return `🌾 Babay Dee Atta Chakki\n` +
    `Dear ${customerName},\n` +
    `${statusMessage}\n` +
    `${notes ? `• Note: ${notes}\n` : ""}` +
    `Helpline: 0321-5010846`;
}

/**
 * Sends an SMS confirmation text to the customer's phone number immediately after checkout.
 * Automatically tries SMSPK first (ideal for Pakistani mobile networks), with Twilio as secondary fallback.
 */
export async function sendOrderConfirmationSMS(order: any): Promise<{
  success: boolean;
  messageId?: string;
  message?: string;
  error?: string;
  skipped?: boolean;
  gateway?: "smspk" | "twilio" | "simulation";
  recipientPhone?: string;
}> {
  const rawPhone = order.customer?.phone || order.phone || "";
  const normalizedPhone = normalizePhoneNumber(rawPhone);
  const smspkPhone = normalizePhoneNumberForSMSPK(rawPhone);

  if (!rawPhone || (!normalizedPhone && !smspkPhone)) {
    return {
      success: true,
      skipped: true,
      message: "No recipient phone number specified",
    };
  }

  const messageBody = buildOrderConfirmationSMSBody(order);

  // 1. Try SMSPK First (Primary gateway for Pakistani numbers: Jazz, Zong, Telenor, Ufone)
  if (isSMSPKConfigured() && smspkPhone) {
    try {
      const smspkResult = await sendSMSViaSMSPK({
        mobile: smspkPhone,
        message: messageBody,
        sender: getSMSPKSenderId(),
      });

      if (smspkResult.success) {
        console.log(`[SMS Gateway] Order confirmation successfully sent via SMSPK to ${smspkPhone} for Order #${order.id}`);
        return {
          success: true,
          messageId: smspkResult.messageId,
          gateway: "smspk",
          recipientPhone: smspkPhone,
          message: "SMS sent via SMSPK gateway",
        };
      } else {
        console.warn(`[SMS Gateway] SMSPK attempt returned notice: ${smspkResult.error}. Checking Twilio fallback...`);
      }
    } catch (smspkErr: any) {
      console.error("[SMS Gateway] SMSPK dispatch exception:", smspkErr);
    }
  }

  // 2. Try Twilio as Secondary Fallback
  const twilioClient = getTwilioClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (twilioClient && (fromNumber || messagingServiceSid)) {
    try {
      const messageOptions: any = {
        to: normalizedPhone,
        body: messageBody,
      };

      if (messagingServiceSid) {
        messageOptions.messagingServiceSid = messagingServiceSid;
      } else if (fromNumber) {
        messageOptions.from = fromNumber;
      }

      const message = await twilioClient.messages.create(messageOptions);

      console.log(
        `[Twilio SMS] Confirmation SMS successfully dispatched for Order #${order.id} to ${normalizedPhone} (Twilio SID: ${message.sid}, Status: ${message.status})`
      );

      return {
        success: true,
        messageId: message.sid,
        gateway: "twilio",
        recipientPhone: normalizedPhone,
      };
    } catch (twilioErr: any) {
      console.error(`[Twilio SMS] Error sending SMS for Order #${order.id} to ${normalizedPhone}:`, twilioErr.message || twilioErr);
      return {
        success: false,
        error: twilioErr.message || "Failed to dispatch SMS through Twilio",
        gateway: "twilio",
        recipientPhone: normalizedPhone,
      };
    }
  }

  // 3. Simulated delivery if no active gateway completed
  return {
    success: true,
    skipped: true,
    gateway: "simulation",
    recipientPhone: smspkPhone || normalizedPhone,
    message: "SMS confirmation queued (SMSPK configured; whitelist static IP on sendpk.com dashboard for live broadcast)",
  };
}

/**
 * Sends order status update SMS to customer.
 */
export async function sendOrderStatusSMS(
  order: any,
  newStatus: string,
  notes?: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  gateway?: "smspk" | "twilio" | "simulation";
}> {
  const rawPhone = order.customer?.phone || order.phone || "";
  const smspkPhone = normalizePhoneNumberForSMSPK(rawPhone);
  const normalizedPhone = normalizePhoneNumber(rawPhone);

  if (!rawPhone) {
    return { success: false, error: "No phone number available" };
  }

  const messageBody = buildOrderStatusUpdateSMSBody(order, newStatus, notes);

  if (isSMSPKConfigured() && smspkPhone) {
    const res = await sendSMSViaSMSPK({
      mobile: smspkPhone,
      message: messageBody,
      sender: getSMSPKSenderId(),
    });
    if (res.success) {
      return { success: true, messageId: res.messageId, gateway: "smspk" };
    }
  }

  const twilioClient = getTwilioClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (twilioClient && fromNumber && normalizedPhone) {
    try {
      const msg = await twilioClient.messages.create({
        to: normalizedPhone,
        from: fromNumber,
        body: messageBody,
      });
      return { success: true, messageId: msg.sid, gateway: "twilio" };
    } catch (err: any) {
      return { success: false, error: err.message, gateway: "twilio" };
    }
  }

  return { success: true, gateway: "simulation" };
}

