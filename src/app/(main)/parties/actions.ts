"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import type { PartySnapshot } from "@/lib/packing/types";
import { partyHasRelatedDocuments } from "@/lib/parties/party-documents";
import { requireValidIntlMobileOrNull } from "@/lib/phone/intl-mobile";
import { gstinForDatabase, partySnapshotWithGstinNormalized } from "@/lib/tax/gstin-india";
import { assertPartyEditable } from "@/lib/parties/assert-party-editable";
import { maybeLogPartyMemberEdit } from "@/lib/parties/party-member-activity";

type AddressRow = {
  organization_id: string;
  party_id: string;
  address_role: "bill_to" | "ship_to";
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

function snapshotToRow(
  organizationId: string,
  partyId: string,
  role: "bill_to" | "ship_to",
  shipSlot: number | null,
  p: PartySnapshot,
): AddressRow {
  return {
    organization_id: organizationId,
    party_id: partyId,
    address_role: role,
    ship_slot: shipSlot,
    name: p.name.trim(),
    address_line1: p.address_line1?.trim() || null,
    address_line2: p.address_line2?.trim() || null,
    city: p.city?.trim() || null,
    state: p.state?.trim() || null,
    pin: p.pin?.trim() || null,
    country: p.country?.trim() || null,
    gstin: gstinForDatabase(p.gstin),
    contact_name: p.contact_name?.trim() || null,
    mobile: p.mobile?.trim() ? requireValidIntlMobileOrNull(p.mobile) : null,
  };
}

async function findPartyByDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  displayName: string,
): Promise<string | null> {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return null;
  const { data } = await supabase
    .from("parties")
    .select("id, display_name")
    .eq("organization_id", orgId);
  const rows = (data ?? []) as { id: string; display_name: string }[];
  const hit = rows.find((r) => r.display_name.trim().toLowerCase() === needle);
  return hit?.id ?? null;
}

async function createParty(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, displayName: string) {
  const { data, error } = await supabase
    .from("parties")
    .insert({
      organization_id: orgId,
      display_name: displayName.trim(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Create an empty party row (addresses added separately). */
export async function createPartyRecord(display_name: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!display_name.trim()) throw new Error("Party name is required");
  const supabase = await createClient();
  const id = await createParty(supabase, ctx.organization.id, display_name);
  revalidatePartyPaths();
  return id;
}

export async function getPartyHasDocuments(partyId: string): Promise<boolean> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  return partyHasRelatedDocuments(ctx.organization.id, partyId);
}

async function upsertBillAddress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  partyId: string,
  p: PartySnapshot,
) {
  await supabase.from("party_addresses").delete().eq("party_id", partyId).eq("address_role", "bill_to");
  const { error } = await supabase.from("party_addresses").insert(snapshotToRow(orgId, partyId, "bill_to", null, p));
  if (error) throw error;
}

async function upsertShipSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  partyId: string,
  slot: number,
  p: PartySnapshot,
) {
  await supabase
    .from("party_addresses")
    .delete()
    .eq("party_id", partyId)
    .eq("address_role", "ship_to")
    .eq("ship_slot", slot);
  const { error } = await supabase
    .from("party_addresses")
    .insert(snapshotToRow(orgId, partyId, "ship_to", slot, p));
  if (error) throw error;
}

async function nextShipSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partyId: string,
): Promise<number> {
  const { data } = await supabase
    .from("party_addresses")
    .select("ship_slot")
    .eq("party_id", partyId)
    .eq("address_role", "ship_to");
  const used = new Set(
    ((data ?? []) as { ship_slot: number | null }[]).map((r) => r.ship_slot).filter((s): s is number => s != null),
  );
  for (let s = 1; s <= 3; s++) {
    if (!used.has(s)) return s;
  }
  return -1;
}

