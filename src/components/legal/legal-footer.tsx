import Link from "next/link";
import { PwaInstallBanner } from "@/components/marketing/pwa-install-banner";

type LegalFooterProps = {
  showPwaBanner?: boolean;
  /** Include operator line (Televers Networks). */
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
        <Link href="/privacy" className="text-sky-600 hover:underline dark:text-sky-400">
          Privacy Policy
        </Link>
      </nav>
      {showOperator ? (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--muted)]">
          eazmybiz is promoted by{" "}
          <span className="text-[var(--foreground)]">Televers Networks Private Limited</span>, New Delhi, India.
        </p>
      ) : null}
    </footer>
  );
}
