import type { FeaturePermissionMap } from "@/lib/access";
import type { AccountEntitlement, Membership, Organization } from "@/types/database";

export type OrgContext = {
  organization: Organization;
  membership: Membership;
  entitlement: AccountEntitlement | null;
};

export type FullOrgContext = OrgContext & {
  userId: string;
  userEmail: string | undefined;
  isMasterAdmin: boolean;
  canManageMemberships: boolean;
  featurePermissions: FeaturePermissionMap;
  accessibleOrganizations: { id: string; name: string }[];
};
