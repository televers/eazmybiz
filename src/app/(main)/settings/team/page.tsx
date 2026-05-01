import { createClient } from "@/lib/supabase/server";
import { effectiveFeaturePermissions, fullAccessPermissions } from "@/lib/access";
import { getOrgContext } from "@/lib/org";
import {
  maxCompanyAdminsForPlan,
  maxCompanyAdminsPerOrgForPlan,
  maxUsersForPlan,
} from "@/lib/plan/entitlements";
import { loadMemberIdentities } from "@/lib/team/resolve-member-labels";
import type { FeaturePermissionMap } from "@/lib/access";
import { TeamPanel, type TeamMemberRow } from "./team-panel";

export default async function TeamSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, is_company_admin, is_active, feature_permissions, created_at")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });

  if (error) {
    return <p className="text-sm text-red-600">Could not load team.</p>;
  }

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const identities = await loadMemberIdentities(userIds);

  const ownerId = ctx.entitlement?.owner_user_id ?? null;

  const { data: adminCountRaw } = await supabase.rpc("entitlement_company_admin_count_for_caller");
  const accountAdminUsed = typeof adminCountRaw === "number" ? adminCountRaw : 0;
  const accountAdminMax = maxCompanyAdminsForPlan(ctx.organization.plan);

  const { data: accountUsersRaw } = await supabase.rpc("entitlement_active_user_count_for_caller");
  const accountPeopleUsed = typeof accountUsersRaw === "number" ? accountUsersRaw : 0;
  const accountPeopleMax = maxUsersForPlan(ctx.organization.plan);

  const thisCompanyAdminMax = maxCompanyAdminsPerOrgForPlan(ctx.organization.plan);

  const { data: eligRows } = await supabase.rpc("admin_invited_delete_eligibility_for_org", {
    p_org_id: ctx.organization.id,
  });
  const invitedDeleteEligibleByUser = new Map<string, boolean>();
  for (const er of eligRows ?? []) {
    const row = er as { target_user_id: string; eligible: boolean };
    invitedDeleteEligibleByUser.set(row.target_user_id, !!row.eligible);
  }

  const members: TeamMemberRow[] = (rows ?? []).map((r) => {
    const role = r.role as TeamMemberRow["role"];
    const isCompanyAdmin = !!(r as { is_company_admin?: boolean }).is_company_admin;
    const isOwner = ownerId !== null && r.user_id === ownerId;
    const rawPerms = (r as { feature_permissions?: Record<string, boolean> }).feature_permissions ?? {};
    const permissions: FeaturePermissionMap = isOwner
      ? fullAccessPermissions()
      : effectiveFeaturePermissions(role, isCompanyAdmin, false, rawPerms);

    const uid = r.user_id as string;
    const idRow = identities.get(uid) ?? { displayName: null, email: null };

    return {
      membershipId: r.id as string,
      userId: uid,
      displayName: idRow.displayName,
      email: idRow.email,
      role,
      isCompanyAdmin,
      isActive: !!(r as { is_active?: boolean }).is_active,
      permissions,
      isAccountOwner: isOwner,
      canDeleteInvitedAccount: !isOwner && (invitedDeleteEligibleByUser.get(uid) ?? false),
    };
  });

  const canAssignCompanyAdmin = accountAdminMax > 0;

  const thisCompanyAdminUsed = members.filter(
    (m) => m.isCompanyAdmin && !m.isAccountOwner && m.isActive,
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team &amp; access</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage your team and their rights here, only Account owner (master admin) and company admin can see this
        </p>
      </div>
      <TeamPanel
        planTier={ctx.organization.plan}
        members={members}
        viewerUserId={ctx.userId}
        canAssignCompanyAdmin={canAssignCompanyAdmin}
        thisCompanyAdminUsed={thisCompanyAdminUsed}
        thisCompanyAdminMax={thisCompanyAdminMax}
        accountAdminUsed={accountAdminUsed}
        accountAdminMax={accountAdminMax}
        accountPeopleUsed={accountPeopleUsed}
        accountPeopleMax={accountPeopleMax}
      />
    </div>
  );
}
