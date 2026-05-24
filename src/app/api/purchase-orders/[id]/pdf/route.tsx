import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { poweredByLine } from "@/lib/branding";
import { PurchaseOrderPdfDocument } from "@/lib/purchase-order/purchase-order-pdf-document";
import { stampPurchaseOrderPdfFooter } from "@/lib/purchase-order/stamp-purchase-order-pdf-footer";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import { partyFromJson } from "@/lib/packing/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/database";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";

export const runtime = "nodejs";

function safeFilename(s: string): string {
  const t = s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").trim();
  return t.slice(0, 80) || "purchase-order";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "issued") {
    return NextResponse.json({ error: "PDF is available only after the purchase order is issued." }, { status: 403 });
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
      default_currency,
      bank_account_holder_name,
      bank_name,
      bank_branch,
      bank_account_no,
      bank_ifsc,
      purchase_order_terms
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

  const validUntil =
    (row as { valid_until?: string | null }).valid_until != null
      ? String((row as { valid_until?: string | null }).valid_until).slice(0, 10)
      : null;
  const deliveryPeriod = (row as { delivery_period?: string | null }).delivery_period ?? "";
  const template = parsePackingListTemplateId((row as { template?: string | null }).template);

  const raw = await renderToBuffer(
    <PurchaseOrderPdfDocument
      template={template}
      org={orgRow}
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
      purchaseOrderTerms={orgRow.purchase_order_terms ?? null}
      logoUrl={logoUrl}
      issuedAt={row.issued_at as string | null}
      updatedAt={row.updated_at as string | null}
    />,
  );

  const buffer = await stampPurchaseOrderPdfFooter(new Uint8Array(raw), {
    docNumber: row.doc_number,
    poweredBy: powered,
  });

  const filename = `${safeFilename(row.doc_number)}.pdf`;

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
