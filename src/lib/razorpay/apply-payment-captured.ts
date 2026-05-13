import type { SupabaseClient } from "@supabase/supabase-js";
import { fulfillPaidInrSubscription } from "@/lib/cashfree/fulfill-paid-inr-subscription";

export type RazorpayApplyCaptureResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "db_fetch" | "db_update" | "fulfill_failed"; message: string };

/**
 * Mark a Razorpay-backed subscription paid and run entitlement/org fulfillment.
 * Idempotent and safe under concurrent webhook + Standard Checkout verify.
 */
export async function applyRazorpayPaymentCaptured(
  admin: SupabaseClient,
  input: {
    rzOrderId: string;
    rzPaymentId: string;
    traceType: string;
    traceAtIso: string;
  },
): Promise<RazorpayApplyCaptureResult> {
  const { rzOrderId, rzPaymentId, traceType, traceAtIso } = input;

  const { data: row, error: fetchErr } = await admin
    .from("subscriptions")
    .select("id, status, entitlement_id, target_plan")
    .eq("razorpay_order_id", rzOrderId)
    .maybeSingle();

  if (fetchErr) return { ok: false, code: "db_fetch", message: fetchErr.message };
  if (!row) return { ok: false, code: "not_found", message: "unknown order" };

  if (row.status === "paid") {
    return { ok: true };
  }

  const patch = {
    status: "paid" as const,
    webhook_type: traceType,
    webhook_received_at: traceAtIso,
    updated_at: traceAtIso,
    ...(rzPaymentId ? { razorpay_payment_id: rzPaymentId } : {}),
  };

  const { data: updatedRows, error: updErr } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id");

  if (updErr) return { ok: false, code: "db_update", message: updErr.message };

  const wonPendingToPaid = !!(updatedRows && updatedRows.length > 0);

  if (wonPendingToPaid) {
    const targetPlan = row.target_plan as "pro" | "max";
    if (row.entitlement_id && (targetPlan === "pro" || targetPlan === "max")) {
      const ful = await fulfillPaidInrSubscription(admin, {
        entitlementId: row.entitlement_id,
        targetPlan,
      });
      if (!ful.ok) {
        const revertedAt = new Date().toISOString();
        await admin
          .from("subscriptions")
          .update({
            status: "pending",
            razorpay_payment_id: null,
            webhook_type: "fulfill_failed",
            webhook_received_at: revertedAt,
            updated_at: revertedAt,
          })
          .eq("id", row.id)
          .eq("status", "paid");
        return { ok: false, code: "fulfill_failed", message: ful.message };
      }
    }
  }

  return { ok: true };
}
