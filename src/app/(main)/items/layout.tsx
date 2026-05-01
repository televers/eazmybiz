import { assertModuleAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { ItemListPane } from "@/components/items/item-list-pane";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";

export default async function ItemsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "items");

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("description");

  const items = (rows ?? []).map((r) => mapRowToSavedItem(r as Record<string, unknown>));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <ItemListPane items={items} />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--background)] lg:border-l lg:border-[var(--border)]">
        {children}
      </div>
    </div>
  );
}
