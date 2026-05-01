import Link from "next/link";
import { orgDocumentDatePickerBounds } from "@/lib/documents/document-date-backdate-policy";
import { getOrgContext } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { createClient } from "@/lib/supabase/server";
import { DeliveryChallanEditor } from "@/components/delivery-challan/delivery-challan-editor";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { documentNumberingCreateProps } from "@/lib/documents/document-numbering";

export default async function NewDeliveryChallanPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const parties = await loadPartiesWithAddresses(ctx.organization.id);
  const docBounds = orgDocumentDatePickerBounds(ctx);

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">New delivery challan</h1>
        <Link href="/delivery-challans" className="shrink-0 text-sm text-sky-600 underline">
          ← Delivery challans
        </Link>
      </div>
      <DeliveryChallanEditor
        mode="create"
        documentDateMinYmd={docBounds.minYmd}
        documentDateMaxYmd={docBounds.maxYmd}
        plan={ctx.organization.plan}
        defaultCurrency={(ctx.organization.default_currency || "INR").toString().toUpperCase().slice(0, 3)}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        parties={parties}
        savedItems={(items ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>))}
        numberingCreate={documentNumberingCreateProps(ctx.organization, "dc")}
      />
    </div>
  );
}
