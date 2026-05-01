export type PendingOrgProfileChange = {
  id: string;
  organization_id: string;
  requested_by_user_id: string;
  proposed_name: string;
  proposed_gstin: string | null;
  proposed_bank_account_holder_name: string | null;
  proposed_bank_name: string | null;
  proposed_bank_branch: string | null;
  proposed_bank_account_no: string | null;
  proposed_bank_ifsc: string | null;
  proposed_region: string | null;
  proposed_org_address_line1: string | null;
  proposed_org_address_line2: string | null;
  proposed_org_city: string | null;
  proposed_org_state: string | null;
  proposed_org_pin: string | null;
  proposed_org_country: string | null;
  created_at: string;
};

export type OrgProfileSnapshotForDiff = {
  name: string;
  gstin: string | null;
  region: string | null;
  org_address_line1: string | null;
  org_address_line2: string | null;
  org_city: string | null;
  org_state: string | null;
  org_pin: string | null;
  org_country: string | null;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
};
