import Link from "next/link";
import { primaryButtonMd, primaryButtonXs } from "@/lib/ui/primary-button";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { formatMoney } from "@/lib/currencies";
import { formatDocumentDateDdMmYyyy, formatDateTimeIst } from "@/lib/packing/date-format";
import { billToFromJson, additionalChargesFromJson } from "@/lib/quotation/parse";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { dcTotalsWithAdditionalCharges } from "@/lib/delivery-challan/compute";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";

export default async function DeliveryChallansPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("delivery_challans")
    .select(
      "id, doc_number, status, issued_at, created_at, document_date, bill_to, transport_name, lr_docket_no, line_items, additional_charges, currency, created_by_display_name",
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Delivery challans</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create and organize your delivery challans at one place. No more Excel juggles.
          </p>
        </div>
        <Link href="/delivery-challans/new" className={primaryButtonMd}>
          New challan
        </Link>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-[var(--card)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
              <th className="px-4 py-3 font-medium">Transporter name</th>
              <th className="px-4 py-3 font-medium">LR no.</th>
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
              const lines = dcLinesFromJson(r.line_items).filter((l) => l.description.trim().length > 0);
              const totals = dcTotalsWithAdditionalCharges(lines, additionalChargesFromJson(r.additional_charges));
              const cur = ((r.currency as string) ?? "INR").trim().toUpperCase().slice(0, 3) || "INR";
              const transporter = (r.transport_name as string | null)?.trim() || "—";
              const lr = (r.lr_docket_no as string | null)?.trim() || "—";
              return (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link href={`/delivery-challans/${r.id}`} className="text-sky-600 underline">
                      {r.doc_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDocumentDateDdMmYyyy(r.document_date as string | null, r.issued_at as string | null)}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={partyName}>
                    {partyName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totals.final_grand_total, cur)}</td>
                  <td
                    className="px-4 py-3 max-w-[160px] truncate text-[var(--muted)]"
                    title={transporter !== "—" ? transporter : undefined}
                  >
                    {transporter}
                  </td>
                  <td
                    className="px-4 py-3 max-w-[120px] truncate text-[var(--muted)]"
                    title={lr !== "—" ? lr : undefined}
                  >
                    {lr}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatCreatedByLabel((r as { created_by_display_name?: string | null }).created_by_display_name)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTimeIst(r.issued_at as string | null)}</td>
                  <td className="px-4 py-3 align-middle">
                    {r.status !== "issued" ? (
                      <Link
                        href={`/delivery-challans/${r.id}`}
                        className={`inline-flex whitespace-nowrap ${primaryButtonXs}`}
                      >
                        Issue
                      </Link>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <DocumentRowActionsMenu kind="delivery_challan" documentId={r.id} status={r.status} />
                  </td>
                </tr>
              );
            })}
            {!rows?.length ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={11}>
                  No challans yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
