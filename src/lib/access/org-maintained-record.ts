import type { FullOrgContext } from "@/lib/org-context-types";
import { isAccountOwnerForActiveOrg } from "@/lib/org/is-account-owner-for-active-org";

/** Inputs for maintainer checks when `FullOrgContext` is not available (e.g. client components). */
export type OrgMaintainedEditFlags = {
  userId: string;
  /** Billing owner of the **active** company’s subscription (not “owner of any subscription”). */
  isAccountOwnerForActiveOrg: boolean;
  isCompanyAdmin: boolean;
};

/**
 * Party / saved item: only the account owner for this org, company admins, or the assigned maintainer may edit.
 * Prefer this over `canManageMemberships`, which is true for subscription owners even on orgs where they are only an invited member.
 */
export function canEditOrgMaintainedRecordFromFlags(
  flags: OrgMaintainedEditFlags,
  maintainedByUserId: string | null | undefined,
): boolean {
  if (flags.isAccountOwnerForActiveOrg || flags.isCompanyAdmin) return true;
  const m = maintainedByUserId ?? null;
  return m !== null && m === flags.userId;
}

export function canEditOrgMaintainedRecord(
  ctx: FullOrgContext,
  maintainedByUserId: string | null | undefined,
): boolean {
  return canEditOrgMaintainedRecordFromFlags(
    {
      userId: ctx.userId,
      isAccountOwnerForActiveOrg: isAccountOwnerForActiveOrg(ctx),
      isCompanyAdmin: ctx.membership.is_company_admin,
    },
    maintainedByUserId,
  );
}

export function orgMaintainedEditDeniedMessage(kind: "party" | "item"): string {
  return kind === "party"
    ? "Only the party maintainer, a company admin, or the account owner for this company can edit this party. You can still use it on documents."
    : "Only the item maintainer, a company admin, or the account owner for this company can edit this saved item. You can still use it in line items.";
}
