import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { getOrgContext } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { GatePassDraftForm } from "@/components/gate-pass/gate-pass-draft-form";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { getOrgCheckpointFlags, canRecordMaterialMovement } from "@/lib/access/checkpoints";
import { RecordMaterialMovementButton } from "./ui";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import {
  orgCalendarHasReachedGatePassDate,
  orgGatePassPassDatePickerBounds,
} from "@/lib/gate-pass/gate-pass-date-policy";
import {
  canRecordMaterialMovementWithinIssueWindow,
  gatePassMovementOverdueRowClassName,
  isIssuedGatePassMovementPendingOver24h,
} from "@/lib/gate-pass/material-movement-windows";
import { orgCalendarTimezoneShortLabel } from "@/lib/dates/org-calendar";

type GatePassRow = {
  id: string;
  doc_number: string;
  document_date: string;
  direction: string;
  status: string;
  invoice_no: string | null;
  party_id: string | null;
  party_name: string | null;
  transport_name: string | null;
  lr_docket_no: string | null;
  hand_carried_name: string | null;
  hand_carried_mobile: string | null;
  vehicle_no: string | null;
  package_count: number | null;
  material_description: string | null;
  notes: string | null;
  issued_at: string | null;
  created_by_display_name: string | null;
  material_moved_at: string | null;
  material_moved_by_user_id: string | null;
};

