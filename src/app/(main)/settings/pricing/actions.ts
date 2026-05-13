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
import { requireIntlCheckoutContext } from "@/app/(main)/settings/pricing/intl-checkout-gate";
import {
  usdCheckoutSubtotal,
  usdProMaxUpgradeQuoteMeta,
  USD_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE,
  usdToRazorpaySubunit,
} from "@/lib/pricing/usd-checkout";
import { getRazorpayPublishableKeyId, isRazorpayConfigured } from "@/lib/razorpay/config";
import { razorpayCreateOrder } from "@/lib/razorpay/create-order";

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

export type UsdCheckoutQuoteResult =
  | {
      ok: true;
      subtotalUsd: number;
      totalUsd: number;
      targetPlan: "pro" | "max";
      proRata?: {
        daysRemainingIst: number;
        unusedProCreditPreTaxUsd: number;
        payablePreTaxUsd: number;
      };
    }
  | { ok: false; message: string };

/** International (USD): quote for Razorpay (no VAT in checkout). Mirrors INR plan logic using `PRICING_USD`. */
export async function getUsdCheckoutQuote(targetPlan: "pro" | "max"): Promise<UsdCheckoutQuoteResult> {
  const g = await requireIntlCheckoutContext(targetPlan);
  if (!g.ok) return g;
  const { ctx } = g;
  const entitlement = ctx.entitlement;
  if (!entitlement) {
    return { ok: false, message: "Could not load subscription details for checkout." };
  }

  const subtotalUsd = usdCheckoutSubtotal({
    targetPlan,
    currentPlan: entitlement.plan,
    planPeriodEnd: entitlement.plan_period_end,
  });
  if (subtotalUsd <= 0) {
    return { ok: false, message: USD_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE };
  }

  let proRata:
    | { daysRemainingIst: number; unusedProCreditPreTaxUsd: number; payablePreTaxUsd: number }
    | undefined;
  if (targetPlan === "max" && entitlement.plan === "pro") {
    const meta = usdProMaxUpgradeQuoteMeta(entitlement.plan_period_end);
    if (meta) {
      proRata = {
        daysRemainingIst: meta.daysRemainingIst,
        unusedProCreditPreTaxUsd: meta.proUnusedValuePreTaxUsd,
        payablePreTaxUsd: meta.payablePreTaxUsd,
      };
    }
  }

  return { ok: true, subtotalUsd, totalUsd: subtotalUsd, targetPlan, proRata };
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
    payment_provider: "cashfree",
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

export type CreateRazorpayUsdOrderResult =
  | {
      ok: true;
      razorpayOrderId: string;
      razorpayKeyId: string;
      amountSubunit: number;
      currency: "USD";
      subscriptionId: string;
      subtotalUsd: number;
    }
  | { ok: false; message: string };

/**
 * USD (international): create Razorpay order + subscription row pending; Checkout uses `razorpayOrderId` + Key Id.
 */
export async function createRazorpayUsdSubscriptionOrder(
  targetPlan: "pro" | "max",
): Promise<CreateRazorpayUsdOrderResult> {
  if (process.env.NODE_ENV === "production" && !isRazorpayConfigured()) {
    return {
      ok: false,
      message:
        "USD payment is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server environment, and NEXT_PUBLIC_RAZORPAY_KEY_ID for Checkout.",
    };
  }

  const g = await requireIntlCheckoutContext(targetPlan);
  if (!g.ok) return g;
  const { ctx, supabase } = g;
  const entitlement = ctx.entitlement;
  if (!entitlement) {
    return { ok: false, message: "Could not load subscription details for checkout." };
  }

  const totalUsd = usdCheckoutSubtotal({
    targetPlan,
    currentPlan: entitlement.plan,
    planPeriodEnd: entitlement.plan_period_end,
  });
  if (totalUsd <= 0) {
    return { ok: false, message: USD_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE };
  }

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

  const email = (ctx.userEmail ?? "").trim();
  if (!email) {
    return { ok: false, message: "Your account does not have an email on file." };
  }

  const receipt = `eb${randomUUID().replace(/-/g, "")}`.slice(0, 40);
  const amountSubunit = usdToRazorpaySubunit(totalUsd);
  if (amountSubunit < 1) {
    return { ok: false, message: "Invalid payment amount." };
  }

  const rz = await razorpayCreateOrder({
    amountSubunit,
    currency: "USD",
    receipt,
    notes: {
      entitlement_id: entitlement.id,
      target_plan: targetPlan,
      user_id: ctx.userId,
    },
  });

  if (!rz.ok) {
    return { ok: false, message: rz.message };
  }

  const keyId = getRazorpayPublishableKeyId();
  if (!keyId) {
    return { ok: false, message: "Razorpay Key Id is missing (server or NEXT_PUBLIC_RAZORPAY_KEY_ID)." };
  }

  const subscriptionId = randomUUID();
  const { error: insErr } = await supabase.from("subscriptions").insert({
    id: subscriptionId,
    entitlement_id: entitlement.id,
    owner_user_id: ctx.userId,
    target_plan: targetPlan,
    payment_provider: "razorpay",
    order_subtotal_usd: totalUsd,
    order_amount_usd: totalUsd,
    currency: "USD",
    razorpay_order_id: rz.orderId,
    status: "pending",
  });

  if (insErr) {
    return { ok: false, message: insErr.message };
  }

  return {
    ok: true,
    razorpayOrderId: rz.orderId,
    razorpayKeyId: keyId,
    amountSubunit: rz.amountSubunit,
    currency: "USD",
    subscriptionId,
    subtotalUsd: totalUsd,
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

/** After payment redirect or modal: poll by Cashfree merchant order id or Razorpay `order_*` id until status settles. */
export async function getCashfreeOrderReturnStatus(orderId: string): Promise<CashfreeOrderReturnStatusResult> {
  const clean = orderId.trim();
  if (!clean) return { ok: false, message: "Missing order id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  let sub: {
    status: string;
    target_plan: string;
    entitlement_id: string;
  } | null = null;

  const byCf = await supabase
    .from("subscriptions")
    .select("status, target_plan, entitlement_id")
    .eq("cashfree_order_id", clean)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (byCf.error) return { ok: false, message: byCf.error.message };
  sub = byCf.data;

  if (!sub) {
    const byRz = await supabase
      .from("subscriptions")
      .select("status, target_plan, entitlement_id")
      .eq("razorpay_order_id", clean)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (byRz.error) return { ok: false, message: byRz.error.message };
    sub = byRz.data;
  }

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

