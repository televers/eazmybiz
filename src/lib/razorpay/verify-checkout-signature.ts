import { createHmac, timingSafeEqual } from "node:crypto";

import { getRazorpayKeySecret } from "./config";

/**
 * Validates Standard Checkout payment signature (HMAC-SHA256).
 * Message body: `razorpay_order_id + "|" + razorpay_payment_id`.
 *
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration
 */
export function verifyRazorpayCheckoutPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signatureHex: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  const { orderId, paymentId, signatureHex } = params;
  if (!secret || !orderId?.trim() || !paymentId?.trim() || !signatureHex?.trim()) {
    return false;
  }

  const payload = `${orderId.trim()}|${paymentId.trim()}`;
  const expectedHex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(signatureHex.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
