import { createHmac, timingSafeEqual } from "node:crypto";

import { getRazorpayWebhookSecret } from "./config";

/**
 * Verify Razorpay webhook signature (hex digest of HMAC-SHA256 on raw UTF-8 body).
 *
 * @see https://razorpay.com/docs/webhooks/validate-integration
 */
export function verifyRazorpayWebhookSignature(rawBodyUtf8: string, signatureHex: string | null): boolean {
  const secret = getRazorpayWebhookSecret();
  if (!secret || !signatureHex?.trim()) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret).update(rawBodyUtf8).digest("hex");
  const expBuf = Buffer.from(expectedHex, "hex");
  const gotBuf = Buffer.from(signatureHex.trim(), "hex");
  if (expBuf.length !== gotBuf.length) {
    return false;
  }
  try {
    return timingSafeEqual(expBuf, gotBuf);
  } catch {
    return false;
  }
}
