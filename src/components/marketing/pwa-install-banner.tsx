"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "eazmybiz_pwa_install_hint_dismissed";

export function PwaInstallBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-left text-sm dark:border-sky-500/25 dark:bg-sky-500/15 sm:px-5">
      <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="font-semibold text-[var(--foreground)]">Install eazmybiz as a web app</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
            Use it like a desktop or phone app: quick to open, stays signed in, and works offline for some actions once
            loaded.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
            <li>
              <strong className="font-medium text-[var(--foreground)]">Chrome / Edge (computer):</strong> look for the{" "}
              <strong>Install</strong> control in the address bar (install icon next to the bookmark star). Click it and
              confirm. If you don&apos;t see it, open the menu <span aria-hidden>(⋮)</span> → <strong>Install eazmybiz</strong>{" "}
              or <strong>Apps → Install this site as an app</strong>.
            </li>
            <li>
              <strong className="font-medium text-[var(--foreground)]">Android:</strong> Browser menu →{" "}
              <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
            <li>
              <strong className="font-medium text-[var(--foreground)]">iPhone / iPad (Safari):</strong> tap the{" "}
              <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
            </li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
        aria-label="Dismiss install hint"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