/** Append `ship` as the next free ship slot (1–3) on an existing party; requires billing address on that party. */
export async function appendPartyShipAddressToNextSlot(partyId: string, ship: PartySnapshot) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const orgId = ctx.organization.id;
  const supabase = await createClient();

  const { data: partyOk, error: pErr } = await supabase
    .from("parties")
    .select("id")
    .eq("id", partyId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!partyOk) throw new Error("Party not found.");

  const snap = partySnapshotWithGstinNormalized(ship);
  if (!snap.name.trim()) throw new Error("Shipping address name is required.");

  const { data: billRow } = await supabase
    .from("party_addresses")
    .select("id")
    .eq("party_id", partyId)
    .eq("address_role", "bill_to")
    .maybeSingle();
  if (!billRow) {
    throw new Error(
      "This party has no billing address. Add billing on the Parties page before saving a new shipping address.",
    );
  }

  const slot = await nextShipSlot(supabase, partyId);
  if (slot < 1) {
    throw new Error("This party already has three shipping addresses. Remove one on the Parties page.");
  }

  await upsertShipSlot(supabase, orgId, partyId, slot, snap);
  await maybeLogPartyMemberEdit(supabase, ctx, partyId, `Added shipping address ${slot} from a document.`);
  revalidatePartyPaths(partyId);
}

/**
 * Save addresses from a document into a named party (create party if needed).
 * - `bill_and_ship_same`: store bill_to and copy the same snapshot to ship slot 1.
 * - Otherwise `save_bill` / `save_ship` update bill and append ship to the next free slot (1–3).
 */
export async function upsertPartyFromDocument(input: {
  party_display_name: string;
  bill_to?: PartySnapshot;
  ship_to?: PartySnapshot;
  save_bill: boolean;
  save_ship: boolean;
  bill_and_ship_same: boolean;
}): Promise<string> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const displayName = input.party_display_name.trim();
  if (!displayName) throw new Error("Party name is required");

  const supabase = await createClient();
  const orgId = ctx.organization.id;

  let partyId = await findPartyByDisplayName(supabase, orgId, displayName);
  if (!partyId) {
    partyId = await createParty(supabase, orgId, displayName);
  } else if (input.bill_and_ship_same || input.save_bill) {
    await assertPartyEditable(supabase, ctx, partyId);
  }

  if (input.bill_and_ship_same) {
    const bill = input.bill_to;
    if (!bill?.name?.trim()) throw new Error("Billing address is required to save party");
    await upsertBillAddress(supabase, orgId, partyId, bill);
    await upsertShipSlot(supabase, orgId, partyId, 1, bill);
    revalidatePartyPaths(partyId);
    return partyId;
  }

  if (input.save_bill) {
    const bill = input.bill_to;
    if (!bill?.name?.trim()) throw new Error("Billing address is required");
    await upsertBillAddress(supabase, orgId, partyId, bill);
  }

  if (input.save_ship) {
    const ship = input.ship_to;
    if (!ship?.name?.trim()) throw new Error("Shipping address is required");
    if (!input.save_bill && !input.bill_and_ship_same) {
      const { data: billRow } = await supabase
        .from("party_addresses")
        .select("id")
        .eq("party_id", partyId)
        .eq("address_role", "bill_to")
        .maybeSingle();
      if (!billRow) {
        throw new Error(
          "Save the billing address first (or use “Billing and shipping addresses are the same”), then save the shipping address.",
        );
      }
    }
    const slot = await nextShipSlot(supabase, partyId);
    if (slot < 1)
      throw new Error("This party already has three shipping addresses. Remove one on the Parties page.");
    await upsertShipSlot(supabase, orgId, partyId, slot, ship);
    await maybeLogPartyMemberEdit(supabase, ctx, partyId, `Added shipping address ${slot} from a document.`);
  }

  revalidatePartyPaths(partyId);
  return partyId;
}

export async function upsertPartyBillOnly(input: { party_display_name: string; bill_to: PartySnapshot }) {
  return upsertPartyFromDocument({
    party_display_name: input.party_display_name,
    bill_to: input.bill_to,
    ship_to: undefined,
    save_bill: true,
    save_ship: false,
    bill_and_ship_same: false,
  });
}

function revalidatePartyPaths(partyId?: string) {
  revalidatePath("/parties");
  revalidatePath("/packing-lists/saved/parties");
  revalidatePath("/packing-lists/new");
  revalidatePath("/delivery-challans/new");
  revalidatePath("/quotations");
  revalidatePath("/quotations/new");
  if (partyId) revalidatePath(`/parties/${partyId}`);
}

