"use server";

import { revalidatePath } from "next/cache";
import { getServerOrigin } from "@/lib/auth/site-origin";
import { insertOrganizationActivity } from "@/lib/org-activity";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import type { MemberRole } from "@/types/database";
import {
  enforceCompanyProfilePermissionCap,
  enforceGateRoleFeatureCaps,
  FEATURE_KEYS,
  FEATURE_MODULE_LABELS,
  type FeatureKey,
  type FeaturePermissionMap,
} from "@/lib/access";
import { loadMemberIdentities, memberListLabel } from "@/lib/team/resolve-member-labels";
import { normalizeInviteEmail } from "@/lib/validation/email";

function permissionsToJson(m: FeaturePermissionMap): Record<string, boolean> {
  return { ...m };
}

function isAlreadyRegisteredInviteError(err: { message?: string; status?: number }): boolean {
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("already been registered") || m.includes("already registered") || m.includes("user already")) {
    return true;
  }
  return err.status === 422;
}

function isEmailRateLimitError(err: { message?: string }): boolean {
  const m = (err.message ?? "").toLowerCase();
  return m.includes("rate limit") || m.includes("too many") || m.includes("email rate");
}

function inviteUserFriendlyError(err: { message?: string }): string {
  if (isEmailRateLimitError(err)) {
    return (
      "Email rate limit reached: Supabase only allows a certain number of auth emails per hour (easy to hit while testing). " +
      "Wait and try again, or in the Supabase dashboard open Authentication → Rate Limits / SMTP. " +
      "Custom SMTP on a paid project raises the cap."
    );
  }
  return err.message ?? "Invite failed.";
}

export type InviteTeamMemberResult =
  | { outcome: "invited" }
  | { outcome: "added_existing"; membershipId: string };

export async function inviteTeamMemberAction(input: {
  email: string;
  /** Optional; stored as profile display name for new invites (user metadata). */
  inviteDisplayName?: string;
  role: MemberRole;
  isCompanyAdmin: boolean;
  permissions: FeaturePermissionMap;
}): Promise<InviteTeamMemberResult> {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("You do not have permission to manage team members.");

  const email = normalizeInviteEmail(input.email);
  const isCompanyAdmin = input.role === "gate" ? false : input.isCompanyAdmin;

  const origin = await getServerOrigin();
  const nextPath = "/auth/set-password";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const admin = createServiceRoleClient();
  const supabase = await createClient();

  let safePerms = enforceGateRoleFeatureCaps(input.role, input.permissions);
  safePerms = enforceCompanyProfilePermissionCap(isCompanyAdmin, safePerms);
  const rpcPayload = {
    p_org_id: ctx.organization.id,
    p_email: email,
    p_role: input.role,
    p_feature_permissions: permissionsToJson(safePerms),
    p_is_company_admin: isCompanyAdmin,
  };

  const inviteName = input.inviteDisplayName?.trim() ?? "";
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      must_set_password: true,
      invite_organization_name: ctx.organization.name,
      invite_organization_id: ctx.organization.id,
      ...(inviteName ? { display_name: inviteName } : {}),
    },
  });

  if (inviteError) {
    if (isAlreadyRegisteredInviteError(inviteError)) {
      const { data, error } = await supabase.rpc("admin_add_org_member", rpcPayload);
      if (error) throw new Error(error.message);
      const adminBit = isCompanyAdmin ? ", company admin" : "";
      await insertOrganizationActivity(
        supabase,
        ctx.organization.id,
        ctx.userId,
        `Team & access: Existing user ${email} was added (${input.role}${adminBit}).`,
      );
      revalidatePath("/settings/team");
      revalidatePath("/settings/notifications");
      revalidatePath("/dashboard");
      revalidatePath("/", "layout");
      return { outcome: "added_existing", membershipId: data as string };
    }
    throw new Error(inviteUserFriendlyError(inviteError));
  }

  const newUserId = inviteData.user?.id;
  if (!newUserId) throw new Error("Invite did not return a user.");

  const { error: rpcError } = await supabase.rpc("admin_add_org_member", rpcPayload);
  if (rpcError) {
    await admin.auth.admin.deleteUser(newUserId);
    throw new Error(rpcError.message);
  }

  const adminBit = isCompanyAdmin ? ", company admin" : "";
  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    `Team & access: Invitation emailed to ${email} (${input.role}${adminBit}).`,
  );

  revalidatePath("/settings/team");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { outcome: "invited" };
}

