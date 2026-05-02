import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import { partyFromJson, packagesFromJson } from "@/lib/packing/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { PackingListPrintView } from "@/components/packing/packing-list-print";
import { canEditIssuedDocument, ISSUED_EDIT_DISABLED_HOVER } from "@/lib/documents/issued-edit-window";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { IssuePackingListButton } from "@/app/(main)/packing-lists/[id]/ui";
import { SalesDocumentScreenPrintPreview } from "@/components/documents/sales-document-screen-print-preview";

export default async function PackingListPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "packing_list");

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
  const powered = poweredByLine(ctx.organization.plan);
  const logoUrl = ctx.organization.logo_storage_path
    ? publicObjectUrl("org-logos", ctx.organization.logo_storage_path)
    : null;

  const template = parsePackingListTemplateId(row.template as string | null);
  const issuedAt = row.issued_at as string | null;
  const editAllowed = row.status !== "issued" || canEditIssuedDocument(issuedAt);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Link href={`/packing-lists/${id}`} className="text-sky-600 underline">
            ← Back to packing list
          </Link>
        </div>

        <SalesDocumentScreenPrintPreview
          inlinePdfSrc={row.status === "issued" ? `/api/packing-lists/${id}/pdf?inline=1` : null}
          downloadPdfHref={row.status === "issued" ? `/api/packing-lists/${id}/pdf` : null}
        >
          <PackingListPrintView
            template={template}
            org={ctx.organization}
            docNumber={row.doc_number}
            invoiceNo={row.invoice_no}
            documentDate={row.document_date}
            issuedAt={row.issued_at}
            updatedAt={row.updated_at}
            status={row.status}
            billTo={billTo}
            shipTo={shipTo}
            packages={packages}
            notes={row.notes}
            poweredBy={powered}
            logoUrl={logoUrl}
          />
        </SalesDocumentScreenPrintPreview>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 print:hidden">
          {editAllowed ? (
            <Link
              href={`/packing-lists/${id}/edit`}
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
            <a href={`/api/packing-lists/${id}/pdf`} className={primaryButtonMd}>
              Download PDF
            </a>
          ) : null}
          {row.status === "draft" ? <IssuePackingListButton id={id} /> : null}
        </div>

        {row.status === "draft" ? (
          <p className="mt-6 text-center text-sm text-[var(--muted)] print:hidden">
            Draft — issue the packing list to enable PDF download.
          </p>
        ) : null}
      </div>
    </div>
  );
}
