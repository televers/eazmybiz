import type { SupabaseClient } from "@supabase/supabase-js";
import type { FullOrgContext } from "@/lib/org";
import { canEditOrgMaintainedRecord } from "@/lib/access/org-maintained-record";

/** Logs a row when a non-maintainer (non-admin, non-owner) changes shipping-related party data. */
export async function maybeLogPartyMemberEdit(
  supabase: SupabaseClient,
  ctx: FullOrgContext,
  partyId: string,
  summaryLine: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("parties")
    .select("managed_by_user_id, display_name")
    .eq("id", partyId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (error || !data) return;
  const managedBy = (data as { managed_by_user_id?: string | null }).managed_by_user_id ?? null;
  if (canEditOrgMaintainedRecord(ctx, managedBy)) return;

  const name = String((data as { display_name?: string }).display_name ?? "").trim() || "Party";
  const { error: insErr } = await supabase.from("party_edit_activity").insert({
    organization_id: ctx.organization.id,
    party_id: partyId,
    actor_user_id: ctx.userId,
    summary: `${name}: ${summaryLine}`,
  });
  if (insErr) console.error("party_edit_activity insert", insErr);
}
