"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { visitorCheckOut } from "@/lib/visitors/actions";
import { canVisitorCheckOutNow } from "@/lib/visitors/check-in-overdue";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";
import type { VisitorStatus } from "@/types/database";

export function VisitorActions({
  id,
  status,
  visitDateYmd,
  orgTodayYmd,
  orgCalendarTzLabel,
  canRecordVisitorCheckpoint,
  checkedInAtIso,
}: {
  id: string;
  status: VisitorStatus;
  /** YYYY-MM-DD visit calendar day (organization calendar). */
  visitDateYmd: string;
  orgTodayYmd: string;
  orgCalendarTzLabel: string;
  canRecordVisitorCheckpoint: boolean;
  /** Set when status is checked_in — used for the 24h check-out window. */
  checkedInAtIso?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const visitYmd = visitDateYmd.trim().slice(0, 10);
  const ymdOk = /^\d{4}-\d{2}-\d{2}$/.test(visitYmd);
  const checkInBeforeVisitDay = ymdOk && visitYmd > orgTodayYmd;
  const checkInAfterVisitDay = ymdOk && visitYmd < orgTodayYmd;
  const checkoutAllowed =
    status !== "checked_in" || canVisitorCheckOutNow(checkedInAtIso ?? null);

  /** Normal print preview (lists, detail “Print pass”) — no post-check-in toolbar. */
  function openPrintPreviewOnly() {
    window.open(`/visitors/${id}/print`, "visitor-pass-print", "noopener,noreferrer");
  }

  async function run(
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setError(null);
    setLoading(key);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(
          res.error === "quota exceeded"
            ? "Monthly visitor pass quota reached."
            : (res.error ?? "Action failed"),
        );
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "checked_in" ? (
          <button type="button" onClick={openPrintPreviewOnly} className={secondarySkyButtonMd}>
            Print pass
          </button>
        ) : null}
        {status === "issued" && canRecordVisitorCheckpoint && !checkInBeforeVisitDay && !checkInAfterVisitDay ? (
          <p className="max-w-xs text-right text-xs text-[var(--muted)]">
            Use the <strong className="font-medium text-[var(--foreground)]">Gate check-in</strong> section below to add
            vehicle, driver, and photo, then <strong className="font-medium text-[var(--foreground)]">Check-in &amp;
            Print Pass</strong>.
          </p>
        ) : null}
        {status === "issued" && checkInBeforeVisitDay ? (
          <p className="max-w-xs text-right text-xs text-[var(--muted)]">
            Check-in is only available on the visit day ({orgCalendarTzLabel}).
          </p>
        ) : null}
        {status === "issued" && checkInAfterVisitDay ? (
          <p className="max-w-xs text-right text-xs text-amber-800 dark:text-amber-200">
            Visit day has passed — check-in is no longer available for this pass. Create a new visit if needed.
          </p>
        ) : null}
        {status === "issued" && !canRecordVisitorCheckpoint ? (
          <p className="max-w-xs text-right text-xs text-[var(--muted)]">
            Check-in is done at the visitor desk. Ask someone with visitor desk access.
          </p>
        ) : null}
        {status === "checked_in" && canRecordVisitorCheckpoint && checkoutAllowed ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => run("out", () => visitorCheckOut(id))}
            className={primaryButtonMd}
          >
            {loading === "out" ? "…" : "Collect pass & Check-out"}
          </button>
        ) : null}
        {status === "checked_in" && canRecordVisitorCheckpoint && !checkoutAllowed ? (
          <p className="max-w-xs text-right text-xs text-amber-800 dark:text-amber-200">
            The 24-hour check-out window after check-in has ended. Contact an administrator if the visitor is still on
            site.
          </p>
        ) : null}
        {status === "checked_in" && !canRecordVisitorCheckpoint ? (
          <p className="max-w-xs text-right text-xs text-[var(--muted)]">
            Check-out is done at the visitor desk.
          </p>
        ) : null}
      </div>
      {error ? <p className="max-w-xs text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
