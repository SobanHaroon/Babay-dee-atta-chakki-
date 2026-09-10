import { generateOrderReceiptHtml, generateOrderReceiptPlainText } from "../src/lib/orderReceipt.js";
export { generateOrderReceiptHtml, generateOrderReceiptPlainText } from "../src/lib/orderReceipt.js";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

// Configuration from environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_EMAIL_FROM = process.env.EMAIL_FROM || "Babay Dee Atta Chakki <onboarding@resend.dev>";

// Gmail SMTP configuration (simplest, free setup with Google App Password)
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS;

// Custom SMTP configuration
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || (GMAIL_USER ? `Babay Dee Atta Chakki <${GMAIL_USER}>` : "Babay Dee Atta Chakki <orders@babaydeechakki.com>");

// Optional third party gateways
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Lazy initialized clients
let resendClient: Resend | null = null;
let smtpTransporter: Transporter | null = null;
let gmailTransporter: Transporter | null = null;

function getResendClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY || RESEND_API_KEY || "").trim();
  if (!key) return null;
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

export function getSenderEmail(): string {
  const custom = (process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM || "").trim();
  if (custom) return custom;
  return "Babay Dee Atta Chakki <onboarding@resend.dev>";
}

function getGmailTransporter(): Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.trim(),
        pass: GMAIL_APP_PASSWORD.trim().replace(/\s+/g, ""), // strip spaces from Google app passwords
      },
    });
  }
  return gmailTransporter;
}

function getSmtpTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST.trim(),
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER.trim(),
        pass: SMTP_PASS.trim(),
      },
    });
  }
  return smtpTransporter;
}

export function isEmailServiceConfigured(): {
  configured: boolean;
  provider: "resend" | "gmail" | "smtp" | "sendgrid" | "brevo" | "none";
  details: string;
} {
  const resendKey = (process.env.RESEND_API_KEY || RESEND_API_KEY || "").trim();
  if (resendKey !== "") {
    return {
      configured: true,
      provider: "resend",
      details: "Resend Email API configured (via RESEND_API_KEY)"
    };
  }
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    return {
      configured: true,
      provider: "gmail",
      details: `Gmail SMTP configured for ${GMAIL_USER}`
    };
  }
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return {
      configured: true,
      provider: "smtp",
      details: `Custom SMTP configured on ${SMTP_HOST}:${SMTP_PORT}`
    };
  }
  if (BREVO_API_KEY) {
    return {
      configured: true,
      provider: "brevo",
      details: "Brevo Email API configured"
    };
  }
  if (SENDGRID_API_KEY) {
    return {
      configured: true,
      provider: "sendgrid",
      details: "SendGrid Email API configured"
    };
  }
  return {
    configured: false,
    provider: "none",
    details: "No live email credentials found. Add RESEND_API_KEY, GMAIL_USER + GMAIL_APP_PASSWORD, or SMTP credentials in Settings."
  };
}

// In-memory store for development preview of generated email receipts
interface ReceiptLog {
  id: string;
  orderId: string;
  recipient: string;
  subject: string;
  sentAt: string;
  provider: string;
  status: "delivered" | "simulated" | "failed";
  html: string;
  text: string;
  error?: string;
}

export const EMAIL_RECEIPT_LOGS: ReceiptLog[] = [];

/**
 * Formats a currency amount into Pakistani Rupees (Rs.)
 */
export interface EmailDispatchResult {
  success: boolean;
  delivered: boolean;
  configured: boolean;
  simulated?: boolean;
  provider: "resend" | "gmail" | "smtp" | "brevo" | "sendgrid" | "simulated" | "none";
  messageId?: string;
  recipient: string;
  message: string;
  error?: string;
  html?: string;
}

/**
 * Sends order confirmation receipt email to customer via Resend, Gmail SMTP, Custom SMTP, or Brevo
 */
