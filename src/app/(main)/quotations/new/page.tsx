import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { QuotationEditor } from "@/components/quotation/quotation-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { documentNumberingCreateProps } from "@/lib/documents/document-numbering";

export default async function NewQuotationPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: itemRows } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);
  const defaultCurrency = ctx.organization.default_currency || "INR";
  const savedItems = (itemRows ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">New quotation</h1>
        <Link href="/quotations" className="shrink-0 text-sm text-sky-600 underline">
          ← Quotations
        </Link>
      </div>
      <QuotationEditor
        mode="create"
        plan={ctx.organization.plan}
        documentDateMinYmd={docBounds.minYmd}
        documentDateMaxYmd={docBounds.maxYmd}
        defaultCurrency={defaultCurrency}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        parties={parties}
        savedItems={savedItems}
        numberingCreate={documentNumberingCreateProps(ctx.organization, "qt")}
      />
    </div>
  );
}
