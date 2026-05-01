"use client";

import { primaryButtonMd } from "@/lib/ui/primary-button";

type VisitorPrintPassToolbarProps = {
  /** Extra wrapper classes (e.g. margin). */
  className?: string;
  /** Show the short hint under the button. */
  showHint?: boolean;
};

/** Print control for visitor pass preview (hidden when printing). */
export function VisitorPrintPassToolbar({
  className = "",
  showHint = true,
}: VisitorPrintPassToolbarProps) {
  return (
    <div className={`flex flex-col items-center gap-2 print:hidden ${className}`.trim()}>
      <button type="button" onClick={() => window.print()} className={primaryButtonMd}>
        Print pass
      </button>
      {showHint ? (
        <p className="text-center text-[11px] text-[var(--muted)]">
          If the print dialog did not open automatically, use this button.
        </p>
      ) : null}
    </div>
  );
}
