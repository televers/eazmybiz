import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { poweredByLine } from "@/lib/branding";
import { DeliveryChallanPdfDocument } from "@/lib/delivery-challan/delivery-challan-pdf-document";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { partyFromJson } from "@/lib/packing/parse";
import { additionalChargesFromJson } from "@/lib/quotation/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/database";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";

export const runtime = "nodejs";

function safeFilename(s: string): string {
  const t = s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").trim();
  return t.slice(0, 80) || "delivery-challan";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase.from("delivery_challans").select("*").eq("id", id).maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "issued") {
    return NextResponse.json({ error: "PDF is available only after the delivery challan is issued." }, { status: 403 });
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      plan,
      country_code,
      region,
      gstin,
      created_at,
      org_address_line1,
      org_address_line2,
      org_city,
      org_state,
      org_pin,
      org_country,
      org_email,
      logo_storage_path,
      packing_terms,
      delivery_challan_terms,
      default_currency,
      bank_account_holder_name,
      bank_name,
      bank_branch,
      bank_account_no,
      bank_ifsc,
      quotation_terms
    `,
    )
    .eq("id", row.organization_id)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgRow = org as Organization;
  const powered = poweredByLine(orgRow.plan);
  const logoUrl = orgRow.logo_storage_path ? publicObjectUrl("org-logos", orgRow.logo_storage_path) : null;

  const r = row as {
    doc_number: string;
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
    template?: string | null;
  };

  const lines = dcLinesFromJson(r.line_items).filter((l) => l.description.trim().length > 0);
  const currency = (r.currency || orgRow.default_currency || "INR").toString().toUpperCase().slice(0, 3);
  const template = parsePackingListTemplateId(r.template);

  const buffer = await renderToBuffer(
    <DeliveryChallanPdfDocument
      template={template}
      org={orgRow}
      docNumber={r.doc_number}
      documentDate={r.document_date}
      issuedAt={r.issued_at}
      currency={currency}
      billTo={partyFromJson(r.bill_to)}
      shipTo={partyFromJson(r.ship_to)}
      lines={lines}
      additionalCharges={additionalChargesFromJson(r.additional_charges)}
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
    />,
  );

  const filename = `${safeFilename(r.doc_number)}.pdf`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