export async function updateTeamMemberAction(input: {
  membershipId: string;
  role: MemberRole;
  isCompanyAdmin: boolean;
  isActive: boolean;
  permissions: FeaturePermissionMap;
}) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("You do not have permission to manage team members.");

  const supabase = await createClient();
  const isCompanyAdmin = input.role === "gate" ? false : input.isCompanyAdmin;
  let safePerms = enforceGateRoleFeatureCaps(input.role, input.permissions);
  safePerms = enforceCompanyProfilePermissionCap(isCompanyAdmin, safePerms);
  const nextPermsJson = permissionsToJson(safePerms);

  const { data: memBefore, error: memErr } = await supabase
    .from("memberships")
    .select("user_id, role, is_company_admin, is_active, feature_permissions")
    .eq("id", input.membershipId)
    .eq("organization_id", ctx.organization.id)
    .single();
  if (memErr || !memBefore) throw new Error("Member not found.");

  const targetUserId = memBefore.user_id as string;
  const isSelf = targetUserId === ctx.userId;
  const viewerIsOwner = isAccountOwnerForActiveOrg(ctx);

  if (isSelf && !!memBefore.is_active && !input.isActive) {
    throw new Error("You cannot deactivate your own access.");
  }

  const wasCompanyAdmin = !!memBefore.is_company_admin;
  if (isSelf && wasCompanyAdmin && !isCompanyAdmin && !viewerIsOwner) {
    throw new Error("Only the account owner can remove your company admin role.");
  }

  const { error } = await supabase.rpc("admin_update_membership", {
    p_membership_id: input.membershipId,
    p_role: input.role,
    p_feature_permissions: nextPermsJson,
    p_is_company_admin: isCompanyAdmin,
    p_is_active: input.isActive,
  });

  if (error) throw new Error(error.message);

  const bits: string[] = [];
  if ((memBefore.role as string) !== input.role) {
    bits.push(`role ${memBefore.role} → ${input.role}`);
  }
  if (!!memBefore.is_company_admin !== isCompanyAdmin) {
    bits.push(isCompanyAdmin ? "granted company admin" : "removed company admin");
  }
  if (!!memBefore.is_active !== input.isActive) {
    bits.push(input.isActive ? "reactivated" : "deactivated");
  }

  const prevRaw = (memBefore.feature_permissions ?? {}) as Partial<Record<FeatureKey, boolean>>;
  const permDetailLines: string[] = [];
  for (const key of FEATURE_KEYS) {
    const prev = !!prevRaw[key];
    const next = !!nextPermsJson[key];
    if (prev !== next) {
      const label = FEATURE_MODULE_LABELS[key];
      permDetailLines.push(
        next ? `Granted ${label} access to` : `Removed ${label} access from`,
      );
    }
  }

  const whoIdentities = await loadMemberIdentities([targetUserId]);
  const whoRow = whoIdentities.get(targetUserId);
  const who = memberListLabel(whoRow?.displayName ?? null, whoRow?.email ?? null, targetUserId);

  for (let i = 0; i < permDetailLines.length; i++) {
    permDetailLines[i] = `${permDetailLines[i]} ${who}.`;
  }

  let summary: string;
  if (bits.length > 0 && permDetailLines.length > 0) {
    summary = `Team & access: Updated ${who} — ${bits.join(", ")}; module access changed.`;
  } else if (bits.length > 0) {
    summary = `Team & access: Updated ${who} — ${bits.join(", ")}.`;
  } else if (permDetailLines.length > 0) {
    summary = `Team & access: Module access updated for ${who}.`;
  } else {
    summary = `Team & access: Updated access for ${who}.`;
  }

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    summary,
    permDetailLines.length > 0 ? permDetailLines : null,
  );

  revalidatePath("/settings/team");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

type InvitedDeleteEligibilityRow = {
  target_user_id: string;
  eligible: boolean;
  reason: string | null;
};

/** Permanently delete an auth user who only belongs to this org, was added recently, and created no documents. */
export async function deleteRecentInvitedUserAction(input: { targetUserId: string }) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("You do not have permission to manage team members.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_invited_delete_eligibility_for_org", {
    p_org_id: ctx.organization.id,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as InvitedDeleteEligibilityRow[];
  const row = rows.find((x) => x.target_user_id === input.targetUserId);
  if (!row?.eligible) {
    throw new Error(row?.reason ?? "This account cannot be deleted.");
  }

  const admin = createServiceRoleClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(input.targetUserId);
  if (delErr) throw new Error(delErr.message);

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    "Team & access: A recent invited account was permanently removed from the team.",
  );

  revalidatePath("/settings/team");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}
