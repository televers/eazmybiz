import Link from "next/link";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { VisitorsMonthlyPanel } from "@/components/visitor/visitors-monthly-panel";
import { VisitorsTodayTable } from "@/components/visitor/visitors-today-table";
import {
  effectiveOrgCalendarTimeZone,
  orgCalendarTodayYmd,
  orgCalendarYearMonth,
  orgCalendarTimezoneShortLabel,
} from "@/lib/dates/org-calendar";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { formatDateTimeIst } from "@/lib/packing/date-format";
import {
  isCheckedInOverdueNoCheckout,
  visitorOverdueRowClassName,
} from "@/lib/visitors/check-in-overdue";
import {
  groupVisitorRowsForList,
  type VisitorListRow,
} from "@/lib/visitors/list-groups";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";
import { getOrgCheckpointFlags, canRecordVisitorCheckpoint } from "@/lib/access/checkpoints";
import {
  documentListTableCardClassName,
  documentListTableClassName,
  documentListTableScrollAreaClassName,
} from "@/lib/ui/document-list-table";

function VisitorTable({
  rows,
  emptyMessage,
  orgTodayYmd,
}: {
  rows: VisitorListRow[];
  emptyMessage: string;
  orgTodayYmd: string;
}) {
  return (
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
          {rows.map((r) => {
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
                <td className="px-4 py-3 min-w-[12rem] whitespace-normal break-words text-[var(--muted)]">
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
    </div>
  );
}

function Section({
  title,
  description,
  rows,
  emptyHint,
  orgTodayYmd,
}: {
  title: string;
  description: string;
  rows: VisitorListRow[];
  emptyHint: string;
  orgTodayYmd: string;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
      </div>
      <VisitorTable rows={rows} emptyMessage={emptyHint} orgTodayYmd={orgTodayYmd} />
    </section>
  );
}

export default async function VisitorsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("visitor_visits")
    .select(
      "id, doc_number, visit_date, visitor_name, visitor_company, host_name, status, issued_at, checked_in_at, checked_out_at, created_at, created_by_display_name",
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false });

  const list = (rows ?? []) as VisitorListRow[];
  const orgTodayYmd = orgCalendarTodayYmd(ctx.organization);
  const orgYearMonth = orgCalendarYearMonth(ctx.organization);
  const orgTzLabel = orgCalendarTimezoneShortLabel(ctx.organization);
  const orgCalendarTimeZone = effectiveOrgCalendarTimeZone(ctx.organization);
  const { today, upcoming, recentCheckedOut, other } = groupVisitorRowsForList(list, ctx.organization);
  const checkpointFlags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canRecordCheckpoint = canRecordVisitorCheckpoint(ctx, checkpointFlags);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Visitors</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Keep track of who&apos;s visiting your place</p>
        </div>
        <Link
          href="/visitors/new"
          className={primaryButtonMd}
        >
          New visitor
        </Link>
      </div>

      {!list.length ? (
        <VisitorTable rows={[]} emptyMessage="No visitors yet." orgTodayYmd={orgTodayYmd} />
      ) : (
        <>
          <section className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold">Today</h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Passes with visit date today. Open <strong className="font-medium text-[var(--foreground)]">Check-in
                &amp; print</strong> to add gate details on the visit page, then check in and print there; use
                Collect pass &amp; Check-out when they leave. Timestamps appear after each step.
              </p>
            </div>
            <VisitorsTodayTable
              rows={today}
              emptyMessage="No visitors scheduled for today."
              canRecordVisitorCheckpoint={canRecordCheckpoint}
              orgTodayYmd={orgTodayYmd}
              orgCalendarTzLabel={orgTzLabel}
            />
          </section>
          <Section
            title="Upcoming (next 5 days)"
            description="Visit date is one of the next five calendar days after today."
            rows={upcoming}
            emptyHint="No upcoming visitors in this window."
            orgTodayYmd={orgTodayYmd}
          />
          <Section
            title="Checked out (previous 5 days)"
            description="Visitors who checked out during the five calendar days before today."
            rows={recentCheckedOut}
            emptyHint="No check-outs in this window."
            orgTodayYmd={orgTodayYmd}
          />
          {other.length ? (
            <Section
              title="Other visits"
              description="All other passes (later dates, open visits, or older history)."
              rows={other}
              emptyHint="—"
              orgTodayYmd={orgTodayYmd}
            />
          ) : null}
        </>
      )}

      <VisitorsMonthlyPanel
        rows={list}
        defaultYearMonth={orgYearMonth}
        orgCalendarTimeZone={orgCalendarTimeZone}
        orgTimeZoneShortLabel={orgTzLabel}
        orgTodayYmd={orgTodayYmd}
      />
    </div>
  );
}
