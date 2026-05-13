import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRazorpayPaymentCaptured } from "@/lib/razorpay/apply-payment-captured";
import { verifyRazorpayCheckoutPaymentSignature } from "@/lib/razorpay/verify-checkout-signature";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

/**
 * Standard Checkout callback: verifies HMAC signature, then applies the same paid + fulfil flow as `payment.captured`
 * webhook (idempotent — safe if the webhook fires too). Enables local/testing without Razorpay reaching localhost.
 *
 * BODY: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature" },
      { status: 400 },
    );
  }

  const ok = verifyRazorpayCheckoutPaymentSignature({
    orderId,
    paymentId,
    signatureHex: signature,
  });

  if (!ok) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  const { data: ownedRow, error: ownErr } = await supabase
    .from("subscriptions")
    .select("id, payment_provider")
    .eq("razorpay_order_id", orderId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (ownErr) {
    return NextResponse.json({ error: ownErr.message }, { status: 500 });
  }
  if (!ownedRow || ownedRow.payment_provider !== "razorpay") {
    return NextResponse.json({ error: "Order not found for this account" }, { status: 404 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const traceAtIso = new Date().toISOString();
  const applied = await applyRazorpayPaymentCaptured(admin, {
    rzOrderId: orderId,
    rzPaymentId: paymentId,
    traceType: "checkout.standard.verify",
    traceAtIso,
  });

  if (!applied.ok) {
    if (applied.code === "not_found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error:
          applied.code === "fulfill_failed"
            ? "Payment verified but plan update failed — contact support with your reference."
            : "Could not update subscription.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, verified: true });
}
