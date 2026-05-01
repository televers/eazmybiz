import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function insertOrganizationActivity(
  supabase: SupabaseClient,
  organizationId: string,
  actorUserId: string,
  summary: string,
  detailLines?: string[] | null,
): Promise<void> {
  const { error } = await supabase.from("organization_settings_activity").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    summary,
    detail:
      detailLines && detailLines.length > 0 ? detailLines : null,
  });
  if (error) throw error;
}

/** For invitees who are not yet company admins (RLS would block a normal insert). */
export async function insertOrganizationActivityAsMember(
  organizationId: string,
  actorUserId: string,
  summary: string,
  detailLines?: string[] | null,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("organization_settings_activity").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    summary,
    detail:
      detailLines && detailLines.length > 0 ? detailLines : null,
  });
  if (error) throw error;
}
