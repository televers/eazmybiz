import { NextResponse } from "next/server";
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree/verify-webhook";
import { fulfillPaidInrSubscription } from "@/lib/cashfree/fulfill-paid-inr-subscription";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type CfWebhookPayload = {
  type?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number; payment_status?: string };
  };
};

function mapWebhookToStatus(type: string | undefined, paymentStatus: string | undefined): string | null {
  if (type === "PAYMENT_SUCCESS_WEBHOOK") {
    if (paymentStatus === "SUCCESS") return "paid";
    return "failed";
  }
  if (type === "PAYMENT_FAILED_WEBHOOK") return "failed";
  if (type === "PAYMENT_USER_DROPPED_WEBHOOK") return "user_dropped";
  return null;
}

/**
 * Cashfree payment webhooks — verifies HMAC and updates `public.subscriptions.status`.
 * Register URL in Cashfree dashboard: `https://<your-domain>/api/webhooks/cashfree`
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (!verifyCashfreeWebhookSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let parsed: CfWebhookPayload;
  try {
    parsed = JSON.parse(rawBody) as CfWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderId = parsed.data?.order?.order_id?.trim();
  if (!orderId) {
    return NextResponse.json({ ok: true, note: "no order id" });
  }

  const type = parsed.type;
  const paymentStatus = parsed.data?.payment?.payment_status;
  const nextStatus = mapWebhookToStatus(type, paymentStatus);

  if (!nextStatus) {
    return NextResponse.json({ ok: true, note: "ignored event" });
  }

  const cfPaymentId = parsed.data?.payment?.cf_payment_id;
  const paymentIdStr = cfPaymentId != null ? String(cfPaymentId) : null;
  const webhookReceivedAt = new Date().toISOString();

  const admin = createServiceRoleClient();

  const { data: row, error: fetchErr } = await admin
    .from("subscriptions")
    .select("id, status, entitlement_id, target_plan")
    .eq("cashfree_order_id", orderId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[cashfree webhook] fetch subscription:", fetchErr.message);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  if (!row) {
    console.warn("[cashfree webhook] unknown order_id", orderId);
    return NextResponse.json({ ok: true });
  }

  if (row.status === "paid" && nextStatus === "paid") {
    return NextResponse.json({ ok: true });
  }

  if (row.status === "paid" && nextStatus !== "paid") {
    return NextResponse.json({ ok: true, note: "already paid" });
  }

  const patch: Record<string, string | null> = {
    status: nextStatus,
    webhook_type: type ?? null,
    webhook_received_at: webhookReceivedAt,
    updated_at: webhookReceivedAt,
  };
  if (paymentIdStr && nextStatus === "paid") {
    patch.cashfree_payment_id = paymentIdStr;
  }

  const { data: updatedRows, error: updErr } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    console.error("[cashfree webhook] update subscription:", updErr.message);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const wonPendingToThisStatus = !!(updatedRows && updatedRows.length > 0);

  if (nextStatus === "paid" && wonPendingToThisStatus) {
    const targetPlan = row.target_plan as "pro" | "max";
    if (row.entitlement_id && (targetPlan === "pro" || targetPlan === "max")) {
      const ful = await fulfillPaidInrSubscription(admin, {
        entitlementId: row.entitlement_id,
        targetPlan,
      });
      if (!ful.ok) {
        console.error("[cashfree webhook] fulfill subscription:", ful.message);
        const revertedAt = new Date().toISOString();
        await admin
          .from("subscriptions")
          .update({
            status: "pending",
            cashfree_payment_id: null,
            webhook_type: "fulfill_failed",
            webhook_received_at: revertedAt,
            updated_at: revertedAt,
          })
          .eq("id", row.id)
          .eq("status", "paid");
        return NextResponse.json({ error: "fulfillment failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
