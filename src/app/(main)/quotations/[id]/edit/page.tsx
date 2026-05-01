import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { linesFromJson } from "@/lib/quotation/parse";
import { QuotationEditor } from "@/components/quotation/quotation-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { canEditIssuedDocument } from "@/lib/documents/issued-edit-window";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import {
  documentNumberingCreateProps,
  effectiveSeriesSlotForDocKind,
} from "@/lib/documents/document-numbering";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
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

  const st = (row as { status?: string }).status;
  const issuedAt = (row as { issued_at?: string | null }).issued_at;
  if (st === "issued" && issuedAt && !canEditIssuedDocument(issuedAt)) {
    redirect(`/quotations/${id}`);
  }

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);
  const defaultCurrency = ctx.organization.default_currency || "INR";
  const isDraft = (row as { status?: string }).status !== "issued";
  const numberingDraft = isDraft ? documentNumberingCreateProps(ctx.organization, "qt") : null;
  const storedSlot = (row as { numbering_series_slot?: number | null }).numbering_series_slot;
  const initialNumberingSeriesSlot =
    storedSlot != null
      ? Number(storedSlot)
      : effectiveSeriesSlotForDocKind(ctx.organization, "qt");

  const { data: itemRows } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");
  const savedItems = (itemRows ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/quotations/${id}`} className="text-sm text-sky-600 underline">
          ← {row.doc_number}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Edit quotation</h1>
      </div>
      <QuotationEditor
        mode="edit"
        quotationId={id}
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
          bill_to: row.bill_to as object,
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
      />
    </div>
  );
}
