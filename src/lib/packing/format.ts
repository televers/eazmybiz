import type { Organization } from "@/types/database";
import type { PartySnapshot } from "@/lib/packing/types";
import { countryLabel } from "@/lib/geo/iso-country-select-options";

function displayCountryLine(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^[A-Za-z]{2}$/.test(s)) return countryLabel(s.toUpperCase());
  return s;
}

export function formatConsignerBlock(org: Organization): string[] {
  const lines: string[] = [];
  if (org.name) lines.push(org.name);
  const addr = [org.org_address_line1, org.org_address_line2].filter(Boolean).join("\n");
  if (addr) lines.push(addr);
  const locParts = [
    org.org_city,
    org.org_state,
    org.org_pin,
    displayCountryLine(org.org_country),
  ].filter((x) => x != null && String(x).trim() !== "");
  const cityLine = locParts.join(", ");
  if (cityLine) lines.push(cityLine);
  if (org.gstin) lines.push(`GST No: ${org.gstin}`);
  if (org.org_email) lines.push(`Email: ${org.org_email}`);
  return lines;
}

export function formatPartyBlock(p: PartySnapshot): string[] {
  const lines: string[] = [];
  if (p.name) lines.push(p.name);
  const addr = [p.address_line1, p.address_line2].filter(Boolean).join("\n");
  if (addr) lines.push(addr);
  const locParts = [p.city, p.state, p.pin, displayCountryLine(p.country)].filter(
    (x) => x != null && String(x).trim() !== "",
  );
  const cityLine = locParts.join(", ");
  if (cityLine) lines.push(cityLine);
  if (p.gstin) lines.push(`GST No: ${p.gstin}`);
  if (p.contact_name) lines.push(`Contact: ${p.contact_name}`);
  if (p.mobile) lines.push(`Mobile: ${p.mobile}`);
  return lines;
}
