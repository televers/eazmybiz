import type { Organization } from "@/types/database";
import type { OrgProfileSnapshotForDiff, PendingOrgProfileChange } from "./profile-types";

export type ProfileChangeDiffRow = { label: string; current: string; proposed: string };

function cell(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function orgToProfileSnapshot(org: Organization): OrgProfileSnapshotForDiff {
  return {
    name: cell(org.name),
    gstin: org.gstin ?? null,
    region: org.region ?? null,
    org_address_line1: org.org_address_line1 ?? null,
    org_address_line2: org.org_address_line2 ?? null,
    org_city: org.org_city ?? null,
    org_state: org.org_state ?? null,
    org_pin: org.org_pin ?? null,
    org_country: org.org_country ?? null,
    bank_account_holder_name: org.bank_account_holder_name ?? null,
    bank_name: org.bank_name ?? null,
    bank_branch: org.bank_branch ?? null,
    bank_account_no: org.bank_account_no ?? null,
    bank_ifsc: org.bank_ifsc ?? null,
  };
}

/** Rows where pending proposal differs from what is live on the organization today. */
export function profilePendingDiff(
  live: OrgProfileSnapshotForDiff,
  pending: PendingOrgProfileChange,
): ProfileChangeDiffRow[] {
  const rows: ProfileChangeDiffRow[] = [];
  const dash = "—";

  if (cell(pending.proposed_name) !== cell(live.name)) {
    rows.push({
      label: "Company name",
      current: cell(live.name) || dash,
      proposed: cell(pending.proposed_name) || dash,
    });
  }
  if (cell(pending.proposed_gstin) !== cell(live.gstin)) {
    rows.push({
      label: "GSTIN / tax ID",
      current: cell(live.gstin) || dash,
      proposed: cell(pending.proposed_gstin) || dash,
    });
  }
  if (cell(pending.proposed_region) !== cell(live.region)) {
    rows.push({
      label: "Region / state",
      current: cell(live.region) || dash,
      proposed: cell(pending.proposed_region) || dash,
    });
  }
  if (cell(pending.proposed_org_address_line1) !== cell(live.org_address_line1)) {
    rows.push({
      label: "Address line 1",
      current: cell(live.org_address_line1) || dash,
      proposed: cell(pending.proposed_org_address_line1) || dash,
    });
  }
  if (cell(pending.proposed_org_address_line2) !== cell(live.org_address_line2)) {
    rows.push({
      label: "Address line 2",
      current: cell(live.org_address_line2) || dash,
      proposed: cell(pending.proposed_org_address_line2) || dash,
    });
  }
  if (cell(pending.proposed_org_city) !== cell(live.org_city)) {
    rows.push({
      label: "City",
      current: cell(live.org_city) || dash,
      proposed: cell(pending.proposed_org_city) || dash,
    });
  }
  if (cell(pending.proposed_org_state) !== cell(live.org_state)) {
    rows.push({
      label: "State",
      current: cell(live.org_state) || dash,
      proposed: cell(pending.proposed_org_state) || dash,
    });
  }
  if (cell(pending.proposed_org_pin) !== cell(live.org_pin)) {
    rows.push({
      label: "PIN / ZIP",
      current: cell(live.org_pin) || dash,
      proposed: cell(pending.proposed_org_pin) || dash,
    });
  }
  if (cell(pending.proposed_org_country) !== cell(live.org_country)) {
    rows.push({
      label: "Country (address)",
      current: cell(live.org_country) || dash,
      proposed: cell(pending.proposed_org_country) || dash,
    });
  }
  if (cell(pending.proposed_bank_account_holder_name) !== cell(live.bank_account_holder_name)) {
    rows.push({
      label: "Bank account holder",
      current: cell(live.bank_account_holder_name) || dash,
      proposed: cell(pending.proposed_bank_account_holder_name) || dash,
    });
  }
  if (cell(pending.proposed_bank_name) !== cell(live.bank_name)) {
    rows.push({
      label: "Bank name",
      current: cell(live.bank_name) || dash,
      proposed: cell(pending.proposed_bank_name) || dash,
    });
  }
  if (cell(pending.proposed_bank_branch) !== cell(live.bank_branch)) {
    rows.push({
      label: "Bank branch",
      current: cell(live.bank_branch) || dash,
      proposed: cell(pending.proposed_bank_branch) || dash,
    });
  }
  if (cell(pending.proposed_bank_account_no) !== cell(live.bank_account_no)) {
    rows.push({
      label: "Bank account number",
      current: cell(live.bank_account_no) || dash,
      proposed: cell(pending.proposed_bank_account_no) || dash,
    });
  }
  if (cell(pending.proposed_bank_ifsc) !== cell(live.bank_ifsc)) {
    rows.push({
      label: "Bank IFSC",
      current: cell(live.bank_ifsc) || dash,
      proposed: cell(pending.proposed_bank_ifsc) || dash,
    });
  }

  return rows;
}
