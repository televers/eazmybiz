import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { linesFromJson } from "@/lib/quotation/parse";
import { PurchaseOrderEditor } from "@/components/purchase-order/purchase-order-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import {
  documentNumberingCreateProps,
  effectiveSeriesSlotForDocKind,
} from "@/lib/documents/document-numbering";
import { loadOrgShipAddresses } from "@/lib/org-ship-addresses/load";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);
  const defaultCurrency = ctx.organization.default_currency || "INR";
  const isDraft = (row as { status?: string }).status !== "issued";
  const numberingDraft = isDraft ? documentNumberingCreateProps(ctx.organization, "po") : null;
  const storedSlot = (row as { numbering_series_slot?: number | null }).numbering_series_slot;
  const initialNumberingSeriesSlot =
    storedSlot != null
      ? Number(storedSlot)
      : effectiveSeriesSlotForDocKind(ctx.organization, "po");

  const { data: itemRows } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");
  const savedItems = (itemRows ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>));
  const orgShipAddresses = await loadOrgShipAddresses(ctx.organization.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/purchase-orders/${id}`} className="text-sm text-sky-600 underline">
          ← {row.doc_number}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Edit purchase order</h1>
      </div>
      <PurchaseOrderEditor
        mode="edit"
        purchaseOrderId={id}
        organization={ctx.organization}
        plan={ctx.organization.plan}
        documentDateMinYmd={docBounds.minYmd}
        documentDateMaxYmd={docBounds.maxYmd}
        defaultCurrency={defaultCurrency}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        documentStatus={(row as { status?: string }).status === "issued" ? "issued" : "draft"}
        initial={{
          template: (row as { template?: string }).template,
          document_date: row.document_date,
          currency: row.currency,
          vendor_to: row.vendor_to as object,
          bill_to: row.bill_to as object,
          ship_to: row.ship_to as object,
          lines: linesFromJson(row.lines),
          payment_term: row.payment_term,
          delivery_inco_term: row.delivery_inco_term,
          delivery_period: (row as { delivery_period?: string }).delivery_period ?? "",
          valid_until: (row as { valid_until?: string | null }).valid_until ?? null,
          terms_notes: row.terms_notes,
          notes: row.notes,
          additional_charges: (row as { additional_charges?: unknown }).additional_charges,
          party_id: (row as { party_id?: string | null }).party_id ?? null,
        }}
        parties={parties}
        savedItems={savedItems}
        numberingDraft={numberingDraft}
        initialNumberingSeriesSlot={initialNumberingSeriesSlot}
        existingDocumentNumber={row.doc_number}
        orgShipAddresses={orgShipAddresses}
      />
    </div>
  );
}
