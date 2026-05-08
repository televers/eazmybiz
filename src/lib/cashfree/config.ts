/** Server-only Cashfree PG configuration. */

export type CashfreeEnvName = "sandbox" | "production";

export function getCashfreePgBaseUrl(): string {
  const env = process.env.CASHFREE_ENV?.trim().toLowerCase();
  if (env === "production") return "https://api.cashfree.com/pg";
  return "https://sandbox.cashfree.com/pg";
}

/** Matches Web Checkout JS v3 `Cashfree({ mode })` (sandbox vs production). */
export function getCashfreeSdkMode(): CashfreeEnvName {
  return process.env.CASHFREE_ENV?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function getCashfreeApiVersion(): string {
  return process.env.CASHFREE_API_VERSION?.trim() || "2025-01-01";
}

export function getCashfreeClientId(): string {
  const id = process.env.CASHFREE_CLIENT_ID?.trim();
  if (!id) throw new Error("Missing CASHFREE_CLIENT_ID");
  return id;
}

export function getCashfreeClientSecret(): string {
  const secret = process.env.CASHFREE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("Missing CASHFREE_CLIENT_SECRET");
  return secret;
}

/**
 * Webhook HMAC secret. Per Cashfree docs, this is the **PG client secret** (`CASHFREE_CLIENT_SECRET`).
 * Set `CASHFREE_WEBHOOK_SECRET` only if it must differ (same value as client secret is fine).
 */
export function getCashfreeWebhookSecret(): string {
  return process.env.CASHFREE_WEBHOOK_SECRET?.trim() || getCashfreeClientSecret();
}
