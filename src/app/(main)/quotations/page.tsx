import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { primaryButtonMd, primaryButtonXs } from "@/lib/ui/primary-button";
import { getOrgContext } from "@/lib/org";
import { formatMoney } from "@/lib/currencies";
import { formatDocumentDateDdMmYyyy, formatDateTimeIst } from "@/lib/packing/date-format";
import { billToFromJson, linesFromJson, additionalChargesFromJson } from "@/lib/quotation/parse";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";
import {
  documentListTableCardClassName,
  documentListTableClassName,
  documentListTableScrollAreaClassName,
} from "@/lib/ui/document-list-table";

export default async function QuotationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("quotations")
    .select(
      "id, doc_number, status, document_date, currency, issued_at, created_at, bill_to, lines, additional_charges, created_by_display_name",
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Quotations</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create and organize your quotations at one place, No more excel juggles
          </p>
        </div>
        <Link href="/quotations/new" className={primaryButtonMd}>
          New quotation
        </Link>
      </div>

      <div className={documentListTableCardClassName}>
        <div className={documentListTableScrollAreaClassName}>
          <table className={documentListTableClassName}>
          <thead className="bg-[var(--card)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
              <th className="px-4 py-3 font-medium">Currency</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created by</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="min-w-[4.5rem] px-4 py-3 text-xs font-medium sm:text-sm">Issue</th>
              <th className="w-12 px-2 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const partyName = billToFromJson(r.bill_to).name.trim() || "—";
              const totals = quotationTotalsWithAdditionalCharges(
                linesFromJson(r.lines),
                additionalChargesFromJson(r.additional_charges),
              );
              const cur = (r.currency ?? "INR").trim() || "INR";
              return (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link href={`/quotations/${r.id}`} className="text-sky-600 underline">
                      {r.doc_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDocumentDateDdMmYyyy(r.document_date, r.issued_at)}
                  </td>
                  <td className="px-4 py-3">{partyName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.final_grand_total, cur)}</td>
                  <td className="px-4 py-3">{cur}</td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatCreatedByLabel((r as { created_by_display_name?: string | null }).created_by_display_name)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTimeIst(r.issued_at)}</td>
                  <td className="px-4 py-3 align-middle">
                    {r.status !== "issued" ? (
                      <Link
                        href={`/quotations/${r.id}`}
                        className={`inline-flex whitespace-nowrap ${primaryButtonXs}`}
                      >
                        Issue
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <DocumentRowActionsMenu kind="quotation" documentId={r.id} status={r.status} />
                  </td>
                </tr>
              );
            })}
            {!rows?.length ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={10}>
                  No quotations yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
