import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { partyFromJson, packagesFromJson } from "@/lib/packing/parse";
import { formatGrossWeightKg, formatPackageSizeCm } from "@/lib/packing/package-display";
import { formatPartyBlock } from "@/lib/packing/format";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { IssuePackingListButton } from "./ui";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import {
  packingListTemplateLabel,
  parsePackingListTemplateId,
} from "@/lib/packing/packing-list-templates";
import { canEditIssuedDocument, ISSUED_EDIT_DISABLED_HOVER } from "@/lib/documents/issued-edit-window";
import { fetchIssuedDocumentEditLog } from "@/lib/documents/issued-edit-log";
import { IssuedDocumentDetailFooter } from "@/components/documents/issued-document-detail-footer";
import { DeleteDraftSalesDocumentButton } from "@/components/documents/delete-draft-sales-document-button";

export default async function PackingListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("packing_lists")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const packages = packagesFromJson(row.packages);
  const billTo = partyFromJson(row.bill_to);
  const shipTo = partyFromJson(row.ship_to);
  const lineCount = packages.reduce((n, p) => n + p.lines.length, 0);

  const editLog =
    row.status === "issued"
      ? await fetchIssuedDocumentEditLog(supabase, ctx.organization.id, "packing_list", id)
      : [];

  const editAllowed = row.status !== "issued" || canEditIssuedDocument(row.issued_at as string | null);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/packing-lists" className="text-sm text-sky-600 underline">
          ← Packing lists
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{row.doc_number}</h1>
            <p className="mt-1 text-sm capitalize text-[var(--muted)]">
              Status: {row.status} · Template:{" "}
              {packingListTemplateLabel(parsePackingListTemplateId(row.template as string | null))}
            </p>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Document date</dt>
                <dd>{row.document_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Invoice no.</dt>
                <dd>{row.invoice_no ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Created by</dt>
                <dd>{formatCreatedByLabel((row as { created_by_display_name?: string | null }).created_by_display_name)}</dd>
              </div>
            </dl>
          </div>
          <div className="flex w-full max-w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {row.status === "issued" ? (
              <a
                href={`/api/packing-lists/${id}/pdf`}
                className={primaryButtonMd + " inline-flex min-h-11 w-full items-center justify-center sm:w-auto"}
              >
                Download PDF
              </a>
            ) : null}
            <Link
              href={`/packing-lists/${id}/print`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:w-auto"
            >
              Print preview
            </Link>
            {editAllowed ? (
              <Link
                href={`/packing-lists/${id}/edit`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:w-auto"
              >
                Edit
              </Link>
            ) : (
              <span
                className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] opacity-60 sm:w-auto"
                title={ISSUED_EDIT_DISABLED_HOVER}
              >
                Edit
              </span>
            )}
            {row.status === "draft" ? (
              <>
                <IssuePackingListButton id={id} />
                <DeleteDraftSalesDocumentButton kind="packing_list" documentId={id} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <div className="font-medium">Billing Address</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[var(--foreground)]">
            {formatPartyBlock(billTo).join("\n") || "—"}
          </pre>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <div className="font-medium">Shipping Address</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[var(--foreground)]">
            {formatPartyBlock(shipTo).join("\n") || "—"}
          </pre>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--muted)]">
          Packages ({packages.length}) · Lines ({lineCount})
        </h2>
        <div className="mt-2 space-y-4">
          {packages.map((pkg) => (
            <div key={pkg.package_no} className="overflow-hidden rounded-lg border border-[var(--border)]">
              <div className="bg-[var(--card)] px-4 py-2 text-sm font-medium">
                Package {pkg.package_no}
                {pkg.package_type ? ` · ${pkg.package_type}` : ""}
                {pkg.package_size?.trim() ? ` · ${formatPackageSizeCm(pkg.package_size)}` : ""}
                {pkg.package_weight_kg != null ? ` · ${formatGrossWeightKg(pkg.package_weight_kg)}` : ""}
              </div>
              <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0">
                <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 w-24">Unit</th>
                    <th className="px-4 py-2 w-24">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.lines.map((line, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2">{line.description}</td>
                      <td className="px-4 py-2">{line.unit}</td>
                      <td className="px-4 py-2">{line.qty}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
              {pkg.packing_remarks ? (
                <div className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
                  Remarks: {pkg.packing_remarks}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {row.notes ? (
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)]">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap">{row.notes}</p>
        </div>
      ) : null}

      {row.status === "issued" && row.issued_at ? (
        <IssuedDocumentDetailFooter
          firstIssuedAt={row.issued_at as string}
          lastUpdatedAt={(row.updated_at as string | null) ?? null}
          editLog={editLog.map((e) => ({
            edited_at: e.edited_at,
            edited_by_display_name: e.edited_by_display_name,
          }))}
        />
      ) : null}
    </div>
  );
}
