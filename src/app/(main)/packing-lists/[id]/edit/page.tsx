import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { packagesFromJson } from "@/lib/packing/parse";
import { PackingListEditor } from "@/components/packing/packing-list-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { canEditIssuedDocument } from "@/lib/documents/issued-edit-window";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import {
  documentNumberingCreateProps,
  effectiveSeriesSlotForDocKind,
} from "@/lib/documents/document-numbering";

export default async function EditPackingListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("packing_lists")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  if (
    row.status === "issued" &&
    row.issued_at &&
    !canEditIssuedDocument(row.issued_at as string)
  ) {
    redirect(`/packing-lists/${id}`);
  }

  const parsedPackages = packagesFromJson(row.packages);
  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);
  const isDraft = row.status !== "issued";
  const numberingDraft = isDraft ? documentNumberingCreateProps(ctx.organization, "pl") : null;
  const storedSlot = (row as { numbering_series_slot?: number | null }).numbering_series_slot;
  const initialNumberingSeriesSlot =
    storedSlot != null ? Number(storedSlot) : effectiveSeriesSlotForDocKind(ctx.organization, "pl");

  const { data: items } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={`/packing-lists/${id}`} className="text-sm text-sky-600 underline">
          ← {row.doc_number}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Edit packing list</h1>
        {row.status === "issued" ? (
          <p className="mt-2 max-w-2xl text-sm text-amber-900">
            This packing list is issued. Saving updates the live document, print preview, and downloaded PDF.
          </p>
        ) : null}
      </div>
      <PackingListEditor
        mode="edit"
        packingListId={id}
        listStatus={row.status === "issued" ? "issued" : "draft"}
        documentDateMinYmd={docBounds.minYmd}
        documentDateMaxYmd={docBounds.maxYmd}
        plan={ctx.organization.plan}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        parties={parties}
        savedItems={(items ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>))}
        initial={{
          template: String(row.template ?? "basic"),
          invoice_no: row.invoice_no,
          document_date: row.document_date,
          bill_to: row.bill_to,
          ship_to: row.ship_to,
          packages: parsedPackages.length ? parsedPackages : undefined,
          notes: row.notes,
          party_id: (row as { party_id?: string | null }).party_id ?? null,
        }}
        numberingDraft={numberingDraft}
        initialNumberingSeriesSlot={initialNumberingSeriesSlot}
      />
    </div>
  );
}
