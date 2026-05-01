import { revalidatePath } from "next/cache";
import { civilYmdAddDays } from "@/lib/dates/ist-calendar";
import {
  orgCalendarTodayYmd,
  orgCalendarTimezoneShortLabel,
  type OrgCalendarSource,
} from "@/lib/dates/org-calendar";
import { normalizeOptionalDocumentYmd } from "@/lib/documents/document-ymd";
import type { FullOrgContext } from "@/lib/org-context-types";
import { isAccountOwnerForActiveOrg } from "@/lib/org";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const DOCUMENT_BACKDATE_MAX_DAYS_REGULAR = 7;
export const DOCUMENT_BACKDATE_MAX_DAYS_ADMIN_OWNER = 30;

export { normalizeOptionalDocumentYmd } from "@/lib/documents/document-ymd";

export function maxDocumentBackdateDaysForUser(ctx: FullOrgContext): number {
  if (isAccountOwnerForActiveOrg(ctx) || ctx.membership.is_company_admin) {
    return DOCUMENT_BACKDATE_MAX_DAYS_ADMIN_OWNER;
  }
  return DOCUMENT_BACKDATE_MAX_DAYS_REGULAR;
}

/** Min/max YYYY-MM-DD for date inputs (organization calendar, not the user’s browser). */
export function orgDocumentDatePickerBounds(ctx: FullOrgContext): { minYmd: string; maxYmd: string } {
  const today = orgCalendarTodayYmd(ctx.organization);
  const maxDays = maxDocumentBackdateDaysForUser(ctx);
  return {
    minYmd: civilYmdAddDays(today, -maxDays),
    maxYmd: today,
  };
}

/**
 * Optional document / visit calendar date: null skips.
 * Enforces: not after org “today”; not more than N days before org “today”.
 */
/** Block only future calendar dates (e.g. when editing already-issued documents). */
export function assertOptionalDocumentYmdNotFuture(
  documentDate: string | null | undefined,
  ctx: FullOrgContext,
): void {
  const d = normalizeOptionalDocumentYmd(documentDate);
  if (!d) return;
  const today = orgCalendarTodayYmd(ctx.organization);
  if (d > today) {
    throw new Error(
      `Date cannot be after today in your organization calendar (${orgCalendarTimezoneShortLabel(ctx.organization)}).`,
    );
  }
}

export function assertOptionalDocumentDateWithinBackdatePolicy(
  documentDate: string | null | undefined,
  ctx: FullOrgContext,
): void {
  const d = normalizeOptionalDocumentYmd(documentDate);
  if (!d) return;
  const today = orgCalendarTodayYmd(ctx.organization);
  const tzLabel = orgCalendarTimezoneShortLabel(ctx.organization);

  if (d > today) {
    throw new Error(
      `Date cannot be after today in your organization calendar (${tzLabel}).`,
    );
  }

  const maxDays = maxDocumentBackdateDaysForUser(ctx);
  const minAllowed = civilYmdAddDays(today, -maxDays);
  if (d < minAllowed) {
    if (maxDays === DOCUMENT_BACKDATE_MAX_DAYS_REGULAR) {
      throw new Error(
        `Document date cannot be more than ${DOCUMENT_BACKDATE_MAX_DAYS_REGULAR} calendar days before today in your organization calendar (${tzLabel}).`,
      );
    }
    throw new Error(
      `Document date cannot be more than ${DOCUMENT_BACKDATE_MAX_DAYS_ADMIN_OWNER} calendar days before today in your organization calendar (${tzLabel}).`,
    );
  }
}

export function isDocumentDateBackdatedVsOrgToday(
  documentDate: string | null | undefined,
  org: OrgCalendarSource,
): boolean {
  const d = normalizeOptionalDocumentYmd(documentDate);
  if (!d) return false;
  return d < orgCalendarTodayYmd(org);
}

export function shouldLogDocumentBackdateEvent(
  prev: string | null | undefined,
  next: string | null | undefined,
  org: OrgCalendarSource,
  isCreate?: boolean,
): boolean {
  const n = normalizeOptionalDocumentYmd(next);
  if (!n || !isDocumentDateBackdatedVsOrgToday(n, org)) return false;
  if (isCreate) return true;
  const p = normalizeOptionalDocumentYmd(prev);
  return p !== n;
}

export async function notifyDocumentBackdateIfNeeded(opts: {
  ctx: FullOrgContext;
  prevDocumentDate: string | null | undefined;
  nextDocumentDate: string | null | undefined;
  docKind: "quotation" | "packing_list" | "delivery_challan";
  docNumber: string;
  isCreate?: boolean;
}): Promise<void> {
  if (
    !shouldLogDocumentBackdateEvent(
      opts.prevDocumentDate,
      opts.nextDocumentDate,
      opts.ctx.organization,
      opts.isCreate,
    )
  ) {
    return;
  }
  const n = normalizeOptionalDocumentYmd(opts.nextDocumentDate);
  if (!n) return;
  try {
    const admin = createServiceRoleClient();
    const label =
      opts.docKind === "quotation"
        ? "Quotation"
        : opts.docKind === "packing_list"
          ? "Packing list"
          : "Delivery challan";
    const tz = orgCalendarTimezoneShortLabel(opts.ctx.organization);
    await admin.from("organization_settings_activity").insert({
      organization_id: opts.ctx.organization.id,
      actor_user_id: opts.ctx.userId,
      summary: `${label} ${opts.docNumber}: backdated document date ${n} (${tz})`,
      detail: null,
    });
    revalidatePath("/settings/notifications");
    revalidatePath("/dashboard");
  } catch (e) {
    console.error("notifyDocumentBackdateIfNeeded", e);
  }
}
