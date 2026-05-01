/** Minimal shape; satisfied by `FullOrgContext`. Safe for client bundles (no server-only imports). */
export type AccountOwnerForActiveOrgInput = {
  isMasterAdmin: boolean;
  entitlement: { id: string } | null;
  organization: { entitlement_id?: string | null };
};

/** Account owner (billing) for the active company’s subscription — not “owner of any subscription elsewhere”. */
export function isAccountOwnerForActiveOrg(ctx: AccountOwnerForActiveOrgInput): boolean {
  return (
    ctx.isMasterAdmin &&
    !!ctx.entitlement &&
    !!ctx.organization.entitlement_id &&
    ctx.entitlement.id === ctx.organization.entitlement_id
  );
}
