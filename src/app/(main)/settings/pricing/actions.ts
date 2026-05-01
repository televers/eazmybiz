"use server";

/**
 * Reserved for payment + entitlement updates after checkout (e.g. Stripe, Razorpay).
 * Will set `organizations.plan`, `plan_period_*`, `commercial_region`, and sync `account_entitlements`.
 */
export async function applyPaidPlanAfterCheckoutSketch(
  _input: {
    plan: "pro" | "max";
    commercialRegion: "in" | "intl";
  },
): Promise<{ ok: false; message: string }> {
  void _input;
  return { ok: false, message: "Payment integration is not wired yet." };
}
