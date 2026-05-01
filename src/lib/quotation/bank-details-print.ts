import type { Organization } from "@/types/database";

type BankFields = Pick<
  Organization,
  "bank_account_holder_name" | "bank_name" | "bank_branch" | "bank_account_no" | "bank_ifsc"
>;

export function hasQuotationBankDetails(org: BankFields): boolean {
  return [
    org.bank_account_holder_name,
    org.bank_name,
    org.bank_branch,
    org.bank_account_no,
    org.bank_ifsc,
  ].some((x) => x != null && String(x).trim() !== "");
}

/** Lines for quotation print/PDF: first three labels on their own line; branch + IFSC on one line. */
export function formatQuotationBankDetailLines(org: BankFields): string[] {
  const lines: string[] = [];
  const holder = org.bank_account_holder_name?.trim();
  const name = org.bank_name?.trim();
  const acct = org.bank_account_no?.trim();
  const branch = org.bank_branch?.trim();
  const ifsc = org.bank_ifsc?.trim();
  if (holder) lines.push(`Account Holder Name: ${holder}`);
  if (name) lines.push(`Bank Name: ${name}`);
  if (acct) lines.push(`Bank Account No.: ${acct}`);
  const branchLabel = branch ? `Branch Name: ${branch}` : "";
  const ifscLabel = ifsc ? `IFSC Code: ${ifsc}` : "";
  if (branchLabel || ifscLabel) {
    lines.push([branchLabel, ifscLabel].filter(Boolean).join("   "));
  }
  return lines;
}
