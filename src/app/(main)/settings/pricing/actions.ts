"use server";

import { randomUUID } from "crypto";
import {
  computeInrCheckoutTotals,
  inrPreTaxCheckoutSubtotal,
  inrProMaxUpgradeQuoteMeta,
  INR_CHECKOUT_RECENT_ATTEMPT_USER_MESSAGE,
  INR_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE,
} from "@/lib/pricing/inr-checkout-tax";
import { createClient } from "@/lib/supabase/server";
import { getCashfreeSdkMode } from "@/lib/cashfree/config";
import { cashfreeCreateOrder } from "@/lib/cashfree/create-order";
import { normalizeIndianPhoneForCashfree } from "@/lib/cashfree/phone";
import { getServerOrigin } from "@/lib/auth/site-origin";
import { requireInrCheckoutContext } from "@/app/(main)/settings/pricing/inr-checkout-gate";

/**
 * Legacy stub — prefer Cashfree webhook fulfilment + `getCashfreeOrderReturnStatus` after checkout.
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

export type InrCheckoutQuoteResult =
  | {
      ok: true;
      subtotalInr: number;
      gstInr: number;
      totalInr: number;
      targetPlan: "pro" | "max";
      /** Present for active Pro → Max when the current period has days left (IST). */
      proRata?: {
        daysRemainingIst: number;
        unusedProCreditPreTaxInr: number;
        payablePreTaxInr: number;
      };
    }
  | { ok: false; message: string };

/** Pre-tax / GST / total for confirm UI (no Cashfree call). */
export async function getInrCheckoutQuote(targetPlan: "pro" | "max"): Promise<InrCheckoutQuoteResult> {
  const g = await requireInrCheckoutContext(targetPlan);
  if (!g.ok) return g;
  const { ctx } = g;
  const entitlement = ctx.entitlement;
  if (!entitlement) {
    return { ok: false, message: "Could not load subscription details for checkout." };
  }

  const subtotalInr = inrPreTaxCheckoutSubtotal({
    targetPlan,
    currentPlan: entitlement.plan,
    planPeriodEnd: entitlement.plan_period_end,
  });
  if (subtotalInr <= 0) {
    return { ok: false, message: INR_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE };
  }
  const { gstInr, totalInr } = computeInrCheckoutTotals(subtotalInr);

  let proRata:
    | { daysRemainingIst: number; unusedProCreditPreTaxInr: number; payablePreTaxInr: number }
    | undefined;
  if (targetPlan === "max" && entitlement.plan === "pro") {
    const meta = inrProMaxUpgradeQuoteMeta(entitlement.plan_period_end);
    if (meta) {
      proRata = {
        daysRemainingIst: meta.daysRemainingIst,
        unusedProCreditPreTaxInr: meta.proUnusedValuePreTaxInr,
        payablePreTaxInr: meta.payablePreTaxInr,
      };
    }
  }

  return { ok: true, subtotalInr, gstInr, totalInr, targetPlan, proRata };
}

export type CreateCashfreeOrderResult =
  | {
      ok: true;
      paymentSessionId: string;
      orderId: string;
      subscriptionId: string;
      cashfreeMode: "sandbox" | "production";
      subtotalInr: number;
      gstInr: number;
      totalInr: number;
    }
  | { ok: false; message: string };

/**
 * INR only: create Cashfree order + local subscription row, return payment session for Web Checkout.
 */