export async function updatePartyDisplayName(partyId: string, display_name: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  await assertPartyEditable(supabase, ctx, partyId);
  const { error } = await supabase
    .from("parties")
    .update({ display_name: display_name.trim(), updated_at: new Date().toISOString() })
    .eq("id", partyId)
    .eq("organization_id", ctx.organization.id);
  if (error) throw error;
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
}

/** Update only contact fields on a saved address (documents keep their own snapshots). */
export async function updatePartyAddressContacts(
  addressRowId: string,
  contact_name: string,
  mobile: string,
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  const orgId = ctx.organization.id;
  const { data: row, error: selErr } = await supabase
    .from("party_addresses")
    .select("party_id, address_role, ship_slot")
    .eq("id", addressRowId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) throw new Error("Address not found");
  const partyIdRow = row.party_id as string;
  const role = (row as { address_role?: string }).address_role;
  if (role === "bill_to") {
    await assertPartyEditable(supabase, ctx, partyIdRow);
  }

  const mob = mobile.trim() ? requireValidIntlMobileOrNull(mobile) : null;
  const { error } = await supabase
    .from("party_addresses")
    .update({
      contact_name: contact_name.trim() || null,
      mobile: mob,
    })
    .eq("id", addressRowId)
    .eq("organization_id", orgId);
  if (error) throw error;

  if (role === "ship_to") {
    const slot = (row as { ship_slot?: number | null }).ship_slot ?? "?";
    await maybeLogPartyMemberEdit(
      supabase,
      ctx,
      partyIdRow,
      `Updated contact details on shipping address ${slot} (from a document).`,
    );
  }
  revalidatePartyPaths(partyIdRow);
}

export async function upsertPartyAddress(
  partyId: string,
  role: "bill_to" | "ship_to",
  shipSlot: number | null,
  p: PartySnapshot,
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!p.name.trim()) throw new Error("Name is required");
  if (role === "ship_to" && (shipSlot == null || shipSlot < 1 || shipSlot > 3)) {
    throw new Error("Shipping slot must be 1, 2, or 3");
  }

  const supabase = await createClient();
  const orgId = ctx.organization.id;
  if (role === "bill_to") {
    await assertPartyEditable(supabase, ctx, partyId);
    await upsertBillAddress(supabase, orgId, partyId, p);
  } else {
    await upsertShipSlot(supabase, orgId, partyId, shipSlot!, p);
    await maybeLogPartyMemberEdit(
      supabase,
      ctx,
      partyId,
      `Updated shipping address ${shipSlot} on the Parties page.`,
    );
  }
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
}

export async function deletePartyAddress(partyId: string, addressId: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  const { data: addr, error: aErr } = await supabase
    .from("party_addresses")
    .select("address_role, ship_slot")
    .eq("id", addressId)
    .eq("party_id", partyId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!addr) throw new Error("Address not found");
  if ((addr as { address_role?: string }).address_role === "bill_to") {
    await assertPartyEditable(supabase, ctx, partyId);
  }
  const { error } = await supabase
    .from("party_addresses")
    .delete()
    .eq("id", addressId)
    .eq("party_id", partyId)
    .eq("organization_id", ctx.organization.id);
  if (error) throw error;
  if ((addr as { address_role?: string }).address_role === "ship_to") {
    const slot = (addr as { ship_slot?: number | null }).ship_slot ?? "?";
    await maybeLogPartyMemberEdit(supabase, ctx, partyId, `Removed shipping address ${slot} on the Parties page.`);
  }
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
}

export async function deleteParty(partyId: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  await assertPartyEditable(supabase, ctx, partyId);
  if (await partyHasRelatedDocuments(ctx.organization.id, partyId)) {
    throw new Error(
      "This party is still used on a quotation, packing list, delivery challan, or material gate pass. Remove or reassign those records before deleting the party.",
    );
  }
  const { error } = await supabase.from("parties").delete().eq("id", partyId).eq("organization_id", ctx.organization.id);
  if (error) throw error;
  revalidatePath("/parties");
  revalidatePath("/packing-lists/new");
  revalidatePath("/delivery-challans/new");
  revalidatePath("/quotations/new");
}