export async function sendOrderConfirmationEmail(
  order: any,
  customerEmailOverride?: string
): Promise<EmailDispatchResult> {
  const recipientEmail = (customerEmailOverride || order.customer?.email || order.email || "").trim();

  if (!recipientEmail || !recipientEmail.includes("@")) {
    console.log(`[Email Service] Order ${order.id} placed without recipient email.`);
    return {
      success: true,
      delivered: false,
      configured: isEmailServiceConfigured().configured,
      message: "No valid recipient email address provided for this order.",
      provider: "none",
      recipient: recipientEmail || ""
    };
  }

  const orderId = order.id || "BDEC-ORDER";
  const subject = `🌾 Order Receipt #${orderId} - Babay Dee Atta Chakki`;
  const appUrl = process.env.APP_URL || "";
  const htmlContent = generateOrderReceiptHtml(order, appUrl);
  const textContent = generateOrderReceiptPlainText(order);

  // 1. Check Resend Email API
  const resend = getResendClient();
  if (resend) {
    try {
      const fromAddress = getSenderEmail();
      console.log(`[Email Service] Dispatching receipt via Resend API (${fromAddress}) to: ${recipientEmail} for order: ${orderId}`);
      const sendResult = await resend.emails.send({
        from: fromAddress,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      if (sendResult.error) {
        console.error("[Email Service] Resend API error:", sendResult.error);
        const logEntry: ReceiptLog = {
          id: `log-${Date.now()}`,
          orderId,
          recipient: recipientEmail,
          subject,
          sentAt: new Date().toISOString(),
          provider: "resend",
          status: "failed",
          html: htmlContent,
          text: textContent,
          error: sendResult.error.message
        };
        EMAIL_RECEIPT_LOGS.unshift(logEntry);

        return {
          success: false,
          delivered: false,
          configured: true,
          message: `Resend dispatch failed: ${sendResult.error.message}`,
          error: sendResult.error.message,
          provider: "resend",
          recipient: recipientEmail,
          html: htmlContent
        };
      }

      console.log(`[Email Service] Receipt successfully dispatched via Resend! Message ID: ${sendResult.data?.id}`);
      const logEntry: ReceiptLog = {
        id: `log-${Date.now()}`,
        orderId,
        recipient: recipientEmail,
        subject,
        sentAt: new Date().toISOString(),
        provider: "resend",
        status: "delivered",
        html: htmlContent,
        text: textContent
      };
      EMAIL_RECEIPT_LOGS.unshift(logEntry);

      return {
        success: true,
        delivered: true,
        configured: true,
        message: `Order receipt successfully delivered to ${recipientEmail} via Resend.`,
        provider: "resend",
        messageId: sendResult.data?.id,
        recipient: recipientEmail,
        html: htmlContent
      };
    } catch (err: any) {
      console.error("[Email Service] Exception dispatching via Resend:", err);
      return {
        success: false,
        delivered: false,
        configured: true,
        message: `Exception dispatching via Resend: ${err.message}`,
        error: err.message,
        provider: "resend",
        recipient: recipientEmail,
        html: htmlContent
      };
    }
  }

  // 2. Check Gmail SMTP (Google App Password)
  const gmailTransporter = getGmailTransporter();
  if (gmailTransporter) {
    try {
      console.log(`[Email Service] Dispatching receipt via Gmail SMTP (${GMAIL_USER}) to: ${recipientEmail} for order: ${orderId}`);
      const info = await gmailTransporter.sendMail({
        from: `Babay Dee Atta Chakki <${GMAIL_USER}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(`[Email Service] Receipt successfully sent via Gmail SMTP! Message ID: ${info.messageId}`);
      const logEntry: ReceiptLog = {
        id: `log-${Date.now()}`,
        orderId,
        recipient: recipientEmail,
        subject,
        sentAt: new Date().toISOString(),
        provider: "gmail",
        status: "delivered",
        html: htmlContent,
        text: textContent
      };
      EMAIL_RECEIPT_LOGS.unshift(logEntry);

      return {
        success: true,
        delivered: true,
        configured: true,
        message: `Order receipt successfully sent to ${recipientEmail} via Gmail.`,
        provider: "gmail",
        messageId: info.messageId,
        recipient: recipientEmail,
        html: htmlContent
      };
    } catch (err: any) {
      console.error("[Email Service] Exception dispatching via Gmail SMTP:", err);
      const logEntry: ReceiptLog = {
        id: `log-${Date.now()}`,
        orderId,
        recipient: recipientEmail,
        subject,
        sentAt: new Date().toISOString(),
        provider: "gmail",
        status: "failed",
        html: htmlContent,
        text: textContent,
        error: err.message
      };
      EMAIL_RECEIPT_LOGS.unshift(logEntry);

      return {
        success: false,
        delivered: false,
        configured: true,
        message: `Gmail SMTP dispatch failed: ${err.message}`,
        error: err.message,
        provider: "gmail",
        recipient: recipientEmail,
        html: htmlContent
      };
    }
  }

  // 3. Check Custom SMTP (Nodemailer)
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    try {
      console.log(`[Email Service] Dispatching receipt via SMTP (${SMTP_HOST}:${SMTP_PORT}) to: ${recipientEmail} for order: ${orderId}`);
      const info = await smtpTransporter.sendMail({
        from: SMTP_FROM,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(`[Email Service] Receipt successfully sent via SMTP! Message ID: ${info.messageId}`);
      const logEntry: ReceiptLog = {
        id: `log-${Date.now()}`,
        orderId,
        recipient: recipientEmail,
        subject,
        sentAt: new Date().toISOString(),
        provider: "smtp",
        status: "delivered",
        html: htmlContent,
        text: textContent
      };
      EMAIL_RECEIPT_LOGS.unshift(logEntry);

      return {
        success: true,
        delivered: true,
        configured: true,
        message: `Order receipt successfully sent to ${recipientEmail} via SMTP.`,
        provider: "smtp",
        messageId: info.messageId,
        recipient: recipientEmail,
        html: htmlContent
      };
    } catch (err: any) {
      console.error("[Email Service] Exception dispatching via SMTP:", err);
      const logEntry: ReceiptLog = {
        id: `log-${Date.now()}`,
        orderId,
        recipient: recipientEmail,
        subject,
        sentAt: new Date().toISOString(),
        provider: "smtp",
        status: "failed",
        html: htmlContent,
        text: textContent,
        error: err.message
      };
      EMAIL_RECEIPT_LOGS.unshift(logEntry);

      return {
        success: false,
        delivered: false,
        configured: true,
        message: `SMTP dispatch failed: ${err.message}`,
        error: err.message,
        provider: "smtp",
        recipient: recipientEmail,
        html: htmlContent
      };
    }
  }

  // 4. Fallback: No live email provider is configured
  console.log(`[Email Service] Digital invoice generated in simulation mode for order ${orderId} (${recipientEmail}).`);
  const logEntry: ReceiptLog = {
    id: `log-${Date.now()}`,
    orderId,
    recipient: recipientEmail,
    subject,
    sentAt: new Date().toISOString(),
    provider: "simulated",
    status: "simulated",
    html: htmlContent,
    text: textContent
  };
  EMAIL_RECEIPT_LOGS.unshift(logEntry);

  return {
    success: true,
    delivered: false,
    configured: false,
    simulated: true,
    message: `Digital invoice generated for ${recipientEmail}. Live inbox delivery requires configuring RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD in Settings.`,
    provider: "simulated",
    messageId: `sim-${orderId}-${Date.now()}`,
    recipient: recipientEmail,
    html: htmlContent
  };
}

/**
 * Sends a test confirmation receipt to verify email delivery setup
 */
export async function sendTestEmail(targetEmail: string = "karpeter09@gmail.com"): Promise<EmailDispatchResult> {
  const cleanEmail = (targetEmail || "").trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      success: false,
      delivered: false,
      configured: isEmailServiceConfigured().configured,
      message: "Please specify a valid test email address.",
      provider: "none",
      recipient: cleanEmail
    };
  }

  const testOrder = {
    id: `BDEC-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
    fulfillmentType: "delivery",
    customer: {
      name: "Valued Customer (Test)",
      phone: "03215010846",
      email: cleanEmail,
      address: "House 14, Street 7, Gulraiz Phase 3",
      city: "Rawalpindi",
      area: "Gulraiz Phase 3"
    },
    items: [
      { name: "Desi Chakki Whole Wheat Atta (Stone-Ground)", price: 170, quantity: 10, unit: "kg" },
      { name: "Super Basmati Kainat 1121 Steam Rice", price: 420, quantity: 2, unit: "kg" },
      { name: "Traditional Roasted Multigrain Diet Atta", price: 290, quantity: 2, unit: "kg" }
    ],
    paymentMethod: "Cash on Delivery",
    subtotal: 3120,
    deliveryCharges: 150,
    total: 3270,
    deliveryDate: new Date().toISOString().split("T")[0],
    deliverySlot: "Express Same-Day (1-3 hrs)",
    status: "order placed",
    createdAt: new Date().toISOString()
  };

  return await sendOrderConfirmationEmail(testOrder, cleanEmail);
}
