import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocLayout } from "@/components/legal/legal-doc-layout";

export const metadata: Metadata = {
  title: "Terms & Conditions — eazmybiz",
  description: "Terms and conditions for using the eazmybiz portal.",
};

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms & Conditions" lastUpdated="3 May 2026">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">1. Operator</h2>
        <p className="text-[var(--muted)]">
          The <strong className="text-[var(--foreground)]">eazmybiz</strong> web portal and related services (“Service”) are
          operated and promoted by{" "}
          <strong className="text-[var(--foreground)]">Televers Networks Private Limited</strong>, having its registered
          office in New Delhi, India (“we”, “us”, “our”). By accessing or using the Service, you agree to these Terms
          &amp; Conditions (“Terms”). If you do not agree, please do not use the Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">2. The Service</h2>
        <p className="text-[var(--muted)]">
          eazmybiz provides online tools for day-to-day business operations (such as documents, gate passes, and
          visitor management), subject to the features and limits of your plan. We may update, suspend, or discontinue
          parts of the Service with reasonable notice where practicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">3. Accounts and organizations</h2>
        <p className="text-[var(--muted)]">
          You are responsible for maintaining the confidentiality of your account credentials and for activity under
          your account. You represent that information you provide is accurate. Organizations using the Service remain
          responsible for their users’ compliance with these Terms and applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">4. Acceptable use</h2>
        <p className="text-[var(--muted)]">
          You agree not to misuse the Service (for example by attempting unauthorized access, interfering with other
          customers, or using the Service for unlawful purposes). We may suspend or terminate access for material
          breaches, where permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">5. Your content</h2>
        <p className="text-[var(--muted)]">
          You retain ownership of data and content you submit. You grant us a limited licence to host, process, and
          display it solely as needed to provide and secure the Service. See our{" "}
          <Link href="/privacy" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
            Privacy Policy
          </Link>{" "}
          for how we handle personal information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">6. Disclaimers</h2>
        <p className="text-[var(--muted)]">
          The Service is provided on an “as is” and “as available” basis to the fullest extent permitted by law. We do
          not warrant uninterrupted or error-free operation. You use the Service at your own risk regarding decisions you
          make based on information in the portal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">7. Limitation of liability</h2>
        <p className="text-[var(--muted)]">
          To the maximum extent permitted by applicable law, Televers Networks Private Limited and its affiliates will not
          be liable for indirect, incidental, special, consequential, or punitive damages, or loss of profits or data,
          arising from your use of the Service. Our aggregate liability for claims relating to the Service shall not
          exceed the amounts you paid us for the Service in the twelve (12) months before the claim (or, if none, a
          nominal amount as permitted by law).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">8. Changes</h2>
        <p className="text-[var(--muted)]">
          We may update these Terms from time to time. We will post the revised version on this page and update the
          “Last updated” date. Continued use after changes constitutes acceptance where permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">9. Governing law</h2>
        <p className="text-[var(--muted)]">
          These Terms are governed by the laws of India. Courts at New Delhi, India shall have exclusive jurisdiction,
          subject to mandatory provisions of applicable consumer or other law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">10. Contact</h2>
        <p className="text-[var(--muted)]">
          For questions about these Terms, <strong className="text-[var(--foreground)]">billing</strong>, or{" "}
          <strong className="text-[var(--foreground)]">support</strong>, email{" "}
          <a
            href="mailto:eazmybiz@televers.com"
            className="text-sky-600 underline hover:no-underline dark:text-sky-400"
          >
            eazmybiz@televers.com
          </a>
          , or reach us through the support channels indicated in the Service or via your account administrator’s contact
          with Televers Networks Private Limited.
        </p>
      </section>

      <p className="pt-2 text-[var(--muted)]">
        See also our{" "}
        <Link href="/refund-policy" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
          Cancellation &amp; Refund Policy
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
