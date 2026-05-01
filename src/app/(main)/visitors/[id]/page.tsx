import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { getOrgContext } from "@/lib/org";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { formatDateTimeIst } from "@/lib/packing/date-format";
import { signedVisitorPhotoUrl } from "@/lib/visitors/visitor-photo-signed-url";
import { VisitorDraftForm } from "@/components/visitor/visitor-draft-form";
import { VisitorPhotoField } from "@/components/visitor/visitor-photo-field";
import { isCheckedInOverdueNoCheckout } from "@/lib/visitors/check-in-overdue";
import { getOrgCheckpointFlags, canRecordVisitorCheckpoint } from "@/lib/access/checkpoints";
import { VisitorActions } from "./ui";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { VisitorGateDeskPanel } from "@/components/visitor/visitor-gate-desk-panel";
import { ScrollToVisitorGate } from "@/components/visitor/scroll-to-visitor-gate";
import {
  isVisitorVisitDateOrgToday,
  isVisitorVisitDateStrictlyFuture,
  orgVisitorVisitDatePickerBounds,
} from "@/lib/visitors/visit-date-policy";
import { orgCalendarTodayYmd, orgCalendarTimezoneShortLabel } from "@/lib/dates/org-calendar";

export default async function VisitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ gate?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const gateFocus =
    sp.gate === "1" || sp.gate === "true" || String(sp.gate ?? "").toLowerCase() === "yes";
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("visitor_visits")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const r = row as {
    status: string;
    doc_number: string;
    visit_date: string;
    visitor_name: string;
    visitor_mobile?: string | null;
    visitor_company?: string | null;
    purpose?: string | null;
    host_name?: string | null;
    vehicle_reg?: string | null;
    driver_name?: string | null;
    photo_storage_path?: string | null;
    issued_at?: string | null;
    checked_in_at?: string | null;
    checked_out_at?: string | null;
    created_by_display_name?: string | null;
  };

  const powered = poweredByLine(ctx.organization.plan);
  const photoUrl = await signedVisitorPhotoUrl(supabase, r.photo_storage_path);
  const checkInOverdue = isCheckedInOverdueNoCheckout(r);
  const checkpointFlags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canRecordCheckpoint = canRecordVisitorCheckpoint(ctx, checkpointFlags);
  const visitBounds = orgVisitorVisitDatePickerBounds(ctx);
  const orgTodayYmd = orgCalendarTodayYmd(ctx.organization);
  const orgTzLabel = orgCalendarTimezoneShortLabel(ctx.organization);
  const showCheckInGate = r.status === "issued" && isVisitorVisitDateOrgToday(r.visit_date, ctx);
  const visitorPhotoCanEdit =
    r.status === "draft" ||
    (r.status === "issued" && isVisitorVisitDateStrictlyFuture(r.visit_date, ctx)) ||
    (showCheckInGate && canRecordCheckpoint);
  const visitorPhotoHint =
    showCheckInGate && canRecordCheckpoint
      ? "Add or replace before check-in if the pass should show a photo at the gate."
      : null;

  return (
    <div className="space-y-6">
      <ScrollToVisitorGate active={gateFocus && showCheckInGate} />
      <div>
        <Link href="/visitors" className="text-sm text-sky-600 underline">
          ← Visitors
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{r.doc_number}</h1>
            <p className="mt-1 text-sm capitalize text-[var(--muted)]">
              {String(r.status).replace("_", " ")}
            </p>
          </div>
          <VisitorActions
            id={id}
            status={r.status as "draft" | "issued" | "checked_in" | "checked_out"}
            visitDateYmd={String(r.visit_date).slice(0, 10)}
            orgTodayYmd={orgTodayYmd}
            orgCalendarTzLabel={orgTzLabel}
            canRecordVisitorCheckpoint={canRecordCheckpoint}
            checkedInAtIso={r.checked_in_at ?? null}
          />
        </div>
      </div>

      {checkInOverdue ? (
        <p
          className="rounded-md border border-red-600 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200"
          role="status"
        >
          Checked in more than 24 hours ago and not checked out yet — follow up with security or the host.
        </p>
      ) : null}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Visit date</dt>
            <dd>{formatDateDdMmYyyy(String(r.visit_date).slice(0, 10))}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Visitor</dt>
            <dd>{r.visitor_name}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Mobile</dt>
            <dd>{r.visitor_mobile ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Company</dt>
            <dd>{r.visitor_company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Purpose</dt>
            <dd>{r.purpose ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Host</dt>
            <dd>{r.host_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Vehicle no.</dt>
            <dd>{r.vehicle_reg ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Driver</dt>
            <dd>{r.driver_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Created by</dt>
            <dd>{formatCreatedByLabel(r.created_by_display_name)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Issued</dt>
            <dd>{formatDateTimeIst(r.issued_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Check-in</dt>
            <dd>{formatDateTimeIst(r.checked_in_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Check-out</dt>
            <dd>{formatDateTimeIst(r.checked_out_at)}</dd>
          </div>
        </dl>

        {r.status === "draft" || (r.status === "issued" && isVisitorVisitDateStrictlyFuture(r.visit_date, ctx)) ? (
          <VisitorDraftForm
            visitId={id}
            minVisitDateYmd={visitBounds.minYmd}
            maxVisitDateYmd={visitBounds.maxYmd}
            calendarTzLabel={orgTzLabel}
            organizationCountryCode={ctx.organization.country_code ?? "IN"}
            billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
            formMode={r.status === "draft" ? "draft" : "issued_before_visit"}
            initial={{
              visit_date: String(r.visit_date).slice(0, 10),
              visitor_name: r.visitor_name,
              visitor_mobile: r.visitor_mobile ?? "",
              visitor_company: r.visitor_company ?? null,
              purpose: r.purpose ?? null,
              host_name: r.host_name ?? "",
              vehicle_reg: r.vehicle_reg ?? null,
              driver_name: r.driver_name ?? null,
            }}
          />
        ) : null}

        {showCheckInGate ? (
          <div
            id="visitor-gate-checkin"
            className="mt-4 scroll-mt-6 border-t border-[var(--border)] pt-4"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">Gate check-in</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Add vehicle, driver, and photo before checking-in.
            </p>
            {canRecordCheckpoint ? (
              <VisitorGateDeskPanel
                visitId={id}
                initialVehicleReg={r.vehicle_reg ?? null}
                initialDriverName={r.driver_name ?? null}
                photoUrl={photoUrl}
                photoHint={visitorPhotoHint}
              />
            ) : (
              <>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Someone with visitor desk access should record vehicle, driver, and photo, then check in from this
                  page.
                </p>
                <div className="mt-4">
                  <VisitorPhotoField
                    visitorId={id}
                    photoUrl={photoUrl}
                    canEdit={visitorPhotoCanEdit}
                    hint={visitorPhotoHint}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}

        {!showCheckInGate ? (
          <div className="mt-6">
            <VisitorPhotoField
              visitorId={id}
              photoUrl={photoUrl}
              canEdit={visitorPhotoCanEdit}
            />
          </div>
        ) : null}

        {r.status === "issued" && powered ? (
          <p className="mt-6 text-center text-xs text-[var(--muted)]">{powered}</p>
        ) : null}
      </div>
    </div>
  );
}
