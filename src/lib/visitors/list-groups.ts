import { addDaysToIsoDate } from "@/lib/quotation/dates";
import {
  orgCalendarTodayYmd,
  orgCalendarYmdFromIsoTimestamp,
  type OrgCalendarSource,
} from "@/lib/dates/org-calendar";

export type VisitorListRow = {
  id: string;
  doc_number: string;
  visit_date: string;
  visitor_name: string;
  visitor_company: string | null;
  host_name: string | null;
  status: string;
  issued_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  /** Snapshot at create time; see `document_set_and_preserve_created_by`. */
  created_by_display_name: string | null;
};

export type VisitorListGroups = {
  today: VisitorListRow[];
  upcoming: VisitorListRow[];
  recentCheckedOut: VisitorListRow[];
  other: VisitorListRow[];
};

function byCreatedDesc(a: VisitorListRow, b: VisitorListRow): number {
  return String(b.created_at).localeCompare(String(a.created_at));
}

/**
 * Partition rows: today (visit date), next 5 days after today, check-outs in previous 5 org-calendar days, remainder.
 * `org` drives “today” and checkout-day bucketing (not the viewer’s browser timezone).
 */
export function groupVisitorRowsForList(rows: VisitorListRow[], org: OrgCalendarSource): VisitorListGroups {
  const todayYmd = orgCalendarTodayYmd(org);
  const upcomingEnd = addDaysToIsoDate(todayYmd, 5);
  const checkoutWindowStart = addDaysToIsoDate(todayYmd, -5);

  const today: VisitorListRow[] = [];
  const upcoming: VisitorListRow[] = [];
  const recentCheckedOut: VisitorListRow[] = [];
  const other: VisitorListRow[] = [];

  for (const r of rows) {
    const vd = String(r.visit_date).slice(0, 10);

    if (vd === todayYmd) {
      today.push(r);
      continue;
    }
    if (vd > todayYmd && vd <= upcomingEnd) {
      upcoming.push(r);
      continue;
    }

    const coYmd = orgCalendarYmdFromIsoTimestamp(r.checked_out_at, org);
    if (
      coYmd != null &&
      coYmd >= checkoutWindowStart &&
      coYmd < todayYmd
    ) {
      recentCheckedOut.push(r);
      continue;
    }

    other.push(r);
  }

  today.sort(byCreatedDesc);
  upcoming.sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)) || byCreatedDesc(a, b));
  recentCheckedOut.sort((a, b) => {
    const tb = b.checked_out_at ?? "";
    const ta = a.checked_out_at ?? "";
    return tb.localeCompare(ta);
  });
  other.sort(byCreatedDesc);

  return { today, upcoming, recentCheckedOut, other };
}
