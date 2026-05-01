import type { Organization } from "@/types/database";

/** Compact multi-line communication address for visitor pass (A5 front). */
export function formatOrgAddressBlockForVisitorPass(
  org: Pick<
    Organization,
    "org_address_line1" | "org_address_line2" | "org_city" | "org_state" | "org_pin" | "org_country"
  >,
): string | null {
  const lines: string[] = [];
  const l1 = org.org_address_line1?.trim();
  const l2 = org.org_address_line2?.trim();
  if (l1) lines.push(l1);
  if (l2) lines.push(l2);
  const cityParts = [org.org_city?.trim(), org.org_state?.trim(), org.org_pin?.trim()].filter(Boolean);
  if (cityParts.length) lines.push(cityParts.join(", "));
  const ctry = org.org_country?.trim();
  if (ctry) lines.push(ctry);
  if (lines.length === 0) return null;
  return lines.join("\n");
}
