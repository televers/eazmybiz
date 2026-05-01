import { redirect } from "next/navigation";
import { canAccessSubscriptionPricing, getOrgContext } from "@/lib/org";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { PlanComparisonTables } from "@/components/pricing/plan-comparison-tables";
import {
  formatInr,
  formatIsoDateMedium,
  formatUsd,
  planTierDisplayName,
  PRICING_INR,
  PRICING_USD,
} from "@/lib/pricing/display";
import type { PlanTier } from "@/types/database";

function BillingCtaButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title="Payment checkout will be available here soon."
      className={primaryButtonMd + " cursor-not-allowed opacity-70"}
    >
      {children}
    </button>
  );
}

function BillingSecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title="Payment checkout will be available here soon."
      className="cursor-not-allowed rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] opacity-70"
    >
      {children}
    </button>
  );
}

export default async function PricingPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  if (!canAccessSubscriptionPricing(ctx)) {
    redirect("/dashboard");
  }

  const isIndia = ctx.organization.commercial_region === "in";
  const subscriptionPlan: PlanTier = ctx.entitlement?.plan ?? ctx.organization.plan;
  const periodEnd = ctx.entitlement?.plan_period_end ?? null;
  const periodStart = ctx.entitlement?.plan_period_start ?? null;
  const endLabel = formatIsoDateMedium(periodEnd);
  const startLabel = formatIsoDateMedium(periodStart);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Pricing plans</h1>
      </div>

      <PlanComparisonTables />

      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Plan prices</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Paid plans: <strong>365 days</strong> from activation. Shown prices are introductory (50% off list).
        </p>

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
            Checkout is not wired up yet — buttons below are placeholders for the upcoming payment flow.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {subscriptionPlan === "free" ? (
              <>
                <BillingCtaButton>Upgrade to Pro</BillingCtaButton>
                <BillingCtaButton>Upgrade to Max</BillingCtaButton>
              </>
            ) : subscriptionPlan === "pro" ? (
              <>
                <BillingCtaButton>Extend Pro</BillingCtaButton>
                <BillingSecondaryButton>Upgrade to Max</BillingSecondaryButton>
              </>
            ) : (
              <BillingCtaButton>Extend Max</BillingCtaButton>
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
