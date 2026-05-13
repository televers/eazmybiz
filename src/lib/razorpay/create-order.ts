import Razorpay from "razorpay";

import { getRazorpayKeyId, getRazorpayKeySecret } from "./config";

export type RazorpayCreateOrderInput = {
  /** Amount in smallest currency unit (paise for INR, cents for USD). */
  amountSubunit: number;
  currency: "USD" | "INR";
  receipt: string;
  notes?: Record<string, string>;
};

export type RazorpayCreateOrderResult =
  | { ok: true; orderId: string; amountSubunit: number }
  | { ok: false; message: string };

function razorpayErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "error" in e) {
    const err = (e as { error?: { description?: string; code?: string } }).error;
    if (err?.description) return err.description;
    if (err?.code) return `Razorpay error: ${err.code}`;
  }
  if (e instanceof Error) return e.message;
  return "Razorpay order request failed";
}

/**
 * Create Razorpay Order for Standard Checkout (official Node SDK).
 *
 * @see https://razorpay.com/docs/api/orders/create
 */
export async function razorpayCreateOrder(input: RazorpayCreateOrderInput): Promise<RazorpayCreateOrderResult> {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return { ok: false, message: "Razorpay is not configured." };
  }

  try {
    const rz = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await rz.orders.create({
      amount: input.amountSubunit,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      ...(input.notes && Object.keys(input.notes).length > 0 ? { notes: input.notes as Record<string, string> } : {}),
    });

    const id = order.id as string | undefined;
    if (!id) {
      return { ok: false, message: "Razorpay response missing order id" };
    }
    const amt =
      typeof order.amount === "number" && Number.isFinite(order.amount) ? order.amount : input.amountSubunit;
    return { ok: true, orderId: id, amountSubunit: amt };
  } catch (e) {
    return { ok: false, message: razorpayErrorMessage(e) };
  }
}
