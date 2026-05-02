import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { getOrgContext } from "@/lib/org";
import { formatMoney } from "@/lib/currencies";
import { formatPartyBlock } from "@/lib/packing/format";
import { partyFromJson } from "@/lib/packing/parse";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import { formatQuotationOptionalDetailLine } from "@/lib/quotation/format-line";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { IssueQuotationButton } from "./ui";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";
import { canEditIssuedDocument, ISSUED_EDIT_DISABLED_HOVER } from "@/lib/documents/issued-edit-window";
import { fetchIssuedDocumentEditLog } from "@/lib/documents/issued-edit-log";
import { IssuedDocumentDetailFooter } from "@/components/documents/issued-document-detail-footer";
import { DeleteDraftSalesDocumentButton } from "@/components/documents/delete-draft-sales-document-button";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const billTo = partyFromJson(row.bill_to);
  const lines = linesFromJson(row.lines);
  const additionalCharges = additionalChargesFromJson(
    (row as { additional_charges?: unknown }).additional_charges,
  );
  const combined = quotationTotalsWithAdditionalCharges(lines, additionalCharges);
  const t = combined.lines;
  const powered = poweredByLine(ctx.organization.plan);

  const issuedAt = (row as { issued_at?: string | null }).issued_at ?? null;
  const updatedAt = (row as { updated_at?: string | null }).updated_at ?? null;
  const editLog =
    row.status === "issued"
      ? await fetchIssuedDocumentEditLog(supabase, ctx.organization.id, "quotation", id)
      : [];
  const editAllowed = row.status !== "issued" || canEditIssuedDocument(issuedAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/quotations" className="text-sm text-sky-600 underline">
          ← Quotations
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{row.doc_number}</h1>
            <p className="mt-1 text-sm capitalize text-[var(--muted)]">
              Status: {row.status} · Currency: {row.currency}
            </p>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Quotation date</dt>
                <dd>{row.document_date ?? "—"}</dd>
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
                href={`/api/quotations/${id}/pdf`}
                className={primaryButtonMd + " inline-flex min-h-11 w-full items-center justify-center sm:w-auto"}
              >
                Download PDF
              </a>
            ) : null}
            <Link
              href={`/quotations/${id}/print`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:w-auto"
            >
              Print preview
            </Link>
            {editAllowed ? (
              <Link
                href={`/quotations/${id}/edit`}
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
                <IssueQuotationButton id={id} />
                <DeleteDraftSalesDocumentButton kind="quotation" documentId={id} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="font-medium">Billing Address</div>
        <pre className="mt-2 whitespace-pre-wrap font-sans">{formatPartyBlock(billTo).join("\n") || "—"}</pre>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--muted)]">Line items</h2>
        <p className="mt-1 text-xs text-[var(--muted)] lg:hidden">Swipe sideways to see all columns.</p>
        <div className="-mx-1 mt-2 overflow-x-auto overscroll-x-contain rounded-lg border border-[var(--border)] pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 lg:touch-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--card)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2 min-w-[140px]">Product / service</th>
                <th className="px-3 py-2">HSN/SAC</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                <th className="px-3 py-2 text-right">Tax %</th>
                <th className="px-3 py-2 text-right">Tax amt</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const optionalDetail = formatQuotationOptionalDetailLine(l);
                return (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 align-top text-sm">
                    <div>{l.description || "—"}</div>
                    {optionalDetail ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">{optionalDetail}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{l.hsn_sac || "—"}</td>
                  <td className="px-3 py-2">{l.unit || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.unit_price, row.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.taxable_value, row.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.tax_percent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.tax_amount, row.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(l.line_total, row.currency)}</td>
                </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-[var(--border)] bg-[var(--card)] font-medium">
              <tr>
                <td className="px-3 py-2 text-right" colSpan={4}>
                  Totals (line items)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t.qty}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.taxable_value, row.currency)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.tax_amount, row.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(t.grand_total, row.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {combined.additional_charges.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="font-medium text-[var(--muted)]">Additional charges</div>
            <ul className="mt-2 space-y-2">
              {combined.additional_charges.map((c, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2">
                  <span>{c.label || "—"}</span>
                  <span className="tabular-nums text-[var(--foreground)]">
                    {`${formatMoney(c.amount, row.currency)} + ${c.tax_percent}% tax -> ${formatMoney(c.line_total, row.currency)}`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-base font-semibold">
              <span>Grand total</span>
              <span className="tabular-nums">{formatMoney(combined.final_grand_total, row.currency)}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <div className="font-medium text-[var(--muted)]">Delivery period</div>
          <p className="mt-1 whitespace-pre-wrap">
            {(row as { delivery_period?: string }).delivery_period?.trim() || "—"}
          </p>
        </div>
        <div>
          <div className="font-medium text-[var(--muted)]">Valid until</div>
          <p className="mt-1 whitespace-pre-wrap">
            {(row as { valid_until?: string | null }).valid_until != null
              ? String((row as { valid_until?: string | null }).valid_until).slice(0, 10)
              : "—"}
          </p>
        </div>
        <div>
          <div className="font-medium text-[var(--muted)]">Payment term</div>
          <p className="mt-1 whitespace-pre-wrap">{row.payment_term || "—"}</p>
        </div>
        <div>
          <div className="font-medium text-[var(--muted)]">Delivery / Incoterm</div>
          <p className="mt-1 whitespace-pre-wrap">{row.delivery_inco_term || "—"}</p>
        </div>
      </div>

      {row.terms_notes ? (
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)]">Additional terms</h2>
          <p className="mt-1 whitespace-pre-wrap">{row.terms_notes}</p>
        </div>
      ) : null}

      {row.notes ? (
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)]">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap">{row.notes}</p>
        </div>
      ) : null}

      {row.status === "issued" && issuedAt ? (
        <IssuedDocumentDetailFooter
          firstIssuedAt={issuedAt}
          lastUpdatedAt={updatedAt}
          editLog={editLog.map((e) => ({
            edited_at: e.edited_at,
            edited_by_display_name: e.edited_by_display_name,
          }))}
        />
      ) : null}

      {powered ? <p className="text-center text-xs text-[var(--muted)]">{powered}</p> : null}
    </div>
  );
}
