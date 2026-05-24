import type { Organization } from "@/types/database";
import type { PartySnapshot } from "@/lib/packing/types";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

/** Company profile address as a party snapshot (Bill to / Ship to on purchase orders). */
export function partySnapshotFromOrganization(
  org: Pick<
    Organization,
    | "name"
    | "gstin"
    | "org_address_line1"
    | "org_address_line2"
    | "org_city"
    | "org_state"
    | "org_pin"
    | "org_country"
    | "country_code"
    | "org_mobile"
  >,
): PartySnapshot {
  const cc = org.country_code?.trim() ?? "";
  const countryIso = cc
    ? coerceToLibphonenumberCountry(cc)
    : coerceToLibphonenumberCountry(org.org_country ?? "IN");
  return {
    name: org.name?.trim() ?? "",
    address_line1: org.org_address_line1?.trim() ?? "",
    address_line2: org.org_address_line2?.trim() ?? "",
    city: org.org_city?.trim() ?? "",
    state: org.org_state?.trim() ?? "",
    pin: org.org_pin?.trim() ?? "",
    country: countryIso,
    gstin: org.gstin?.trim() ?? "",
    contact_name: "",
    mobile: org.org_mobile?.trim() ?? "",
  };
}

export function defaultPurchaseOrderTerms(): string {
  return [
    "E&OE",
    "All matters subject to jurisdiction as per company policy / agreement.",
    "This Purchase Order is computer generated, doesn't require any signature.",
  ].join("\n");
}