export async function createCashfreeSubscriptionOrder(
  targetPlan: "pro" | "max",
): Promise<CreateCashfreeOrderResult> {
  const g = await requireInrCheckoutContext(targetPlan);
  if (!g.ok) return g;
  const { ctx, supabase } = g;
  const entitlement = ctx.entitlement;
  if (!entitlement) {
    return { ok: false, message: "Could not load subscription details for checkout." };
  }

  const subtotalInr = inrPreTaxCheckoutSubtotal({
    targetPlan,
    currentPlan: entitlement.plan,
    planPeriodEnd: entitlement.plan_period_end,
  });
  if (subtotalInr <= 0) {
    return { ok: false, message: INR_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE };
  }
  const { gstInr, totalInr } = computeInrCheckoutTotals(subtotalInr);

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentBlock } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("owner_user_id", ctx.userId)
    .eq("entitlement_id", entitlement.id)
    .in("status", ["pending", "paid"])
    .gte("created_at", fiveMinAgo)
    .limit(1)
    .maybeSingle();

  if (recentBlock) {
    return { ok: false, message: INR_CHECKOUT_RECENT_ATTEMPT_USER_MESSAGE };
  }

  const phone = normalizeIndianPhoneForCashfree(ctx.organization.org_mobile ?? null);
  if (!phone) {
    return {
      ok: false,
      message:
        "Add a valid 10-digit company mobile number under Settings → Company so we can complete Cashfree checkout.",
    };
  }

  const email = (ctx.userEmail ?? "").trim();
  if (!email) {
    return { ok: false, message: "Your account does not have an email on file." };
  }

  const merchantOrderId = `eb${randomUUID().replace(/-/g, "")}`.slice(0, 45);
  const origin = await getServerOrigin();
  const returnUrl = `${origin}/settings/pricing?cf_order_id={order_id}`;

  const cf = await cashfreeCreateOrder({
    merchantOrderId,
    orderAmountInr: totalInr,
    customerId: `cust_${ctx.userId.replace(/-/g, "")}`.slice(0, 50),
    customerEmail: email,
    customerPhone: phone,
    returnUrl,
  });

  if (!cf.ok) {
    return { ok: false, message: cf.message };
  }

  const subscriptionId = randomUUID();
  const { error: insErr } = await supabase.from("subscriptions").insert({
    id: subscriptionId,
    entitlement_id: entitlement.id,
    owner_user_id: ctx.userId,
    target_plan: targetPlan,
    order_subtotal_inr: subtotalInr,
    order_gst_inr: gstInr,
    order_amount_inr: totalInr,
    currency: "INR",
    cashfree_order_id: merchantOrderId,
    payment_session_id: cf.paymentSessionId,
    status: "pending",
  });

  if (insErr) {
    return { ok: false, message: insErr.message };
  }

  return {
    ok: true,
    paymentSessionId: cf.paymentSessionId,
    orderId: merchantOrderId,
    subscriptionId,
    cashfreeMode: getCashfreeSdkMode(),
    subtotalInr,
    gstInr,
    totalInr,
  };
}

export type CashfreeOrderReturnStatusResult =
  | { ok: false; message: string }
  | {
      ok: true;
      status: "pending" | "paid" | "failed" | "cancelled" | "expired" | "user_dropped";
      targetPlan: "pro" | "max";
      planPeriodEnd: string | null;
    };

/** After Cashfree redirect: poll this (same cashfree_order_id / merchant order id) until status settles. */
export async function getCashfreeOrderReturnStatus(orderId: string): Promise<CashfreeOrderReturnStatusResult> {
  const clean = orderId.trim();
  if (!clean) return { ok: false, message: "Missing order id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("status, target_plan, entitlement_id")
    .eq("cashfree_order_id", clean)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (subErr) return { ok: false, message: subErr.message };
  if (!sub) return { ok: false, message: "We could not find that order for your account." };

  const { data: ent } = await supabase
    .from("account_entitlements")
    .select("plan_period_end")
    .eq("id", sub.entitlement_id as string)
    .maybeSingle();

  return {
    ok: true,
    status: sub.status as
      | "pending"
      | "paid"
      | "failed"
      | "cancelled"
      | "expired"
      | "user_dropped",
    targetPlan: sub.target_plan as "pro" | "max",
    planPeriodEnd: (ent as { plan_period_end?: string | null } | null)?.plan_period_end ?? null,
  };
}

