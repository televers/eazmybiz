import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import type { FullOrgContext } from "@/lib/org-context-types";
import { createClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/types/database";

/**
 * Shared eligibility for INR Cashfree checkout (quote + create order).
 */
export async function requireInrCheckoutContext(targetPlan: "pro" | "max"): Promise<
  | { ok: true; ctx: FullOrgContext; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; message: string }
> {
  const ctx = await getOrgContext();
  if (!ctx || !isAccountOwnerForActiveOrg(ctx)) {
    return { ok: false, message: "Only the account owner for this company can start checkout." };
  }
  if (!ctx.entitlement) {
    return { ok: false, message: "Could not load subscription details for checkout." };
  }
  if (ctx.organization.commercial_region !== "in") {
    return { ok: false, message: "INR checkout is only available for India-priced accounts." };
  }
  const current: PlanTier = ctx.entitlement.plan;
  if (current === "max" && targetPlan === "pro") {
    return { ok: false, message: "Downgrading from Max to Pro is not available in checkout." };
  }
  const supabase = await createClient();
  return { ok: true, ctx, supabase };
}
