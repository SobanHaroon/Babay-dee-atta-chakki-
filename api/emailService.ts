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
    console.log(JSON.stringify({event:'email_delivery_status'}));
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
      console.log(JSON.stringify({event:'email_delivery_status'}));
      const sendResult = await resend.emails.send({
        from: fromAddress,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      if (sendResult.error) {
        console.error(JSON.stringify({event:'email_delivery_error'}));

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

      console.log(JSON.stringify({event:'email_delivery_status'}));

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
      console.error(JSON.stringify({event:'email_delivery_error'}));
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
      console.log(JSON.stringify({event:'email_delivery_status'}));
      const info = await gmailTransporter.sendMail({
        from: `Babay Dee Atta Chakki <${GMAIL_USER}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(JSON.stringify({event:'email_delivery_status'}));

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
      console.error(JSON.stringify({event:'email_delivery_error'}));

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
      console.log(JSON.stringify({event:'email_delivery_status'}));
      const info = await smtpTransporter.sendMail({
        from: SMTP_FROM,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(JSON.stringify({event:'email_delivery_status'}));

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
      console.error(JSON.stringify({event:'email_delivery_error'}));

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
  console.log(JSON.stringify({event:'email_delivery_status'}));

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

