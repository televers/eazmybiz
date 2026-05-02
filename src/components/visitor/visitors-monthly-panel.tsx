"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { formatDateTimeIst } from "@/lib/packing/date-format";
import { calendarYmdFromDateInTimeZone } from "@/lib/dates/org-calendar";
import type { VisitorListRow } from "@/lib/visitors/list-groups";
import {
  isCheckedInOverdueNoCheckout,
  visitorOverdueRowClassName,
} from "@/lib/visitors/check-in-overdue";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";
import {
  documentListTableCardClassName,
  documentListTableClassName,
  documentListTableScrollAreaClassName,
} from "@/lib/ui/document-list-table";

export function VisitorsMonthlyPanel({
  rows,
  defaultYearMonth,
  orgCalendarTimeZone,
  orgTimeZoneShortLabel,
  orgTodayYmd,
}: {
  rows: VisitorListRow[];
  defaultYearMonth: string;
  /** IANA timezone for organization document calendar (not the viewer’s browser). */
  orgCalendarTimeZone: string;
  orgTimeZoneShortLabel: string;
  orgTodayYmd: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultYearMonth);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => String(r.visit_date).slice(0, 7) === month)
      .sort(
        (a, b) =>
          String(a.visit_date).localeCompare(String(b.visit_date)) ||
          String(a.doc_number).localeCompare(String(b.doc_number)),
      );
  }, [rows, month]);

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-8">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            const ymd = calendarYmdFromDateInTimeZone(new Date(), orgCalendarTimeZone);
            setMonth(ymd.slice(0, 7));
            setOpen(true);
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm hover:bg-[var(--border)]"
        >
          Show all
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">Month (visit date)</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              />
              <span className="text-[11px] text-[var(--muted)]">
                Visit month in organization calendar ({orgTimeZoneShortLabel})
              </span>
            </label>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--border)]"
            >
              Hide list
            </button>
          </div>

          <div className={documentListTableCardClassName}>
            <div className={documentListTableScrollAreaClassName}>
              <table className={documentListTableClassName}>
              <thead className="bg-[var(--card)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Pass no.</th>
                  <th className="px-4 py-3 font-medium">Visit date</th>
                  <th className="px-4 py-3 font-medium">Visitor</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Whom to meet</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created by</th>
                  <th className="px-4 py-3 font-medium">Check-in / check-out</th>
                  <th className="w-12 px-2 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const listDate = formatDateDdMmYyyy(String(r.visit_date).slice(0, 10));
                  const company = r.visitor_company?.trim() || "—";
                  const host = r.host_name?.trim() || "—";
                  const inOut = `${formatDateTimeIst(r.checked_in_at)} / ${formatDateTimeIst(r.checked_out_at)}`;
                  const overdue = isCheckedInOverdueNoCheckout(r);
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-[var(--border)] ${overdue ? visitorOverdueRowClassName : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/visitors/${r.id}`} className="text-sky-600 underline">
                          {r.doc_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{listDate}</td>
                      <td className="px-4 py-3">{r.visitor_name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{company}</td>
                      <td className="px-4 py-3">{host}</td>
                      <td className="px-4 py-3 capitalize">{String(r.status).replace("_", " ")}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {formatCreatedByLabel(r.created_by_display_name)}
                      </td>
                      <td className="min-w-[12rem] whitespace-normal break-words px-4 py-3 text-[var(--muted)]">
                        {inOut}
                      </td>
                      <td className="px-2 py-3 text-right align-middle">
                        <DocumentRowActionsMenu
                          kind="visitor"
                          documentId={r.id}
                          status={r.status}
                          visitorVisitDateYmd={String(r.visit_date).slice(0, 10)}
                          visitorCheckedInAt={r.checked_in_at}
                          visitorOrgTodayYmd={orgTodayYmd}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--muted)]" colSpan={9}>
                      No visitors with this visit month.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
