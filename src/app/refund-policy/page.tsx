import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocLayout } from "@/components/legal/legal-doc-layout";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — eazmybiz",
  description: "Cancellation and refund policy for eazmybiz subscription and platform services.",
};

export default function RefundPolicyPage() {
  return (
    <LegalDocLayout title="Cancellation &amp; Refund Policy" lastUpdated="3 May 2026">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">1. Who this applies to</h2>
        <p className="text-[var(--muted)]">
          This policy applies to paid subscriptions and related fees for{" "}
          <strong className="text-[var(--foreground)]">eazmybiz</strong>, the business software service operated by{" "}
          <strong className="text-[var(--foreground)]">Televers Networks Private Limited</strong> (“we”, “us”), New Delhi,
          India. It covers cloud access to features such as quotations, packing lists, delivery challans, gate passes,
          visitor management, and related tools offered through the platform—not physical goods or third‑party marketplace
          orders.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">2. Free plan</h2>
        <p className="text-[var(--muted)]">
          The Free plan does not require payment. You may stop using the Service at any time; there are no fees to
          refund on the Free tier.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">3. Paid plans and billing</h2>
        <p className="text-[var(--muted)]">
          Paid tiers (for example Pro and Max) are billed according to the price, currency, and billing period shown at
          checkout or in your account once payment is connected. Taxes and charges may apply as stated at purchase. Until
          online billing is fully enabled in the product, any special commercial arrangements will be confirmed in
          writing (including start date, fees, and renewal).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">4. Cancellation</h2>
        <p className="text-[var(--muted)]">
          If you are <strong className="text-[var(--foreground)]">not satisfied</strong> with the paid services or the
          paid tier does not meet your expectations, you may{" "}
          <strong className="text-[var(--foreground)]">request cancellation</strong> of your paid plan or subscription{" "}
          <strong className="text-[var(--foreground)]">
            only within seven (7) calendar days
          </strong>{" "}
          from <strong className="text-[var(--foreground)]">paid plan activation</strong>—meaning the date your paid tier
          becomes active on your account (for example, when your qualifying payment succeeds and we apply Pro, Max, or
          another paid tier, or the start date confirmed in writing if billing is arranged outside the product).
        </p>
        <p className="text-[var(--muted)]">
          Requests received <strong className="text-[var(--foreground)]">after</strong> that 7‑day period are{" "}
          <strong className="text-[var(--foreground)]">not</strong> treated as cancellation‑on‑dissatisfaction under this
          policy (including for refund eligibility in section 5 for that reason). You may still have other options—such
          as turning off renewal through the Service or your payment provider when available—so the subscription does
          not continue past the current paid period, subject to our{" "}
          <Link href="/terms" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
            Terms &amp; Conditions
          </Link>{" "}
          and applicable law.
        </p>
        <p className="text-[var(--muted)]">
          To request cancellation within the 7‑day window, use the cancellation option in the Service when available, or
          contact us through the support or billing channel published for your account. We will confirm the request and
          explain what happens next, including when access to paid features ends.
        </p>
        <p className="text-[var(--muted)]">
          Where we accept a timely dissatisfaction cancellation, paid access usually ends as we agree in that process.
          In other cases, cancellation of renewal typically takes effect at the end of the current prepaid period unless
          applicable law or your agreement with us requires otherwise.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">5. Refunds</h2>
        <p className="text-[var(--muted)]">
          We may <strong className="text-[var(--foreground)]">issue a refund</strong> for eligible charges when you{" "}
          <strong className="text-[var(--foreground)]">cancel or ask us to cancel the paid tier</strong> because the
          services are <strong className="text-[var(--foreground)]">not suitable</strong> for you,{" "}
          <strong className="text-[var(--foreground)]">only if</strong> your request falls{" "}
          <strong className="text-[var(--foreground)]">within the 7‑day window</strong> in section 4 and is subject to{" "}
          <strong className="text-[var(--foreground)]">fair usage</strong>—ordinary business use in line with your plan
          and our Terms, without abuse (for example manipulating or over‑using the platform solely to claim a refund, or
          behaviour that breaches acceptable use). We also honour{" "}
          <strong className="text-[var(--foreground)]">mandatory rights</strong> under applicable law (including any
          statutory cooling‑off or consumer rules that apply to your purchase), regardless of that window.
        </p>
        <p className="text-[var(--muted)]">
          We may also refund where we confirm a <strong className="text-[var(--foreground)]">billing error</strong>,{" "}
          <strong className="text-[var(--foreground)]">duplicate charge</strong>, or a{" "}
          <strong className="text-[var(--foreground)]">technical failure on our side</strong> that materially prevented
          reasonable use during the period charged. Approved refunds are processed within the{" "}
          <strong className="text-[var(--foreground)]">stipulated time</strong> in section 7 below (after we approve the
          request—you may be asked for account details, invoice reference, or other reasonable information to verify your
          request).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">6. Disputes and chargebacks</h2>
        <p className="text-[var(--muted)]">
          Please contact us before initiating a chargeback or payment dispute where possible so we can review the charge.
          Chargebacks may result in suspension of the account until the matter is resolved.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">7. Refund processing time</h2>
        <p className="text-[var(--muted)]">
          When a refund is <strong className="text-[var(--foreground)]">approved</strong>, we will process it within the{" "}
          <strong className="text-[var(--foreground)]">stipulated time</strong>: we aim for the amount to reach you via
          your <strong className="text-[var(--foreground)]">original payment method</strong> within approximately{" "}
          <strong className="text-[var(--foreground)]">3–5 business days</strong> after approval. Banks and payment
          providers may add further delay; if so, that additional time is outside our direct control.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">8. Changes</h2>
        <p className="text-[var(--muted)]">
          We may update this policy from time to time. The “Last updated” date at the top will change when we do.
          Material changes will be posted on this page; where required by law, we will provide additional notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">9. Contact</h2>
        <p className="text-[var(--muted)]">
          For <strong className="text-[var(--foreground)]">cancellation</strong>,{" "}
          <strong className="text-[var(--foreground)]">refund</strong>,{" "}
          <strong className="text-[var(--foreground)]">billing</strong>, or{" "}
          <strong className="text-[var(--foreground)]">support</strong>, email Televers Networks Private Limited at{" "}
          <a
            href="mailto:eazmybiz@televers.com"
            className="text-sky-600 underline hover:no-underline dark:text-sky-400"
          >
            eazmybiz@televers.com
          </a>
          , or reach us through channels published for eazmybiz, or through your organization’s account administrator.
        </p>
      </section>

      <p className="pt-2 text-[var(--muted)]">
        See also our{" "}
        <Link href="/terms" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalDocLayout>
  );
}
