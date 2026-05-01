import Link from "next/link";
import { orgCalendarTodayYmd, orgCalendarTimezoneShortLabel } from "@/lib/dates/org-calendar";
import { orgVisitorVisitDatePickerBounds } from "@/lib/visitors/visit-date-policy";
import { getOrgContext } from "@/lib/org";
import { NewVisitorForm } from "./ui";

export default async function NewVisitorPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const defaultVisitDate = orgCalendarTodayYmd(ctx.organization);
  const visitBounds = orgVisitorVisitDatePickerBounds(ctx);
  const calendarTzLabel = orgCalendarTimezoneShortLabel(ctx.organization);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">New visitor</h1>
        <Link href="/visitors" className="shrink-0 text-sm text-sky-600 underline">
          ← Visitors
        </Link>
      </div>
      <NewVisitorForm
        defaultVisitDate={defaultVisitDate}
        minVisitDateYmd={visitBounds.minYmd}
        maxVisitDateYmd={visitBounds.maxYmd}
        calendarTzLabel={calendarTzLabel}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
      />
    </div>
  );
}
