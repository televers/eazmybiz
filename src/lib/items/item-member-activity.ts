import type { SupabaseClient } from "@supabase/supabase-js";
import type { FullOrgContext } from "@/lib/org";
import { canEditSavedItemNameAndUnit } from "@/lib/items/can-edit-saved-item-name-unit";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function dash(s: string): string {
  const t = norm(s);
  return t || "—";
}

type Trio = {
  hsn_sac: string;
  make_service_provider: string;
  model_part_no_description: string;
};

/** Logs when a non-admin / non-owner changes HSN/SAC, make, or model on a saved item. */
export async function maybeLogSavedItemMemberEdit(
  supabase: SupabaseClient,
  ctx: FullOrgContext,
  presetId: string,
  before: Trio,
  after: Trio,
  itemLabel: string,
): Promise<void> {
  if (canEditSavedItemNameAndUnit(ctx)) return;

  const parts: string[] = [];
  if (norm(before.hsn_sac) !== norm(after.hsn_sac)) {
    parts.push(`HSN/SAC: ${dash(before.hsn_sac)} → ${dash(after.hsn_sac)}`);
  }
  if (norm(before.make_service_provider) !== norm(after.make_service_provider)) {
    parts.push(`Make / service provider: ${dash(before.make_service_provider)} → ${dash(after.make_service_provider)}`);
  }
  if (norm(before.model_part_no_description) !== norm(after.model_part_no_description)) {
    parts.push(
      `Model / part no: ${dash(before.model_part_no_description)} → ${dash(after.model_part_no_description)}`,
    );
  }
  if (parts.length === 0) return;

  const label = norm(itemLabel) || "Item";
  const { error } = await supabase.from("saved_item_edit_activity").insert({
    organization_id: ctx.organization.id,
    preset_id: presetId,
    actor_user_id: ctx.userId,
    summary: `${label}: ${parts.join("; ")}`,
  });
  if (error) console.error("saved_item_edit_activity insert", error);
}