export default async function GatePassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("gate_passes")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const r = row as GatePassRow;
  const powered = poweredByLine(ctx.organization.plan);
  const isDraft = r.status === "draft";
  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canRecordMovement = canRecordMaterialMovement(ctx, flags);
  const parties = isDraft ? await loadPartiesWithAddresses(ctx.organization.id) : [];
  const docBounds = orgGatePassPassDatePickerBounds(ctx);
  const calendarTzLabel = orgCalendarTimezoneShortLabel(ctx.organization);
  const passDateYmd = String(r.document_date ?? "").slice(0, 10);
  const passDateReached = orgCalendarHasReachedGatePassDate(passDateYmd, ctx);
  const movementOverdueHighlight =
    passDateReached &&
    isIssuedGatePassMovementPendingOver24h({
      status: r.status,
      issued_at: r.issued_at,
      material_moved_at: r.material_moved_at,
    });
  const canStillRecordMovementByTime =
    r.status === "issued" &&
    !r.material_moved_at &&
    passDateReached &&
    canRecordMaterialMovementWithinIssueWindow(r.issued_at);
  const recordWindowClosed =
    r.status === "issued" &&
    !r.material_moved_at &&
    passDateReached &&
    !canStillRecordMovementByTime &&
    r.issued_at;
  const movementBlockedUntilPassDate =
    r.status === "issued" && !r.material_moved_at && !passDateReached;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/gate-passes" className="text-sm text-sky-600 underline">
          ← Gate passes
        </Link>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold">{r.doc_number}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="capitalize">{r.status}</span>
            {" · "}
            {r.direction === "in" ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Inward</span>
            ) : (
              <span className="font-medium text-red-700 dark:text-red-400">Outward</span>
            )}
          </p>
          {isDraft ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Created by {formatCreatedByLabel(r.created_by_display_name)}
            </p>
          ) : null}
        </div>
      </div>

      {isDraft ? (
        <GatePassDraftForm
          id={id}
          parties={parties}
          minPassDateYmd={docBounds.minYmd}
          maxPassDateYmd={docBounds.maxYmd}
          calendarTzLabel={calendarTzLabel}
          organizationCountryCode={ctx.organization.country_code ?? "IN"}
          billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
          defaultValues={{
            direction: r.direction === "in" ? "in" : "out",
            documentDate: String(r.document_date ?? "").slice(0, 10),
            invoiceNo: r.invoice_no ?? "",
            partyId: r.party_id ?? null,
            partyName: r.party_name ?? "",
            transportName: r.transport_name ?? "",
            lrDocketNo: r.lr_docket_no ?? "",
            handCarriedName: r.hand_carried_name ?? "",
            handCarriedMobile: r.hand_carried_mobile ?? "",
            vehicleNo: r.vehicle_no ?? "",
            packageCount: r.package_count != null ? String(r.package_count) : "",
            mainItem: r.material_description ?? "",
            notes: r.notes ?? "",
          }}
        />
      ) : (
        <div
          className={`rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm ${
            movementOverdueHighlight ? gatePassMovementOverdueRowClassName : ""
          }`}
        >
          {movementOverdueHighlight ? (
            <p className="mb-4 rounded-md border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              Material movement is still not recorded more than 24 hours after this pass was issued. Record movement as
              soon as possible, or coordinate with gate staff.
            </p>
          ) : null}
          {movementBlockedUntilPassDate ? (
            <p className="mb-4 rounded-md border border-[var(--border)] bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              This pass is dated {passDateYmd} in your organization calendar ({calendarTzLabel}). Material movement can
              be recorded on or after that date. Printing below is still available if you need the pass ready at the
              gate.
            </p>
          ) : null}
          {recordWindowClosed ? (
            <p className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)]">
              The 48-hour window to record material movement after issue has passed. Recording movement in the app is no
              longer available for this pass.
            </p>
          ) : null}
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[var(--muted)]">Pass date</dt>
              <dd className="mt-0.5">
                {r.document_date ? formatDateDdMmYyyy(String(r.document_date).slice(0, 10)) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Invoice / DC no.</dt>
              <dd className="mt-0.5">{r.invoice_no?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Party</dt>
              <dd className="mt-0.5">{r.party_name?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Transporter / courier</dt>
              <dd className="mt-0.5">{r.transport_name?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">LR / docket no.</dt>
              <dd className="mt-0.5">{r.lr_docket_no?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Hand-carried — name</dt>
              <dd className="mt-0.5">{r.hand_carried_name?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Hand-carried — contact</dt>
              <dd className="mt-0.5">{r.hand_carried_mobile?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">
                Vehicle no.{" "}
                <span className="font-normal text-[11px] text-[var(--muted)]">(transporter or hand-carried)</span>
              </dt>
              <dd className="mt-0.5">{r.vehicle_no?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">No. of packages</dt>
              <dd className="mt-0.5">{r.package_count != null ? r.package_count : "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Main / key item</dt>
              <dd className="mt-0.5">{r.material_description?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Created by</dt>
              <dd className="mt-0.5">{formatCreatedByLabel(r.created_by_display_name)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Issued</dt>
              <dd className="mt-0.5">{r.issued_at ? new Date(r.issued_at).toLocaleString() : "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Material movement at gate</dt>
              <dd className="mt-0.5">
                {r.material_moved_at
                  ? new Date(r.material_moved_at).toLocaleString()
                  : "Not recorded yet — use Record material movement below when goods actually move."}
              </dd>
            </div>
          </dl>
          {r.notes?.trim() ? (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <div className="text-[var(--muted)]">Notes</div>
              <p className="mt-1 whitespace-pre-wrap">{r.notes}</p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:flex-wrap sm:items-start">
            {!r.material_moved_at && canRecordMovement ? (
              <RecordMaterialMovementButton
                id={id}
                direction={r.direction === "in" ? "in" : "out"}
                disabled={!canStillRecordMovementByTime}
              />
            ) : null}
            {!r.material_moved_at && !canRecordMovement ? (
              <p className="max-w-lg text-sm text-[var(--muted)]">
                Someone with gate movement access should record when the material actually crosses the gate.
              </p>
            ) : null}
            {!r.material_moved_at ? (
              <Link href={`/gate-passes/${id}/print`} className={`${primaryButtonMd} w-fit self-start sm:self-auto`}>
                Print gate pass
              </Link>
            ) : (
              <p className="max-w-lg text-sm text-[var(--muted)]">
                Print is not available after gate movement is recorded.
              </p>
            )}
          </div>

          {powered ? (
            <p className="mt-6 text-center text-xs text-[var(--muted)]">{powered}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
