import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { poweredByLine } from "@/lib/branding";
import { getOrgContext } from "@/lib/org";
import { partyFromJson } from "@/lib/packing/parse";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { additionalChargesFromJson } from "@/lib/quotation/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { DeliveryChallanPrintView } from "@/components/delivery-challan/delivery-challan-print";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";
import { IssueDcButton } from "../ui";

export default async function DeliveryChallanPrintPage({
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
    updated_at: string | null;
    template?: string | null;
  };

  const billTo = partyFromJson(r.bill_to);
  const shipTo = partyFromJson(r.ship_to);
  const lines = dcLinesFromJson(r.line_items).filter((l) => l.description.trim().length > 0);
  const currency = (r.currency || ctx.organization.default_currency || "INR").toString().toUpperCase().slice(0, 3);
  const additionalCharges = additionalChargesFromJson(r.additional_charges);
  const template = parsePackingListTemplateId(r.template);
  const powered = poweredByLine(ctx.organization.plan);
  const logoUrl = ctx.organization.logo_storage_path
    ? publicObjectUrl("org-logos", ctx.organization.logo_storage_path)
    : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <Link href={`/delivery-challans/${id}`} className="text-sky-600 underline">
            ← Back to challan
          </Link>
        </div>

        <DeliveryChallanPrintView
          template={template}
          org={ctx.organization}
          docNumber={r.doc_number}
          documentDate={r.document_date}
          issuedAt={r.issued_at}
          status={r.status}
          currency={currency}
          billTo={billTo}
          shipTo={shipTo}
          lines={lines}
          additionalCharges={additionalCharges}
          poNo={r.po_no}
          poDate={r.po_date}
          lrDocketNo={r.lr_docket_no}
          ewayBillNo={r.eway_bill_no}
          transportName={r.transport_name}
          transporterId={r.transporter_id}
          vehicleNo={r.vehicle_no}
          notes={r.notes}
          poweredBy={powered}
          logoUrl={logoUrl}
        />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 print:hidden">
          <Link
            href={`/delivery-challans/${id}/edit`}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
          >
            Edit
          </Link>
          {r.status === "issued" ? (
            <a href={`/api/delivery-challans/${id}/pdf`} className={primaryButtonMd}>
              Download PDF
            </a>
          ) : null}
          {r.status === "draft" ? <IssueDcButton id={id} /> : null}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted)] print:hidden">
          {r.status === "issued" ? (
            <>
              Use <strong>Download PDF</strong> for the generated file, or <strong>Ctrl+P</strong> for print preview.
            </>
          ) : (
            <>Use your browser print dialog to save as PDF.</>
          )}
        </p>
      </div>
    </div>
  );
}
