import { redirect } from "next/navigation";
import { canAccessSubscriptionPricing, getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { CashfreeInrCheckoutButton } from "@/components/pricing/cashfree-inr-checkout-button";
import { CashfreeReturnBanner } from "@/components/pricing/cashfree-return-banner";
import { RazorpayUsdCheckoutButton } from "@/components/pricing/razorpay-usd-checkout-button";
import { PlanComparisonTables } from "@/components/pricing/plan-comparison-tables";
import {
  formatInr,
  formatIsoDateMedium,
  formatUsd,
  formatInrPaise,
  planTierDisplayName,
  PRICING_INR,
  PRICING_USD,
} from "@/lib/pricing/display";
import { computeInrCheckoutTotals, INR_GST_CHECKOUT_NOTE } from "@/lib/pricing/inr-checkout-tax";
import type { PlanTier } from "@/types/database";

function DisabledCheckoutCue({ variant, children }: { variant: "primary" | "secondary"; children: React.ReactNode }) {
  const title = "Checkout is available only when you are the subscription billing owner.";
  return variant === "primary" ? (
    <button type="button" disabled title={title} className={primaryButtonMd + " cursor-not-allowed opacity-70"}>
      {children}
    </button>
  ) : (
    <button
      type="button"
      disabled
      title={title}
      className="cursor-not-allowed rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] opacity-70"
    >
      {children}
    </button>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ cf_order_id?: string | string[] | undefined; rz_order_id?: string | string[] | undefined }>;
}) {
  const sp = (await searchParams) ?? {};
  const rawCfOrder = sp.cf_order_id;
  const cfOrderId =
    typeof rawCfOrder === "string" ? rawCfOrder.trim() : Array.isArray(rawCfOrder) ? rawCfOrder[0]?.trim() ?? "" : "";
  const rawRzOrder = sp.rz_order_id;
  const rzOrderId =
    typeof rawRzOrder === "string" ? rawRzOrder.trim() : Array.isArray(rawRzOrder) ? rawRzOrder[0]?.trim() ?? "" : "";

  const ctx = await getOrgContext();
  if (!ctx) return null;
  if (!canAccessSubscriptionPricing(ctx)) {
    redirect("/dashboard");
  }

  const isIndia = ctx.organization.commercial_region === "in";
  const subscriptionPlan: PlanTier = ctx.entitlement?.plan ?? ctx.organization.plan;
  const ownerForOrg = isAccountOwnerForActiveOrg(ctx);
  const canInrCheckout = isIndia && ownerForOrg;
  const canUsdCheckout = !isIndia && ownerForOrg;
  const periodEnd = ctx.entitlement?.plan_period_end ?? null;
  const periodStart = ctx.entitlement?.plan_period_start ?? null;
  const endLabel = formatIsoDateMedium(periodEnd);
  const startLabel = formatIsoDateMedium(periodStart);

  const inrProTotals = computeInrCheckoutTotals(PRICING_INR.pro.sale);
  const inrMaxTotals = computeInrCheckoutTotals(PRICING_INR.max.sale);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Pricing plans</h1>
      </div>

      {cfOrderId ? (
        <CashfreeReturnBanner orderId={cfOrderId} />
      ) : null}
      {rzOrderId ? (
        <CashfreeReturnBanner orderId={rzOrderId} />
      ) : null}

      <PlanComparisonTables />

      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Plan prices</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Paid plans: <strong>365 days</strong> from activation. Shown prices are introductory (50% off list).
        </p>
        {isIndia ? (
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{INR_GST_CHECKOUT_NOTE}</p>
        ) : null}

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Your subscription</h3>
          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            {planTierDisplayName(subscriptionPlan)} plan
          </p>
          {subscriptionPlan === "free" ? (
            <p className="mt-1 text-[var(--muted)]">
              No paid period on file — you are on Free limits. Upgrade when you need more companies, users, or
              watermark-free customer-facing documents.
            </p>
          ) : endLabel ? (
            <p className="mt-1 text-[var(--foreground)]">
              <span className="text-[var(--muted)]">Valid through </span>
              {endLabel}
              {startLabel ? (
                <span className="text-[var(--muted)]"> · started {startLabel}</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-[var(--muted)]">
              Paid plan is active. Exact renewal dates will show here once billing is connected.
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">
            {canInrCheckout ? (
              <>
                Pay in INR via Cashfree payment gateway (cards, UPI, net banking). Prices are before 18% GST — you
                confirm the exact amount inclusive of GST before the Cashfree screen opens. After payment, your plan
                updates once our server confirms it — usually within a minute.
              </>
            ) : canUsdCheckout ? (
              <>
                Pay in USD via Razorpay (international cards). The confirmation step shows your exact annual amount
                (USD) before Checkout opens. After payment, your plan updates once our server confirms it — usually
                within a minute.
              </>
            ) : isIndia ? (
              <>
                INR checkout is only available when you are the billing owner for this company. Company admins can view
                prices but cannot complete payment on behalf of the owner.
              </>
            ) : (
              <>
                International (USD) checkout is only available when you are the billing owner for this company. Company
                admins can view prices but cannot complete payment on behalf of the owner.
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canInrCheckout ? (
              subscriptionPlan === "free" ? (
                <>
                  <CashfreeInrCheckoutButton targetPlan="pro">Upgrade to Pro</CashfreeInrCheckoutButton>
                  <CashfreeInrCheckoutButton targetPlan="max">Upgrade to Max</CashfreeInrCheckoutButton>
                </>
              ) : subscriptionPlan === "pro" ? (
                <>
                  <CashfreeInrCheckoutButton targetPlan="pro">Extend Pro</CashfreeInrCheckoutButton>
                  <CashfreeInrCheckoutButton targetPlan="max" variant="secondary">
                    Upgrade to Max
                  </CashfreeInrCheckoutButton>
                </>
              ) : (
                <CashfreeInrCheckoutButton targetPlan="max">Extend Max</CashfreeInrCheckoutButton>
              )
            ) : canUsdCheckout ? (
              subscriptionPlan === "free" ? (
                <>
                  <RazorpayUsdCheckoutButton targetPlan="pro" ownerEmail={ctx.userEmail}>
                    Upgrade to Pro
                  </RazorpayUsdCheckoutButton>
                  <RazorpayUsdCheckoutButton targetPlan="max" ownerEmail={ctx.userEmail}>
                    Upgrade to Max
                  </RazorpayUsdCheckoutButton>
                </>
              ) : subscriptionPlan === "pro" ? (
                <>
                  <RazorpayUsdCheckoutButton targetPlan="pro" ownerEmail={ctx.userEmail}>
                    Extend Pro
                  </RazorpayUsdCheckoutButton>
                  <RazorpayUsdCheckoutButton targetPlan="max" variant="secondary" ownerEmail={ctx.userEmail}>
                    Upgrade to Max
                  </RazorpayUsdCheckoutButton>
                </>
              ) : (
                <RazorpayUsdCheckoutButton targetPlan="max" ownerEmail={ctx.userEmail}>
                  Extend Max
                </RazorpayUsdCheckoutButton>
              )
            ) : subscriptionPlan === "free" ? (
              <>
                <DisabledCheckoutCue variant="primary">Upgrade to Pro</DisabledCheckoutCue>
                <DisabledCheckoutCue variant="primary">Upgrade to Max</DisabledCheckoutCue>
              </>
            ) : subscriptionPlan === "pro" ? (
              <>
                <DisabledCheckoutCue variant="primary">Extend Pro</DisabledCheckoutCue>
                <DisabledCheckoutCue variant="secondary">Upgrade to Max</DisabledCheckoutCue>
              </>
            ) : (
              <DisabledCheckoutCue variant="primary">Extend Max</DisabledCheckoutCue>
            )}
          </div>
        </div>

        <ul className="mt-6 space-y-3 text-sm">
          <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <span className="font-medium">Free</span>
            <span>Free</span>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <span className="font-medium">Pro</span>
            <span>
              {isIndia ? (
                <>
                  <span className="text-[var(--muted)] line-through">{formatInr(PRICING_INR.pro.list)}</span>{" "}
                  <span className="text-lg font-semibold text-[var(--foreground)]">{formatInr(PRICING_INR.pro.sale)}</span>
                  <span className="text-[var(--muted)]"> / year</span>
                  <span className="ml-2 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    50% off
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    Total with 18% GST: {formatInrPaise(inrProTotals.totalInr)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[var(--muted)] line-through">{formatUsd(PRICING_USD.pro.list)}</span>{" "}
                  <span className="text-lg font-semibold text-[var(--foreground)]">{formatUsd(PRICING_USD.pro.sale)}</span>
                  <span className="text-[var(--muted)]"> / year</span>
                  <span className="ml-2 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    50% off
                  </span>
                </>
              )}
            </span>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <span className="font-medium">Max</span>
            <span>
              {isIndia ? (
                <>
                  <span className="text-[var(--muted)] line-through">{formatInr(PRICING_INR.max.list)}</span>{" "}
                  <span className="text-lg font-semibold text-[var(--foreground)]">{formatInr(PRICING_INR.max.sale)}</span>
                  <span className="text-[var(--muted)]"> / year</span>
                  <span className="ml-2 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    50% off
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    Total with 18% GST: {formatInrPaise(inrMaxTotals.totalInr)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[var(--muted)] line-through">{formatUsd(PRICING_USD.max.list)}</span>{" "}
                  <span className="text-lg font-semibold text-[var(--foreground)]">{formatUsd(PRICING_USD.max.sale)}</span>
                  <span className="text-[var(--muted)]"> / year</span>
                  <span className="ml-2 rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    50% off
                  </span>
                </>
              )}
            </span>
          </li>
        </ul>
        {isIndia ? (
          <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
            Already on <strong className="text-[var(--foreground)]">Pro</strong> and want to move to{" "}
            <strong className="text-[var(--foreground)]">Max</strong>? We’ve got you covered: you get a pro-rata discount
            for your remaining Pro plan days. After payment, you’ll be upgraded to Max plan for one year. Your exact
            total (including 18% GST) appears in the confirmation step before Cashfree checkout. If your remaining Pro
            credit is worth the full Max price or more, checkout is not available — email{" "}
            <a href="mailto:eazmybiz@televers.com" className="font-medium text-sky-600 underline hover:text-sky-700">
              eazmybiz@televers.com
            </a>{" "}
            to upgrade.
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
            Already on <strong className="text-[var(--foreground)]">Pro</strong> and want to move to{" "}
            <strong className="text-[var(--foreground)]">Max</strong>? We’ve got you covered: you get a pro-rata discount
            for your remaining Pro plan days. After payment, you’ll be upgraded to Max plan for one year. Your exact
            total appears in the confirmation step before Razorpay checkout. If your remaining Pro credit is worth the
            full Max price or more, checkout is not available — email{" "}
            <a href="mailto:eazmybiz@televers.com" className="font-medium text-sky-600 underline hover:text-sky-700">
              eazmybiz@televers.com
            </a>{" "}
            to upgrade.
          </p>
        )}
      </div>

      <div className="rounded-lg border-2 border-sky-500/40 bg-sky-500/5 px-4 py-4 dark:border-sky-400/30 dark:bg-sky-500/10">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Enterprise / self-hosted</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Dedicated or customer-hosted deployment, custom limits, and security alignment. Not part of standard online
          checkout.
        </p>
        <p className="mt-3 text-sm text-[var(--foreground)]">
          Contact{" "}
          <a href="mailto:eazmybiz@televers.com" className="font-medium text-sky-600 underline hover:text-sky-700">
            eazmybiz@televers.com
          </a>{" "}
          to discuss Enterprise options.
        </p>
      </div>
    </div>
  );
}
