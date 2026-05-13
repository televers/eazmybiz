/** Server-only Razorpay REST API (international USD checkout). */
export type RazorpayEnvName = "test" | "live";

export function getRazorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID?.trim() ?? "";
}

export function getRazorpayKeySecret(): string {
  return process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
}

/** Webhook signing secret from Razorpay dashboard (Settings → Webhooks). */
export function getRazorpayWebhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
}

/**
 * Key ID shown in Razorpay Checkout in the browser — use the same merchant key Id as REST.
 */
export function getRazorpayPublishableKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? getRazorpayKeyId();
}

export function razorpayOrdersBaseUrl(): string {
  return process.env.RAZORPAY_API_BASE_URL?.trim() || "https://api.razorpay.com";
}

export function isRazorpayConfigured(): boolean {
  return getRazorpayKeyId().length > 0 && getRazorpayKeySecret().length > 0;
}

export function getRazorpayModeForClient(): RazorpayEnvName {
  const m = process.env.RAZORPAY_ENV?.trim().toLowerCase();
  return m === "live" ? "live" : "test";
}
