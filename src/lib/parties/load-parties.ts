import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PartySnapshot } from "@/lib/packing/types";

export type PartyShipEntry = {
  id: string;
  slot: number;
  snapshot: PartySnapshot;
};

export type PartyListRow = {
  id: string;
  display_name: string;
  updated_at: string;
  /** User who may edit this party with admins / owner; null = legacy row (admins / owner only). */
  managed_by_user_id: string | null;
  bill_to: PartySnapshot;
  bill_address_id: string | null;
  ship_tos: PartyShipEntry[];
};

export type PartyAddressRow = {
  id: string;
  party_id: string;
  address_role: string;
  ship_slot: number | null;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  country: string | null;
  gstin: string | null;
  contact_name: string | null;
  mobile: string | null;
};

type AddrRow = PartyAddressRow;

function toSnapshot(r: AddrRow): PartySnapshot {
  return {
    name: r.name ?? "",
    address_line1: r.address_line1 ?? "",
    address_line2: r.address_line2 ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    pin: r.pin ?? "",
    country: r.country ?? "",
    gstin: r.gstin ?? "",
    contact_name: r.contact_name ?? "",
    mobile: r.mobile ?? "",
  };
}

const emptyBill: PartySnapshot = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pin: "",
  country: "",
  gstin: "",
  contact_name: "",
  mobile: "",
};

/** Build a list row from party row + address rows (e.g. party detail page). */
export function buildPartyListRow(
  party: { id: string; display_name: string; updated_at: string; managed_by_user_id?: string | null },
  addrRows: PartyAddressRow[],
): PartyListRow {
  const bill = addrRows.find((r) => r.address_role === "bill_to") ?? null;
  const ships = addrRows
    .filter((r) => r.address_role === "ship_to" && r.ship_slot != null)
    .sort((a, b) => (a.ship_slot ?? 0) - (b.ship_slot ?? 0))
    .map((r) => ({
      id: r.id,
      slot: r.ship_slot!,
      snapshot: toSnapshot(r),
    }));
  return {
    id: party.id,
    display_name: party.display_name,
    updated_at: party.updated_at,
    managed_by_user_id: party.managed_by_user_id ?? null,
    bill_to: bill ? toSnapshot(bill) : { ...emptyBill },
    bill_address_id: bill?.id ?? null,
    ship_tos: ships,
  };
}

export async function loadPartiesWithAddresses(organizationId: string): Promise<PartyListRow[]> {
  const supabase = await createClient();
  const { data: parties } = await supabase
    .from("parties")
    .select("id, display_name, updated_at, managed_by_user_id")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  const { data: addrs } = await supabase.from("party_addresses").select("*").eq("organization_id", organizationId);

  const byParty = new Map<string, AddrRow[]>();
  for (const a of (addrs ?? []) as AddrRow[]) {
    const list = byParty.get(a.party_id) ?? [];
    list.push(a);
    byParty.set(a.party_id, list);
  }

  const out: PartyListRow[] = [];
  for (const p of (parties ?? []) as {
    id: string;
    display_name: string;
    updated_at: string;
    managed_by_user_id?: string | null;
  }[]) {
    const rows = byParty.get(p.id) ?? [];
    out.push(buildPartyListRow(p, rows));
  }
  return out;
}

/** Deduplicates within one RSC request (e.g. layout + other work sharing the same pass). */
export const loadPartiesWithAddressesCached = cache(loadPartiesWithAddresses);
