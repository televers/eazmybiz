import Link from "next/link";
import { orgGatePassPassDatePickerBounds } from "@/lib/gate-pass/gate-pass-date-policy";
import { getOrgContext } from "@/lib/org";
import { orgCalendarTimezoneShortLabel } from "@/lib/dates/org-calendar";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { NewGatePassForm } from "./ui";

export default async function NewGatePassPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgGatePassPassDatePickerBounds(ctx);
  const calendarTzLabel = orgCalendarTimezoneShortLabel(ctx.organization);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">New material gate pass</h1>
        <Link
          href="/gate-passes"
          className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-sky-600 hover:bg-sky-500/10 hover:underline"
        >
          ← List
        </Link>
      </div>
      <p className="text-xs text-[var(--muted)]">Draft first, then issue.</p>
      <NewGatePassForm
        parties={parties}
        minPassDateYmd={docBounds.minYmd}
        maxPassDateYmd={docBounds.maxYmd}
        calendarTzLabel={calendarTzLabel}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
      />
    </div>
  );
}
