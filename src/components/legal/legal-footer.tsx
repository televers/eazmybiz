import Link from "next/link";
import { PwaInstallBanner } from "@/components/marketing/pwa-install-banner";

type LegalFooterProps = {
  showPwaBanner?: boolean;
  /** Include tagline and Televers link. */
  showOperator?: boolean;
  className?: string;
};

export function LegalFooter({ showPwaBanner = false, showOperator = true, className = "" }: LegalFooterProps) {
  return (
    <footer
      className={`border-t border-[var(--border)] bg-[var(--background)] px-4 py-4 ${className}`.trim()}
    >
      {showPwaBanner ? (
        <div className="mb-4 border-b border-[var(--border)] pb-4">
          <PwaInstallBanner />
        </div>
      ) : null}
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-[var(--muted)]">
        <Link href="/terms" className="text-sky-600 hover:underline dark:text-sky-400">
          Terms &amp; Conditions
        </Link>
        <span aria-hidden className="text-[var(--border)]">
          ·
        </span>
        <Link href="/refund-policy" className="text-sky-600 hover:underline dark:text-sky-400">
          Refunds
        </Link>
        <span aria-hidden className="text-[var(--border)]">
          ·
        </span>
        <Link href="/privacy" className="text-sky-600 hover:underline dark:text-sky-400">
          Privacy Policy
        </Link>
      </nav>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--muted)]">
        Billing &amp; support:{" "}
        <a
          href="mailto:eazmybiz@televers.com"
          className="text-sky-600 underline hover:no-underline dark:text-sky-400"
        >
          eazmybiz@televers.com
        </a>
      </p>
      {showOperator ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--muted)]">
          Business documentation, simplified. Built with purpose by{" "}
          <a
            href="https://televers.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-600 underline hover:no-underline dark:text-sky-400"
          >
            Televers
          </a>
          .
        </p>
      ) : null}
      <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--muted)]">
        © 2026 Televers. All rights reserved.
      </p>
    </footer>
  );
}
