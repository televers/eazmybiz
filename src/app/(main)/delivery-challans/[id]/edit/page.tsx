import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import { getOrgContext } from "@/lib/org";
import { DeliveryChallanEditor } from "@/components/delivery-challan/delivery-challan-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import {
  documentNumberingCreateProps,
  effectiveSeriesSlotForDocKind,
} from "@/lib/documents/document-numbering";

export default async function EditDeliveryChallanPage({
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

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);

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
  };

  const isDraft = r.status !== "issued";
  const numberingDraft = isDraft ? documentNumberingCreateProps(ctx.organization, "dc") : null;
  const storedSlot = (row as { numbering_series_slot?: number | null }).numbering_series_slot;
  const initialNumberingSeriesSlot =
    storedSlot != null ? Number(storedSlot) : effectiveSeriesSlotForDocKind(ctx.organization, "dc");

  const { data: items } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/delivery-challans/${id}`} className="text-sm text-sky-600 underline">
          ← {r.doc_number}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Edit delivery challan</h1>
      </div>
      <DeliveryChallanEditor
        mode="edit"
        challanId={id}
        listStatus={r.status === "issued" ? "issued" : "draft"}
        documentDateMinYmd={docBounds.minYmd}
        documentDateMaxYmd={docBounds.maxYmd}
        plan={ctx.organization.plan}
        defaultCurrency={(ctx.organization.default_currency || "INR").toString().toUpperCase().slice(0, 3)}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        parties={parties}
        savedItems={(items ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>))}
        initial={{
          template: (row as { template?: string }).template,
          document_date: r.document_date,
          currency: r.currency,
          bill_to: r.bill_to,
          ship_to: r.ship_to,
          line_items: r.line_items,
          additional_charges: r.additional_charges,
          po_no: r.po_no,
          po_date: r.po_date,
          lr_docket_no: r.lr_docket_no,
          eway_bill_no: r.eway_bill_no,
          transport_name: r.transport_name,
          transporter_id: r.transporter_id,
          vehicle_no: r.vehicle_no,
          notes: r.notes,
          party_id: (row as { party_id?: string | null }).party_id ?? null,
        }}
        numberingDraft={numberingDraft}
        initialNumberingSeriesSlot={initialNumberingSeriesSlot}
      />
    </div>
  );
}
