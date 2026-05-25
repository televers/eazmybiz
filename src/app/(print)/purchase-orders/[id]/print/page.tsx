import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import { partyFromJson } from "@/lib/packing/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { PurchaseOrderPrintView } from "@/components/purchase-order/purchase-order-print";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";
import { IssuePurchaseOrderButton } from "@/app/(main)/purchase-orders/[id]/ui";
import { SalesDocumentScreenPrintPreview } from "@/components/documents/sales-document-screen-print-preview";

export default async function PurchaseOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "purchase_order");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("purchase_orders")
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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Link href={`/purchase-orders/${id}`} className="text-sky-600 underline">
            ← Back to purchase order
          </Link>
        </div>

        <SalesDocumentScreenPrintPreview
          inlinePdfSrc={row.status === "issued" ? `/api/purchase-orders/${id}/pdf?inline=1` : null}
          downloadPdfHref={row.status === "issued" ? `/api/purchase-orders/${id}/pdf` : null}
        >
          <PurchaseOrderPrintView
            template={template}
            org={ctx.organization}
            docNumber={row.doc_number}
            documentDate={row.document_date}
            currency={row.currency}
            vendorTo={partyFromJson(row.vendor_to)}
            billTo={partyFromJson(row.bill_to)}
            shipTo={partyFromJson(row.ship_to)}
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
            purchaseOrderTerms={ctx.organization.purchase_order_terms ?? null}
            poweredBy={powered}
            logoUrl={logoUrl}
            status={row.status}
            issuedAt={issuedAt}
            updatedAt={(row as { updated_at?: string | null }).updated_at ?? null}
          />
        </SalesDocumentScreenPrintPreview>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 print:hidden">
          <Link
            href={`/purchase-orders/${id}/edit`}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
          >
            Edit
          </Link>
          {row.status === "issued" ? (
            <a href={`/api/purchase-orders/${id}/pdf`} className={primaryButtonMd}>
              Download PDF
            </a>
          ) : null}
          {row.status === "draft" ? <IssuePurchaseOrderButton id={id} /> : null}
        </div>

        {row.status === "draft" ? (
          <p className="mt-6 text-center text-sm text-[var(--muted)] print:hidden">
            Draft — issue the purchase order to enable PDF download.
          </p>
        ) : null}
      </div>
    </div>
  );
}
