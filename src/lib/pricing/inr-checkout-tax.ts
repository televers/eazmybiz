import { PRICING_INR } from "./display";
import type { PlanTier } from "@/types/database";

/** CGST + SGST / IGST effective rate on SaaS (India) for this checkout. */
export const INDIA_SUBSCRIPTION_GST_RATE = 0.18;

const MS_PER_DAY = 86_400_000;

function roundInrPaise(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calendar dates in Asia/Kolkata; inclusive count of days from today through `plan_period_end` (0 if ended/missing).
 * Used for Pro annual sale ÷ 365 daily value × days remaining.
 */
export function istInclusiveCalendarDaysRemaining(planPeriodEndIso: string | null | undefined): number {
  if (!planPeriodEndIso?.trim()) return 0;
  const endAt = new Date(planPeriodEndIso);
  if (Number.isNaN(endAt.getTime())) return 0;

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const endKey = fmt.format(endAt);
  const todayKey = fmt.format(new Date());
  if (endKey < todayKey) return 0;

  const [ey, em, ed] = endKey.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const startUtc = Date.UTC(ty, tm - 1, td);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((endUtc - startUtc) / MS_PER_DAY) + 1;
}

/**
 * Pro → Max: remaining Pro value fully covers the Max annual sale — no payable amount for self-serve checkout.
 */
export const INR_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE =
  "Your remaining Pro plan credit covers the full Max upgrade price, so there is nothing to pay through checkout. Please email eazmybiz@televers.com and we will complete your upgrade.";

/**
 * Pre-tax INR amount for Cashfree order (before 18% GST). Pro → Max uses pro-rata credit for unused Pro days
 * (annual Pro sale ÷ 365 × IST calendar days left), clamped at zero — never negative.
 */
export function inrPreTaxCheckoutSubtotal(params: {
  targetPlan: "pro" | "max";
  currentPlan: PlanTier;
  planPeriodEnd: string | null | undefined;
}): number {
  const { targetPlan, currentPlan, planPeriodEnd } = params;
  const PRO = PRICING_INR.pro.sale;
  const MAX = PRICING_INR.max.sale;

  if (targetPlan === "pro") {
    return PRO;
  }

  if (currentPlan !== "pro") {
    return MAX;
  }

  const days = istInclusiveCalendarDaysRemaining(planPeriodEnd);
  if (days <= 0) {
    return MAX;
  }

  const proDaily = PRO / 365;
  const credit = roundInrPaise(proDaily * days);
  const net = roundInrPaise(MAX - credit);
  return Math.max(net, 0);
}

export function inrSubscriptionSubtotalForPlan(targetPlan: "pro" | "max"): number {
  return targetPlan === "pro" ? PRICING_INR.pro.sale : PRICING_INR.max.sale;
}

export type InrProRataMeta = {
  daysRemainingIst: number;
  proUnusedValuePreTaxInr: number;
  /** Max annual sale minus credit (may be negative if credit exceeds Max). */
  maxMinusCreditPreTaxInr: number;
  /** Pre-tax amount due for checkout after credit (zero if credit covers Max). */
  payablePreTaxInr: number;
};

/** Metadata for quote / UI when Pro → Max pro-rata applies (active period with days left). */
export function inrProMaxUpgradeQuoteMeta(planPeriodEnd: string | null | undefined): InrProRataMeta | null {
  const days = istInclusiveCalendarDaysRemaining(planPeriodEnd);
  if (days <= 0) return null;

  const PRO = PRICING_INR.pro.sale;
  const MAX = PRICING_INR.max.sale;
  const proDaily = PRO / 365;
  const credit = roundInrPaise(proDaily * days);
  const maxMinusCredit = roundInrPaise(MAX - credit);
  const payablePreTaxInr = Math.max(maxMinusCredit, 0);
  return {
    daysRemainingIst: days,
    proUnusedValuePreTaxInr: credit,
    maxMinusCreditPreTaxInr: maxMinusCredit,
    payablePreTaxInr,
  };
}

/** Pre-tax subtotal, GST component, and amount charged to Cashfree (subtotal + GST). */
export function computeInrCheckoutTotals(subtotalInr: number): {
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
} {
  const gstInr = Math.round(subtotalInr * INDIA_SUBSCRIPTION_GST_RATE * 100) / 100;
  const totalInr = Math.round((subtotalInr + gstInr) * 100) / 100;
  return { subtotalInr, gstInr, totalInr };
}

/** Shown on pricing and in checkout confirm. */
export const INR_GST_CHECKOUT_NOTE =
  "India (INR) prices below are the pre-tax sale amount. Checkout adds 18% GST; you’ll see the exact total before you pay.";

/** Block back-to-back attempts while a payment may still be settling. */
export const INR_CHECKOUT_RECENT_ATTEMPT_USER_MESSAGE =
  "You've tried a payment recently. If your payment got failed, you may try again. If your payment was successful, please wait for 5 minutes. If money got deducted but plan didn't active, you may write to us at eazmybiz@televers.com with your payment details.";
