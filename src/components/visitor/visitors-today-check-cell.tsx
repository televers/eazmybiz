"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { visitorCheckOut } from "@/lib/visitors/actions";
import { canVisitorCheckOutNow } from "@/lib/visitors/check-in-overdue";
import { formatDateTimeIst } from "@/lib/packing/date-format";
import { primaryButtonXs, secondarySkyButtonXs } from "@/lib/ui/primary-button";
import type { VisitorListRow } from "@/lib/visitors/list-groups";

export function VisitorsTodayCheckInOutCell({
  row,
  canRecordVisitorCheckpoint,
  orgTodayYmd,
  orgCalendarTzLabel,
}: {
  row: VisitorListRow;
  canRecordVisitorCheckpoint: boolean;
  orgTodayYmd: string;
  orgCalendarTzLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
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
      const msg = e instanceof Error ? e.message : "Action failed";
      if (msg.includes("not allowed to check in visitors") || msg.includes("not allowed to check out visitors")) {
        setError("Only visitor-desk staff can do this.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(null);
    }
  }

  const st = row.status;

  if (st === "draft") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[var(--muted)]">Issue pass from detail</span>
        <Link href={`/visitors/${row.id}`} className={`inline-flex w-fit ${secondarySkyButtonXs}`}>
          Open
        </Link>
      </div>
    );
  }

  if (st === "checked_out") {
    return (
      <div className="space-y-0.5 text-[var(--muted)]">
        <div>In: {formatDateTimeIst(row.checked_in_at)}</div>
        <div>Out: {formatDateTimeIst(row.checked_out_at)}</div>
      </div>
    );
  }

  if (st === "checked_in") {
    if (!canRecordVisitorCheckpoint) {
      return (
        <div className="space-y-0.5 text-[var(--muted)]">
          <div>In: {formatDateTimeIst(row.checked_in_at)}</div>
          <p className="text-xs">Check-out is done at the visitor desk.</p>
        </div>
      );
    }
    const canOut = canVisitorCheckOutNow(row.checked_in_at);
    return (
      <div className="flex min-w-[10rem] flex-col gap-2">
        <div className="text-[var(--muted)]">In: {formatDateTimeIst(row.checked_in_at)}</div>
        {canOut ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => run("out", () => visitorCheckOut(row.id))}
            className={`w-fit ${primaryButtonXs}`}
          >
            {loading === "out" ? "…" : "Collect pass & Check-out"}
          </button>
        ) : (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            24-hour check-out window has ended — contact an admin if needed.
          </p>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (st === "issued") {
    const visitYmd = String(row.visit_date).slice(0, 10);
    const ymdOk = /^\d{4}-\d{2}-\d{2}$/.test(visitYmd);
    const beforeVisitDay = ymdOk && visitYmd > orgTodayYmd;
    const afterVisitDay = ymdOk && visitYmd < orgTodayYmd;

    if (!canRecordVisitorCheckpoint) {
      return (
        <div className="text-[var(--muted)]">
          <p>Not checked in yet.</p>
          <p className="mt-1 text-xs">Check-in is done at the visitor desk.</p>
        </div>
      );
    }
    if (beforeVisitDay) {
      return (
        <div className="text-[var(--muted)]">
          <p>Not checked in yet.</p>
          <p className="mt-1 text-xs">Check-in only on the visit day ({orgCalendarTzLabel}).</p>
        </div>
      );
    }
    if (afterVisitDay) {
      return (
        <div className="text-[var(--muted)]">
          <p>Not checked in yet.</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Visit day has passed — check-in no longer available.
          </p>
        </div>
      );
    }
    return (
      <div className="flex min-w-[10rem] flex-col gap-2">
        <div className="text-[var(--muted)]">Not checked in yet</div>
        <Link
          href={`/visitors/${row.id}?gate=1`}
          className={`inline-flex w-fit ${primaryButtonXs}`}
        >
          Check-in &amp; print
        </Link>
        <p className="text-[11px] leading-snug text-[var(--muted)]">
          Opens visit — fill gate details, then check in and print there.
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return <span className="text-[var(--muted)]">—</span>;
}
