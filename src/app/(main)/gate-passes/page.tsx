import Link from "next/link";
import { primaryButtonMd, primaryButtonXs } from "@/lib/ui/primary-button";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { getOrgCheckpointFlags, canRecordMaterialMovement } from "@/lib/access/checkpoints";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";
import { orgCalendarHasReachedGatePassDate } from "@/lib/gate-pass/gate-pass-date-policy";
import {
  canRecordMaterialMovementWithinIssueWindow,
  gatePassMovementOverdueRowClassName,
  isIssuedGatePassMovementPendingOver24h,
} from "@/lib/gate-pass/material-movement-windows";

export default async function GatePassesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canRecordMovement = canRecordMaterialMovement(ctx, flags);
  const canUseGatePass = ctx.featurePermissions.gate_pass;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("gate_passes")
    .select(
      "id, doc_number, direction, status, document_date, invoice_no, party_name, package_count, issued_at, created_at, created_by_display_name, material_moved_at",
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Material gate passes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Take control of your material movement.</p>
        </div>
        <Link
          href="/gate-passes/new"
          className={primaryButtonMd}
        >
          New gate pass
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="min-w-[10.5rem] px-4 py-3 text-xs font-medium leading-snug sm:text-sm">
                Material Movement (Inward / Outward)
              </th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Inv. / DC</th>
              <th className="px-4 py-3 font-medium text-right">Pkgs</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created by</th>
              <th className="px-4 py-3 font-medium">Gate movement</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="w-12 px-2 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const row = r as {
                id: string;
                doc_number: string;
                direction: string;
                status: string;
                document_date: string;
                invoice_no: string | null;
                party_name: string | null;
                package_count: number | null;
                issued_at: string | null;
                created_by_display_name: string | null;
                material_moved_at: string | null;
              };
              const passYmd = String(row.document_date ?? "").slice(0, 10);
              const passReached = orgCalendarHasReachedGatePassDate(passYmd, ctx);
              const overdueMovement =
                passReached &&
                isIssuedGatePassMovementPendingOver24h({
                  status: row.status,
                  issued_at: row.issued_at,
                  material_moved_at: row.material_moved_at,
                });
              return (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--border)] ${overdueMovement ? gatePassMovementOverdueRowClassName : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/gate-passes/${row.id}`} className="text-sky-600 underline">
                      {row.doc_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.direction === "in" ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">Inward</span>
                    ) : (
                      <span className="font-medium text-red-700 dark:text-red-400">Outward</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={row.party_name ?? undefined}>
                    {row.party_name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.invoice_no?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                    {row.package_count != null ? row.package_count : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatCreatedByLabel(row.created_by_display_name)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {row.status !== "issued"
                      ? "—"
                      : row.material_moved_at
                        ? new Date(row.material_moved_at).toLocaleString()
                        : "Pending"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {row.issued_at ? new Date(row.issued_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {row.status === "draft" && canUseGatePass ? (
                      <Link
                        href={`/gate-passes/${row.id}`}
                        className={`inline-flex whitespace-nowrap ${primaryButtonXs}`}
                      >
                        Issue pass
                      </Link>
                    ) : row.status === "issued" &&
                      !row.material_moved_at &&
                      canRecordMovement &&
                      orgCalendarHasReachedGatePassDate(
                        String(row.document_date ?? "").slice(0, 10),
                        ctx,
                      ) &&
                      canRecordMaterialMovementWithinIssueWindow(row.issued_at) ? (
                      <Link
                        href={`/gate-passes/${row.id}`}
                        className={`inline-flex whitespace-nowrap ${primaryButtonXs}`}
                      >
                        Authorize movement
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <DocumentRowActionsMenu
                      kind="gate_pass"
                      documentId={row.id}
                      status={row.status}
                      gateMaterialMoved={row.material_moved_at != null}
                    />
                  </td>
                </tr>
              );
            })}
            {!rows?.length ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={11}>
                  No gate passes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
