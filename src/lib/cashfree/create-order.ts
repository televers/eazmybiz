import { getCashfreeApiVersion, getCashfreeClientId, getCashfreeClientSecret, getCashfreePgBaseUrl } from "./config";

export type CashfreeCreateOrderInput = {
  merchantOrderId: string;
  orderAmountInr: number;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
};

export type CashfreeCreateOrderResult =
  | { ok: true; paymentSessionId: string; cfOrderId: string }
  | { ok: false; message: string; status?: number };

/**
 * Create a Cashfree order and return payment_session_id for Web Checkout.
 * @see https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
 */
export async function cashfreeCreateOrder(input: CashfreeCreateOrderInput): Promise<CashfreeCreateOrderResult> {
  const base = getCashfreePgBaseUrl();
  const clientId = getCashfreeClientId();
  const clientSecret = getCashfreeClientSecret();
  const apiVersion = getCashfreeApiVersion();

  const body = {
    order_id: input.merchantOrderId,
    order_amount: input.orderAmountInr,
    order_currency: "INR",
    customer_details: {
      customer_id: input.customerId,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
    },
    order_meta: {
      return_url: input.returnUrl,
    },
  };

  const res = await fetch(`${base}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": apiVersion,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Cashfree create order failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { message?: string; message_text?: string };
      message = j.message_text ?? j.message ?? message;
    } catch {
      if (text) message = `${message}: ${text.slice(0, 200)}`;
    }
    return { ok: false, message, status: res.status };
  }

  try {
    const data = JSON.parse(text) as {
      payment_session_id?: string;
      cf_order_id?: string;
    };
    const paymentSessionId = data.payment_session_id;
    const cfOrderId = data.cf_order_id;
    if (!paymentSessionId) {
      return { ok: false, message: "Cashfree response missing payment_session_id" };
    }
    return { ok: true, paymentSessionId, cfOrderId: cfOrderId ?? "" };
  } catch {
    return { ok: false, message: "Invalid JSON from Cashfree create order" };
  }
}
