import { civilYmdAddDays } from "@/lib/dates/ist-calendar";
import {
  orgCalendarTodayYmd,
  orgCalendarTimezoneShortLabel,
} from "@/lib/dates/org-calendar";
import type { FullOrgContext } from "@/lib/org-context-types";

/** Max calendar days after org “today” for material gate pass date (picker + server). */
export const GATE_PASS_PASS_DATE_MAX_FUTURE_DAYS = 15;

const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeGatePassPassYmd(d: string | null | undefined): string | null {
  if (d == null || String(d).trim() === "") return null;
  const s = String(d).trim().slice(0, 10);
  if (!ISO_YMD.test(s)) return null;
  return s;
}

/** Pass date picker: org today through today + {@link GATE_PASS_PASS_DATE_MAX_FUTURE_DAYS} (no backdating). */
export function orgGatePassPassDatePickerBounds(ctx: FullOrgContext): { minYmd: string; maxYmd: string } {
  const today = orgCalendarTodayYmd(ctx.organization);
  return {
    minYmd: today,
    maxYmd: civilYmdAddDays(today, GATE_PASS_PASS_DATE_MAX_FUTURE_DAYS),
  };
}

/** Draft create/update and issue (app layer): no past pass dates; future allowed up to cap. */
export function assertGatePassPassDateForSave(passDate: string | null | undefined, ctx: FullOrgContext): void {
  const d = normalizeGatePassPassYmd(passDate);
  if (!d) throw new Error("Pass date is required");
  const today = orgCalendarTodayYmd(ctx.organization);
  const tz = orgCalendarTimezoneShortLabel(ctx.organization);
  const maxYmd = civilYmdAddDays(today, GATE_PASS_PASS_DATE_MAX_FUTURE_DAYS);
  if (d < today) {
    throw new Error(
      `Material gate passes cannot use a pass date before today in your organization calendar (${tz}).`,
    );
  }
  if (d > maxYmd) {
    throw new Error(
      `Pass date cannot be more than ${GATE_PASS_PASS_DATE_MAX_FUTURE_DAYS} days after today (${tz}).`,
    );
  }
}

/** Organization calendar has reached the pass date (on or after). Required to issue or record movement. */
export function orgCalendarHasReachedGatePassDate(passDate: string | null | undefined, ctx: FullOrgContext): boolean {
  const d = normalizeGatePassPassYmd(passDate);
  if (!d) return false;
  const today = orgCalendarTodayYmd(ctx.organization);
  return today >= d;
}

/** Block issue until org “today” is on or after the pass date (drafts may use a future pass date). */
export function assertGatePassIssueAllowedOnPassDate(passDate: string | null | undefined, ctx: FullOrgContext): void {
  const d = normalizeGatePassPassYmd(passDate);
  if (!d) throw new Error("Pass date is required");
  const tz = orgCalendarTimezoneShortLabel(ctx.organization);
  if (!orgCalendarHasReachedGatePassDate(d, ctx)) {
    throw new Error(
      `You can save this as a draft, but it cannot be issued until the pass date (${d}, ${tz} calendar).`,
    );
  }
}

/** Block recording material movement before the pass date in the organization calendar. */
export function assertGatePassMaterialMovementAllowedOnPassDate(
  passDate: string | null | undefined,
  ctx: FullOrgContext,
): void {
  const d = normalizeGatePassPassYmd(passDate);
  if (!d) throw new Error("Pass date is required");
  const tz = orgCalendarTimezoneShortLabel(ctx.organization);
  if (!orgCalendarHasReachedGatePassDate(d, ctx)) {
    throw new Error(
      `Material movement can only be recorded on or after the pass date (${d}, ${tz} calendar).`,
    );
  }
}
