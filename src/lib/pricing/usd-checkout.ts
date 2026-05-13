import { PRICING_USD } from "./display";
import type { PlanTier } from "@/types/database";
import {
  istInclusiveCalendarDaysRemaining,
} from "@/lib/pricing/inr-checkout-tax";

function roundUsdCent(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Intl (USD): Pro → Max when remaining credit exceeds Max checkout — email support (same rule as INR). */
export const USD_PRO_MAX_CREDIT_COVERS_CHECKOUT_MESSAGE =
  "Your remaining Pro plan credit covers the full Max upgrade price, so there is nothing to pay through checkout. Please email eazmybiz@televers.com and we will complete your upgrade.";

/**
 * Pre-tax USD amount for Razorpay order (no VAT in-app). Mirrors INR pro-rata calendar (IST inclusive days).
 */
export function usdCheckoutSubtotal(params: {
  targetPlan: "pro" | "max";
  currentPlan: PlanTier;
  planPeriodEnd: string | null | undefined;
}): number {
  const { targetPlan, currentPlan, planPeriodEnd } = params;
  const PRO = PRICING_USD.pro.sale;
  const MAX = PRICING_USD.max.sale;

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
  const credit = roundUsdCent(proDaily * days);
  const net = roundUsdCent(MAX - credit);
  return Math.max(net, 0);
}

export type UsdProRataMeta = {
  daysRemainingIst: number;
  proUnusedValuePreTaxUsd: number;
  payablePreTaxUsd: number;
};

export function usdProMaxUpgradeQuoteMeta(planPeriodEnd: string | null | undefined): UsdProRataMeta | null {
  const days = istInclusiveCalendarDaysRemaining(planPeriodEnd);
  if (days <= 0) return null;

  const PRO = PRICING_USD.pro.sale;
  const MAX = PRICING_USD.max.sale;
  const proDaily = PRO / 365;
  const credit = roundUsdCent(proDaily * days);
  const payablePreTaxUsd = Math.max(roundUsdCent(MAX - credit), 0);
  return {
    daysRemainingIst: days,
    proUnusedValuePreTaxUsd: credit,
    payablePreTaxUsd,
  };
}

/** Razorpay Orders API: integer amount in currency subunits (USD cents). */
export function usdToRazorpaySubunit(amountUsd: number): number {
  return Math.round(amountUsd * 100);
}

export function razorpaySubunitToUsd(subunit: number): number {
  return Math.round(subunit) / 100;
}
