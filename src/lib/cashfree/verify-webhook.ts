import crypto from "crypto";
import { getCashfreeWebhookSecret } from "./config";

function timingSafeEqualBase64(received: string, expectedB64: string): boolean {
  const a = Buffer.from(received.trim());
  const b = Buffer.from(expectedB64);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify Cashfree payment webhook signature (raw body + timestamp).
 * Cashfree signs with the **Payment Gateway client secret** (same as create-order API), unless they
 * explicitly give a different key in docs for your integration.
 * Some docs show `timestamp + rawBody`, others `timestamp + '.' + rawBody`; we accept either.
 * @see https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  if (!signatureHeader || timestampHeader == null || timestampHeader === "") return false;
  try {
    const secret = getCashfreeWebhookSecret();
    const ts = timestampHeader;
    const withDot = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("base64");
    const noDot = crypto.createHmac("sha256", secret).update(`${ts}${rawBody}`).digest("base64");
    return (
      timingSafeEqualBase64(signatureHeader, withDot) || timingSafeEqualBase64(signatureHeader, noDot)
    );
  } catch {
    return false;
  }
}
