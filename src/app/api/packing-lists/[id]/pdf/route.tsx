import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { poweredByLine } from "@/lib/branding";
import { PackingListPdfDocument } from "@/lib/packing/packing-list-pdf-document";
import { parsePackingListTemplateId } from "@/lib/packing/packing-list-templates";
import { packagesFromJson, partyFromJson } from "@/lib/packing/parse";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/types/database";

export const runtime = "nodejs";

function safeFilename(s: string): string {
  const t = s.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").trim();
  return t.slice(0, 80) || "packing-list";
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

  const { data: row, error: rowErr } = await supabase
    .from("packing_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "issued") {
    return NextResponse.json(
      { error: "PDF is available only after the packing list is issued." },
      { status: 403 },
    );
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
      packing_terms
    `,
    )
    .eq("id", row.organization_id)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const packages = packagesFromJson(row.packages);
  const billTo = partyFromJson(row.bill_to);
  const shipTo = partyFromJson(row.ship_to);
  const orgRow = org as Organization;
  const powered = poweredByLine(orgRow.plan);
  const logoUrl = orgRow.logo_storage_path
    ? publicObjectUrl("org-logos", orgRow.logo_storage_path)
    : null;

  const template = parsePackingListTemplateId(row.template as string | null);

  const buffer = await renderToBuffer(
    <PackingListPdfDocument
      template={template}
      org={orgRow}
      docNumber={row.doc_number}
      invoiceNo={row.invoice_no}
      documentDate={row.document_date}
      issuedAt={row.issued_at}
      updatedAt={row.updated_at}
      billTo={billTo}
      shipTo={shipTo}
      packages={packages}
      notes={row.notes}
      poweredBy={powered}
      logoUrl={logoUrl}
    />,
  );

  const filename = `${safeFilename(row.doc_number)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
