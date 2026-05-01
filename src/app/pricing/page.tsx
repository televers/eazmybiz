import Link from "next/link";
import { headers } from "next/headers";
import { EazmybizLockupLogo } from "@/components/brand/eazmybiz-lockup-logo";
import { FloatingWhatsappCta } from "@/components/marketing/floating-whatsapp-cta";
import { LegalFooter } from "@/components/legal/legal-footer";
import { PlanComparisonTables } from "@/components/pricing/plan-comparison-tables";
import {
  formatInr,
  formatUsd,
  PRICING_INR,
  PRICING_USD,
  publicPricingAudienceFromHeaders,
} from "@/lib/pricing/display";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";

type AudienceMode = "in" | "intl" | "both";

function resolveAudience(billingParam: string | undefined, headerList: Headers): AudienceMode {
  const p = billingParam?.trim().toLowerCase();
  if (p === "in" || p === "inr") return "in";
  if (p === "intl" || p === "usd" || p === "global") return "intl";
  const inferred = publicPricingAudienceFromHeaders(headerList);
  if (inferred === "in") return "in";
  if (inferred === "intl") return "intl";
  return "both";
}

function FiftyBadge() {
  return (
    <span className="ml-2 inline-flex rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
      50% off
    </span>
  );
}

function AudiencePricingNote({ audience }: { audience: AudienceMode }) {
  if (audience === "in") {
    return (
      <p className="mt-6 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        The prices above are <strong className="font-medium text-[var(--foreground)]">India (INR)</strong> for visitors
        from India. This is for display only — your company&apos;s billing region is confirmed at checkout.{" "}
        <Link href="/pricing?billing=intl" className="font-medium text-sky-600 underline hover:text-sky-700">
          View international (USD) prices
        </Link>
        .
      </p>
    );
  }
  if (audience === "intl") {
    return (
      <p className="mt-6 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        The prices above are <strong className="font-medium text-[var(--foreground)]">international (USD)</strong>.
        Billing region is confirmed at checkout.{" "}
        <Link href="/pricing?billing=in" className="font-medium text-sky-600 underline hover:text-sky-700">
          View India (INR) prices
        </Link>
        .
      </p>
    );
  }
  return (
    <p className="mt-6 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
      We couldn&apos;t infer your country from the network (common on local dev or some VPNs). The India (INR) and
      international (USD) lists above are both shown; final amounts follow your company&apos;s billing region at
      checkout.{" "}
      <Link href="/pricing?billing=in" className="font-medium text-sky-600 underline hover:text-sky-700">
        INR only
      </Link>
      {" · "}
      <Link href="/pricing?billing=intl" className="font-medium text-sky-600 underline hover:text-sky-700">
        USD only
      </Link>
      .
    </p>
  );
}

export default async function PublicPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const audience = resolveAudience(sp.billing, h);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 [&_a]:outline-offset-4">
            <EazmybizLockupLogo className="scale-90 sm:scale-100" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)]">
              Pricing
            </span>
            <Link href="/login" className={secondarySkyButtonMd}>
              Login
            </Link>
            <Link href="/signup" className={primaryButtonMd + " inline-flex justify-center"}>
              Start for Free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pricing plans</h1>
        </div>

        <div className="mt-8">
          <PlanComparisonTables />
        </div>

        <div className="mt-10 space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Plan prices</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Paid plans: <strong>365 days</strong> from activation. Shown prices are introductory (50% off list).
            </p>

            {audience !== "intl" ? (
              <div className="mt-4">
                {audience === "both" ? (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">India (INR)</h3>
                ) : null}
                <ul className="mt-2 space-y-3 text-sm">
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Free</span>
                    <span>Free</span>
                  </li>
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Pro</span>
                    <span>
                      <span className="text-[var(--muted)] line-through">{formatInr(PRICING_INR.pro.list)}</span>{" "}
                      <span className="text-lg font-semibold text-[var(--foreground)]">
                        {formatInr(PRICING_INR.pro.sale)}
                      </span>
                      <span className="text-[var(--muted)]"> / year</span>
                      <FiftyBadge />
                    </span>
                  </li>
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Max</span>
                    <span>
                      <span className="text-[var(--muted)] line-through">{formatInr(PRICING_INR.max.list)}</span>{" "}
                      <span className="text-lg font-semibold text-[var(--foreground)]">
                        {formatInr(PRICING_INR.max.sale)}
                      </span>
                      <span className="text-[var(--muted)]"> / year</span>
                      <FiftyBadge />
                    </span>
                  </li>
                </ul>
              </div>
            ) : null}

            {audience !== "in" ? (
              <div className={audience === "both" ? "mt-8" : "mt-4"}>
                {audience === "both" ? (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    International (USD)
                  </h3>
                ) : null}
                <ul className="mt-2 space-y-3 text-sm">
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Free</span>
                    <span>Free</span>
                  </li>
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Pro</span>
                    <span>
                      <span className="text-[var(--muted)] line-through">{formatUsd(PRICING_USD.pro.list)}</span>{" "}
                      <span className="text-lg font-semibold text-[var(--foreground)]">
                        {formatUsd(PRICING_USD.pro.sale)}
                      </span>
                      <span className="text-[var(--muted)]"> / year</span>
                      <FiftyBadge />
                    </span>
                  </li>
                  <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
                    <span className="font-medium">Max</span>
                    <span>
                      <span className="text-[var(--muted)] line-through">{formatUsd(PRICING_USD.max.list)}</span>{" "}
                      <span className="text-lg font-semibold text-[var(--foreground)]">
                        {formatUsd(PRICING_USD.max.sale)}
                      </span>
                      <span className="text-[var(--muted)]"> / year</span>
                      <FiftyBadge />
                    </span>
                  </li>
                </ul>
              </div>
            ) : null}

            <AudiencePricingNote audience={audience} />
          </div>

          <div className="rounded-lg border-2 border-sky-500/40 bg-sky-500/5 px-4 py-4 dark:border-sky-400/30 dark:bg-sky-500/10">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Enterprise / self-hosted</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Dedicated or customer-hosted deployment, custom limits, and security alignment. Not part of standard online
              checkout.
            </p>
            <p className="mt-3 text-sm text-[var(--foreground)]">
              Contact{" "}
              <a
                href="mailto:eazmybiz@televers.com"
                className="font-medium text-sky-600 underline hover:text-sky-700"
              >
                eazmybiz@televers.com
              </a>{" "}
              to discuss Enterprise options.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-[var(--muted)]">
          After you create a company, the account owner and company admins can open{" "}
          <strong className="font-medium text-[var(--foreground)]">Settings → Pricing</strong> for subscription details
          and (when available) checkout.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          <Link href="/signup" className={primaryButtonMd + " inline-flex justify-center"}>
            Create your account
          </Link>
          <Link href="/login" className={secondarySkyButtonMd}>
            Login
          </Link>
          <Link href="/" className={secondarySkyButtonMd}>
            Back to home
          </Link>
        </div>
      </main>
      <LegalFooter showOperator className="mt-auto border-t border-[var(--border)]" />
      <FloatingWhatsappCta />
    </div>
  );
}
