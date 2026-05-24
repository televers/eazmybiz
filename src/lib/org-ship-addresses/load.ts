import { createClient } from "@/lib/supabase/server";
import type { PartySnapshot } from "@/lib/packing/types";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

export type OrgShipAddressRow = {
  id: string;
  ship_slot: number;
  label: string | null;
  snapshot: PartySnapshot;
};

function rowToSnapshot(row: {
  name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  country: string | null;
  gstin: string | null;
  contact_name: string | null;
  mobile: string | null;
}): PartySnapshot {
  const cc = row.country?.trim() ?? "";
  return {
    name: row.name?.trim() ?? "",
    address_line1: row.address_line1?.trim() ?? "",
    address_line2: row.address_line2?.trim() ?? "",
    city: row.city?.trim() ?? "",
    state: row.state?.trim() ?? "",
    pin: row.pin?.trim() ?? "",
    country: cc ? coerceToLibphonenumberCountry(cc) : "",
    gstin: row.gstin?.trim() ?? "",
    contact_name: row.contact_name?.trim() ?? "",
    mobile: row.mobile?.trim() ?? "",
  };
}

export async function loadOrgShipAddresses(organizationId: string): Promise<OrgShipAddressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_ship_addresses")
    .select(
      "id, ship_slot, label, name, address_line1, address_line2, city, state, pin, country, gstin, contact_name, mobile",
    )
    .eq("organization_id", organizationId)
    .order("ship_slot");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    ship_slot: Number(r.ship_slot),
    label: (r.label as string | null) ?? null,
    snapshot: rowToSnapshot(r as Parameters<typeof rowToSnapshot>[0]),
  }));
}
