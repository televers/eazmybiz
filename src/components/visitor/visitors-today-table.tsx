"use client";

import Link from "next/link";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import type { VisitorListRow } from "@/lib/visitors/list-groups";
import {
  isCheckedInOverdueNoCheckout,
  visitorOverdueRowClassName,
} from "@/lib/visitors/check-in-overdue";
import { VisitorsTodayCheckInOutCell } from "@/components/visitor/visitors-today-check-cell";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";

export function VisitorsTodayTable({
  rows,
  emptyMessage,
  canRecordVisitorCheckpoint,
  orgTodayYmd,
  orgCalendarTzLabel,
}: {
  rows: VisitorListRow[];
  emptyMessage: string;
  canRecordVisitorCheckpoint: boolean;
  /** Organization calendar “today” (YYYY-MM-DD), not the user’s browser zone. */
  orgTodayYmd: string;
  /** IANA or short label for check-in messaging (organization calendar). */
  orgCalendarTzLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full text-left text-sm">
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
          {rows.map((r) => {
            const listDate = formatDateDdMmYyyy(String(r.visit_date).slice(0, 10));
            const company = r.visitor_company?.trim() || "—";
            const host = r.host_name?.trim() || "—";
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
                <td className="px-4 py-3 align-top">
                  <VisitorsTodayCheckInOutCell
                    row={r}
                    canRecordVisitorCheckpoint={canRecordVisitorCheckpoint}
                    orgTodayYmd={orgTodayYmd}
                    orgCalendarTzLabel={orgCalendarTzLabel}
                  />
                </td>
                <td className="px-2 py-3 text-right align-top">
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
          {!rows.length ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={9}>
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
