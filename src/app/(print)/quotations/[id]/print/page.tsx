import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import { partyFromJson } from "@/lib/packing/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { QuotationPrintView } from "@/components/quotation/quotation-print";
import { canEditIssuedDocument, ISSUED_EDIT_DISABLED_HOVER } from "@/lib/documents/issued-edit-window";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";
import { IssueQuotationButton } from "@/app/(main)/quotations/[id]/ui";

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "quotation");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const validUntil =
    (row as { valid_until?: string | null }).valid_until != null
      ? String((row as { valid_until?: string | null }).valid_until).slice(0, 10)
      : null;
  const deliveryPeriod = (row as { delivery_period?: string | null }).delivery_period ?? "";
  const template = parsePackingListTemplateId((row as { template?: string | null }).template);

  const powered = poweredByLine(ctx.organization.plan);
  const logoUrl = ctx.organization.logo_storage_path
    ? publicObjectUrl("org-logos", ctx.organization.logo_storage_path)
    : null;
  const issuedAt = (row as { issued_at?: string | null }).issued_at ?? null;
  const editAllowed = row.status !== "issued" || canEditIssuedDocument(issuedAt);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Link href={`/quotations/${id}`} className="text-sky-600 underline">
            ← Back to quotation
          </Link>
        </div>

        <QuotationPrintView
          template={template}
          org={ctx.organization}
          docNumber={row.doc_number}
          documentDate={row.document_date}
          currency={row.currency}
          billTo={partyFromJson(row.bill_to)}
          lines={linesFromJson(row.lines)}
          additionalCharges={additionalChargesFromJson(
            (row as { additional_charges?: unknown }).additional_charges,
          )}
          deliveryPeriod={deliveryPeriod}
          validUntil={validUntil}
          paymentTerm={row.payment_term}
          deliveryIncoTerm={row.delivery_inco_term}
          termsNotes={row.terms_notes}
          notes={row.notes}
          quotationTerms={ctx.organization.quotation_terms ?? null}
          poweredBy={powered}
          logoUrl={logoUrl}
          status={row.status}
          issuedAt={issuedAt}
          updatedAt={(row as { updated_at?: string | null }).updated_at ?? null}
        />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 print:hidden">
          {editAllowed ? (
            <Link
              href={`/quotations/${id}/edit`}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
            >
              Edit
            </Link>
          ) : (
            <span
              className="cursor-not-allowed rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] opacity-60"
              title={ISSUED_EDIT_DISABLED_HOVER}
            >
              Edit
            </span>
          )}
          {row.status === "issued" ? (
            <a href={`/api/quotations/${id}/pdf`} className={primaryButtonMd}>
              Download PDF
            </a>
          ) : null}
          {row.status === "draft" ? <IssueQuotationButton id={id} /> : null}
        </div>

        {row.status === "issued" ? (
          <p className="mt-6 text-center text-sm text-[var(--muted)] print:hidden">
            Use <strong>Download PDF</strong> for a file without browser chrome, or <strong>Ctrl+P</strong> for print preview.
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-[var(--muted)] print:hidden">
            Draft — issue the quotation to enable PDF download.
          </p>
        )}
      </div>
    </div>
  );
}
