import type { SupabaseClient } from "@supabase/supabase-js";
import type { FullOrgContext } from "@/lib/org";
import { canEditOrgMaintainedRecord, orgMaintainedEditDeniedMessage } from "@/lib/access/org-maintained-record";

export async function assertPartyEditable(
  supabase: SupabaseClient,
  ctx: FullOrgContext,
  partyId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("parties")
    .select("managed_by_user_id")
    .eq("id", partyId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Party not found.");
  if (!canEditOrgMaintainedRecord(ctx, (data as { managed_by_user_id?: string | null }).managed_by_user_id)) {
    throw new Error(orgMaintainedEditDeniedMessage("party"));
  }
}
