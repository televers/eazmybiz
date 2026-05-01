import type { PartySnapshot } from "@/lib/packing/types";
import type { Organization } from "@/types/database";

export type PartyAddressLabelSize = "a4" | "a5" | "thermal";

const addrPart = (s: string | null | undefined) => (s != null && String(s).trim() !== "" ? String(s).trim() : null);

/** Lines for "Shipped From" (organization). */
export function linesShippedFromOrganization(org: Organization): string[] {
  const lines: string[] = [];
  const name = addrPart(org.name);
  if (name) lines.push(name);
  const a1 = addrPart(org.org_address_line1);
  const a2 = addrPart(org.org_address_line2);
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  const city = addrPart(org.org_city);
  const state = addrPart(org.org_state);
  const pin = addrPart(org.org_pin);
  const cityState = [city, state].filter(Boolean).join(", ");
  const tail = [cityState, pin].filter(Boolean).join(pin ? " " : "");
  if (tail) lines.push(tail);
  const country = addrPart(org.org_country);
  if (country) lines.push(country);
  const gst = addrPart(org.gstin);
  if (gst) lines.push(`GSTIN: ${gst}`);
  return lines;
}

/** Lines for a party snapshot (ship-to or bill). */
export function linesFromPartySnapshot(s: PartySnapshot): string[] {
  const lines: string[] = [];
  const name = addrPart(s.name);
  if (name) lines.push(name);
  const a1 = addrPart(s.address_line1);
  const a2 = addrPart(s.address_line2);
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  const city = addrPart(s.city);
  const state = addrPart(s.state);
  const pin = addrPart(s.pin);
  const cityState = [city, state].filter(Boolean).join(", ");
  const tail = [cityState, pin].filter(Boolean).join(pin ? " " : "");
  if (tail) lines.push(tail);
  const country = addrPart(s.country);
  if (country) lines.push(country);
  const gst = addrPart(s.gstin);
  if (gst) lines.push(`GSTIN: ${gst}`);
  const contact = addrPart(s.contact_name);
  const mob = addrPart(s.mobile);
  if (contact || mob) lines.push([contact, mob].filter(Boolean).join(" · "));
  return lines;
}
