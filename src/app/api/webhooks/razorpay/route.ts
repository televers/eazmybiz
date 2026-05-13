import { NextResponse } from "next/server";
import { applyRazorpayPaymentCaptured } from "@/lib/razorpay/apply-payment-captured";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/verify-webhook";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Razorpay payment webhooks — verify signature and mirror Cashfree fulfilment flow.
 *
 * Dashboard: POST `https://<your-domain>/api/webhooks/razorpay`
 * Recommended events: `payment.captured`, `payment.failed`.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let parsed: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string | null; status?: string } };
    };
  };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ev = parsed.event ?? "";
  const entity = parsed.payload?.payment?.entity;
  const rzOrderId = typeof entity?.order_id === "string" ? entity.order_id.trim() : "";
  const rzPaymentId = typeof entity?.id === "string" ? entity.id.trim() : "";

  let nextStatus: string | null = null;
  if (ev === "payment.captured") nextStatus = "paid";
  if (ev === "payment.failed") nextStatus = "failed";

  if (!nextStatus || !rzOrderId) {
    return NextResponse.json({ ok: true, note: "ignored" });
  }

  const webhookReceivedAt = new Date().toISOString();
  const admin = createServiceRoleClient();

  if (nextStatus === "paid") {
    const applied = await applyRazorpayPaymentCaptured(admin, {
      rzOrderId,
      rzPaymentId,
      traceType: ev,
      traceAtIso: webhookReceivedAt,
    });
    if (!applied.ok) {
      if (applied.code === "not_found") {
        console.warn("[razorpay webhook] unknown order id", rzOrderId);
        return NextResponse.json({ ok: true });
      }
      console.error("[razorpay webhook] capture:", applied.code, applied.message);
      return NextResponse.json(
        { error: applied.code === "fulfill_failed" ? "fulfillment failed" : "db error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const { data: row, error: fetchErr } = await admin
    .from("subscriptions")
    .select("id, status")
    .eq("razorpay_order_id", rzOrderId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[razorpay webhook] fetch subscription:", fetchErr.message);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  if (!row) {
    console.warn("[razorpay webhook] unknown order id", rzOrderId);
    return NextResponse.json({ ok: true });
  }

  if (row.status === "paid") {
    return NextResponse.json({ ok: true, note: "already paid" });
  }

  const patch: Record<string, string | null> = {
    status: nextStatus,
    webhook_type: ev,
    webhook_received_at: webhookReceivedAt,
    updated_at: webhookReceivedAt,
  };

  const { error: updErr } = await admin.from("subscriptions").update(patch).eq("id", row.id).eq("status", "pending");

  if (updErr) {
    console.error("[razorpay webhook] update subscription:", updErr.message);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
