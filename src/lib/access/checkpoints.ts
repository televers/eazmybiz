import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { effectiveFeaturePermissions } from "@/lib/access";
import type { FullOrgContext } from "@/lib/org";
import { isAccountOwnerForActiveOrg } from "@/lib/org";
import type { MemberRole } from "@/types/database";

export type OrgCheckpointFlags = {
  hasDedicatedVisitorCheckpoint: boolean;
  hasDedicatedMaterialMovement: boolean;
};

export async function loadOrgCheckpointFlags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  subscriptionOwnerUserId: string | null,
): Promise<OrgCheckpointFlags> {
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("user_id, role, is_company_admin, feature_permissions")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw error;

  let hasDedicatedVisitorCheckpoint = false;
  let hasDedicatedMaterialMovement = false;

  for (const row of rows ?? []) {
    const uid = row.user_id as string;
    if (row.is_company_admin) continue;
    if (subscriptionOwnerUserId != null && uid === subscriptionOwnerUserId) continue;

    const eff = effectiveFeaturePermissions(
      row.role as MemberRole,
      false,
      false,
      (row.feature_permissions ?? {}) as Record<string, boolean | undefined>,
    );
    if (eff.visitor && eff.visitor_checkpoint) hasDedicatedVisitorCheckpoint = true;
    if (eff.gate_pass && eff.material_movement) hasDedicatedMaterialMovement = true;
  }

  return { hasDedicatedVisitorCheckpoint, hasDedicatedMaterialMovement };
}

export const getOrgCheckpointFlags = cache(
  async (organizationId: string, subscriptionOwnerUserId: string | null): Promise<OrgCheckpointFlags> => {
    const supabase = await createClient();
    return loadOrgCheckpointFlags(supabase, organizationId, subscriptionOwnerUserId);
  },
);

export function canRecordVisitorCheckpoint(ctx: FullOrgContext, flags: OrgCheckpointFlags): boolean {
  if (!ctx.featurePermissions.visitor) return false;
  if (isAccountOwnerForActiveOrg(ctx) || ctx.membership.is_company_admin) return true;
  if (!flags.hasDedicatedVisitorCheckpoint) return true;
  return ctx.featurePermissions.visitor_checkpoint === true;
}

export function canRecordMaterialMovement(ctx: FullOrgContext, flags: OrgCheckpointFlags): boolean {
  if (!ctx.featurePermissions.gate_pass) return false;
  if (isAccountOwnerForActiveOrg(ctx) || ctx.membership.is_company_admin) return true;
  if (!flags.hasDedicatedMaterialMovement) return true;
  return ctx.featurePermissions.material_movement === true;
}
