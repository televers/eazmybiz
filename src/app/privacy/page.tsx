import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocLayout } from "@/components/legal/legal-doc-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — eazmybiz",
  description: "How eazmybiz collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy" lastUpdated="3 May 2026">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">1. Who we are</h2>
        <p className="text-[var(--muted)]">
          This Privacy Policy describes how{" "}
          <strong className="text-[var(--foreground)]">Televers Networks Private Limited</strong> (“Televers Networks”,
          “we”, “us”), New Delhi, India, processes information in connection with the{" "}
          <strong className="text-[var(--foreground)]">eazmybiz</strong> portal (“Service”). Our approach is to collect
          only what we need to operate the Service, to protect it appropriately, and not to use your organization’s data
          for unrelated commercial purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">2. Information we process</h2>
        <p className="text-[var(--muted)]">
          We process information you and your organization provide when using the Service—for example account details
          (such as email), profile and company information, and business content you create in the application (such as
          documents and visitor or gate records). We also process limited technical data (such as logs and security
          signals) needed to run and protect the platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">3. How we use information</h2>
        <p className="text-[var(--muted)]">
          We use information to provide, maintain, and improve the Service; authenticate users; enforce security;
          comply with law; and communicate with you about the Service.{" "}
          <strong className="text-[var(--foreground)]">
            We do not sell your personal or organization data, and we do not use your data for third-party advertising or
            for unrelated commercial exploitation.
          </strong>{" "}
          Processing for our own legitimate operation of eazmybiz (hosting, billing where applicable, and support) is
          separate from any such use.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">4. Storage and security</h2>
        <p className="text-[var(--muted)]">
          Your data is stored using reputable cloud and database infrastructure providers, with industry-appropriate
          technical and organizational measures. No method of transmission or storage is completely secure; we work to
          safeguard information and will notify you of serious breaches where required by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">5. Access to your data</h2>
        <p className="text-[var(--muted)]">
          The Service is designed so that we do <strong className="text-[var(--foreground)]">not</strong> routinely
          browse or use the contents of your databases for our own purposes. In practice, your organization’s data is
          accessed by our systems only to the extent needed to deliver the Service (for example automated hosting,
          backups, and security monitoring).
        </p>
        <p className="text-[var(--muted)]">
          If access to your organization’s stored information is ever needed for support, planned maintenance, incident
          response, or legal compliance, we aim to rely on technical tools and policies that minimize exposure.{" "}
          <strong className="text-[var(--foreground)]">
            Where reasonably practicable, we will seek your organization’s awareness or consent before broader manual
            access for maintenance or support
          </strong>
          , except where delay would materially harm security, violate law, or frustrate a legal obligation. In
          emergencies we may act first and inform you promptly as allowed by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">6. Retention</h2>
        <p className="text-[var(--muted)]">
          We retain information for as long as your account is active and as needed to provide the Service, comply with
          law, resolve disputes, and enforce our agreements. Retention specifics may depend on your plan and deletion
          settings in the product.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">7. Sharing</h2>
        <p className="text-[var(--muted)]">
          We share information with subprocessors that help us run the Service (such as hosting and authentication
          providers) under appropriate agreements. We may disclose information if required by law or to protect rights,
          safety, and security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">8. International transfers</h2>
        <p className="text-[var(--muted)]">
          Infrastructure providers may process data in India or other countries where they operate. We take steps
          consistent with applicable law when data crosses borders.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">9. Your rights</h2>
        <p className="text-[var(--muted)]">
          Depending on applicable law (including Indian privacy law where relevant), you may have rights to access,
          correct, or delete certain personal data, or to object or limit processing. To exercise these rights, contact
          us through your organization’s administrator or the support channels we provide. We will respond within timeframes
          required by law where applicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">10. Changes</h2>
        <p className="text-[var(--muted)]">
          We may update this Privacy Policy from time to time. The “Last updated” date will change when we do.
          Continued use of the Service after updates constitutes acceptance where permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">11. Contact</h2>
        <p className="text-[var(--muted)]">
          Questions about this policy or our privacy practices may be directed to Televers Networks Private Limited,
          New Delhi, India, at{" "}
          <a
            href="mailto:eazmybiz@televers.com"
            className="text-sky-600 underline hover:no-underline dark:text-sky-400"
          >
            eazmybiz@televers.com
          </a>
          {" "}
          (<strong className="text-[var(--foreground)]">support</strong> and{" "}
          <strong className="text-[var(--foreground)]">billing</strong>), via the contact or support route published for
          the Service, or through your account’s administrators.
        </p>
      </section>

      <p className="pt-2 text-[var(--muted)]">
        See also our{" "}
        <Link href="/terms" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
          Terms &amp; Conditions
        </Link>
        {" "}
        and{" "}
        <Link href="/refund-policy" className="text-sky-600 underline hover:no-underline dark:text-sky-400">
          Cancellation &amp; Refund Policy
        </Link>
        .
      </p>
    </LegalDocLayout>
  );
}
