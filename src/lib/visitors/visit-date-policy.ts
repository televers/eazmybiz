import { civilYmdAddDays } from "@/lib/dates/ist-calendar";
import {
  orgCalendarTodayYmd,
  orgCalendarTimezoneShortLabel,
} from "@/lib/dates/org-calendar";
import type { FullOrgContext } from "@/lib/org-context-types";

/** Max calendar days after org “today” for a visitor pass visit date (picker + server). */
export const VISITOR_VISIT_MAX_FUTURE_DAYS = 15;

const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeVisitorVisitYmd(d: string | null | undefined): string | null {
  if (d == null || String(d).trim() === "") return null;
  const s = String(d).trim().slice(0, 10);
  if (!ISO_YMD.test(s)) return null;
  return s;
}

/** Visit date picker: org today through today + {@link VISITOR_VISIT_MAX_FUTURE_DAYS} (no backdating). */
export function orgVisitorVisitDatePickerBounds(ctx: FullOrgContext): { minYmd: string; maxYmd: string } {
  const today = orgCalendarTodayYmd(ctx.organization);
  return {
    minYmd: today,
    maxYmd: civilYmdAddDays(today, VISITOR_VISIT_MAX_FUTURE_DAYS),
  };
}

/** Visit date is strictly after organization “today” (issued pass may still be edited until the visit day). */
export function isVisitorVisitDateStrictlyFuture(visitDate: string | null | undefined, ctx: FullOrgContext): boolean {
  const d = normalizeVisitorVisitYmd(visitDate);
  if (!d) return false;
  return d > orgCalendarTodayYmd(ctx.organization);
}

/** Visit calendar day equals organization “today” (issued pass is in the check-in window). */
export function isVisitorVisitDateOrgToday(visitDate: string | null | undefined, ctx: FullOrgContext): boolean {
  const d = normalizeVisitorVisitYmd(visitDate);
  if (!d) return false;
  return d === orgCalendarTodayYmd(ctx.organization);
}

/** Draft create/update and issue (app layer): no past visit dates; future allowed up to cap. */
export function assertVisitorVisitDateForSave(visitDate: string | null | undefined, ctx: FullOrgContext): void {
  const d = normalizeVisitorVisitYmd(visitDate);
  if (!d) throw new Error("Visit date is required");
  const today = orgCalendarTodayYmd(ctx.organization);
  const tz = orgCalendarTimezoneShortLabel(ctx.organization);
  const maxYmd = civilYmdAddDays(today, VISITOR_VISIT_MAX_FUTURE_DAYS);
  if (d < today) {
    throw new Error(
      `Visitor passes cannot use a visit date before today in your organization calendar (${tz}).`,
    );
  }
  if (d > maxYmd) {
    throw new Error(
      `Visit date cannot be more than ${VISITOR_VISIT_MAX_FUTURE_DAYS} days after today (${tz}).`,
    );
  }
}
