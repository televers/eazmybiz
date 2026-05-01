import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { partyFromJson } from "@/lib/packing/parse";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { dcTotalsWithAdditionalCharges } from "@/lib/delivery-challan/compute";
import { additionalChargesFromJson } from "@/lib/quotation/parse";
import { formatMoney } from "@/lib/currencies";
import { formatDocumentDateDdMmYyyy } from "@/lib/packing/date-format";
import { formatPartyBlock } from "@/lib/packing/format";
import { IssueDcButton } from "./ui";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { DeleteDraftSalesDocumentButton } from "@/components/documents/delete-draft-sales-document-button";

export default async function DeliveryChallanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("delivery_challans")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const r = row as {
    doc_number: string;
    status: string;
    document_date: string | null;
    currency: string | null;
    bill_to: unknown;
    ship_to: unknown;
    line_items: unknown;
    additional_charges: unknown;
    po_no: string | null;
    po_date: string | null;
    lr_docket_no: string | null;
    eway_bill_no: string | null;
    transport_name: string | null;
    transporter_id: string | null;
    vehicle_no: string | null;
    notes: string | null;
    issued_at: string | null;
    created_by_display_name: string | null;
  };

  const billTo = partyFromJson(r.bill_to);
  const shipTo = partyFromJson(r.ship_to);
  const lines = dcLinesFromJson(r.line_items).filter((l) => l.description.trim().length > 0);
  const currency = (r.currency || ctx.organization.default_currency || "INR").toString().toUpperCase().slice(0, 3);
  const extra = additionalChargesFromJson(r.additional_charges);
  const combined = dcTotalsWithAdditionalCharges(lines, extra);

  const metaRow = (label: string, value: string | null | undefined) => (
    <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2 text-sm last:border-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--foreground)]">{value?.trim() || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/delivery-challans" className="text-sm text-sky-600 underline">
          ← Delivery challans
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{r.doc_number}</h1>
            <p className="mt-1 text-sm capitalize text-[var(--muted)]">Status: {r.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/delivery-challans/${id}/edit`}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
            >
              Edit
            </Link>
            <Link
              href={`/delivery-challans/${id}/print`}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
            >
              Print view
            </Link>
            {r.status === "issued" ? (
              <a href={`/api/delivery-challans/${id}/pdf`} className={primaryButtonMd}>
                Download PDF
              </a>
            ) : null}
            {r.status === "draft" ? (
              <>
                <IssueDcButton id={id} />
                <DeleteDraftSalesDocumentButton kind="delivery_challan" documentId={id} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Billing Address</h2>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {formatPartyBlock(billTo).join("\n") || "—"}
            </pre>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Shipping Address</h2>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {formatPartyBlock(shipTo).join("\n") || "—"}
            </pre>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Transport &amp; documents</h2>
          <div className="mt-2">
            {metaRow("Currency", currency)}
            {metaRow("Created by", formatCreatedByLabel(r.created_by_display_name))}
            {metaRow("Document date", formatDocumentDateDdMmYyyy(r.document_date, r.issued_at))}
            {metaRow("PO no.", r.po_no)}
            {metaRow("PO date", formatDocumentDateDdMmYyyy(r.po_date, null))}
            {metaRow("LR / Docket no.", r.lr_docket_no)}
            {metaRow("E-way bill no.", r.eway_bill_no)}
            {metaRow("Transport name", r.transport_name)}
            {metaRow("Transporter ID", r.transporter_id)}
            {metaRow("Vehicle no.", r.vehicle_no)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--card)] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Description</th>
              <th className="px-3 py-3 font-medium">HSN</th>
              <th className="px-3 py-3 font-medium">Unit</th>
              <th className="px-3 py-3 font-medium text-right">Qty</th>
              <th className="px-3 py-3 font-medium text-right">Unit rate</th>
              <th className="px-3 py-3 font-medium text-right">Tax %</th>
              <th className="px-3 py-3 font-medium text-right">Taxable</th>
              <th className="px-3 py-3 font-medium text-right">Tax</th>
              <th className="px-3 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                <td className="px-3 py-3 tabular-nums">{i + 1}</td>
                <td className="px-3 py-3">{line.description}</td>
                <td className="px-3 py-3 tabular-nums">{line.hsn}</td>
                <td className="px-3 py-3">{line.unit}</td>
                <td className="px-3 py-3 text-right tabular-nums">{line.qty}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(line.unit_price, currency)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{line.tax_percent}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(line.taxable_value, currency)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(line.tax_amount, currency)}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums">
                  {formatMoney(line.line_total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2">
          <span className="text-[var(--muted)]">Line items total</span>
          <span className="tabular-nums font-medium">{formatMoney(combined.lines.grand_total, currency)}</span>
        </div>
        {combined.additional_charges.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {combined.additional_charges.map((c, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 text-[var(--muted)]">
                <span>{c.label || "Charge"}</span>
                <span className="tabular-nums text-[var(--foreground)]">
                  +{formatMoney(c.line_total, currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3 text-base font-semibold">
          <span>Grand total</span>
          <span className="tabular-nums">{formatMoney(combined.final_grand_total, currency)}</span>
        </div>
      </div>

      {r.notes ? (
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)]">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap">{r.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
