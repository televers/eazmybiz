import type { FullOrgContext } from "@/lib/org-context-types";
import { isAccountOwnerForActiveOrg } from "@/lib/org/is-account-owner-for-active-org";

/** Item display name and unit: company admin or account owner for this org only (not item maintainer alone). */
export function canEditSavedItemNameAndUnit(ctx: FullOrgContext): boolean {
  return isAccountOwnerForActiveOrg(ctx) || ctx.membership.is_company_admin;
}
