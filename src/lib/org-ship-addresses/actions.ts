"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { canUseFeature } from "@/lib/access";
import type { PartySnapshot } from "@/lib/packing/types";
import { partySnapshotWithGstinNormalized } from "@/lib/tax/gstin-india";
import { insertOrganizationActivity } from "@/lib/org-activity";

function snapshotToDbRow(snap: PartySnapshot) {
  const s = partySnapshotWithGstinNormalized(snap);
  return {
    name: s.name.trim(),
    address_line1: s.address_line1?.trim() || null,
    address_line2: s.address_line2?.trim() || null,
    city: s.city?.trim() || null,
    state: s.state?.trim() || null,
    pin: s.pin?.trim() || null,
    country: s.country?.trim() || null,
    gstin: s.gstin?.trim() || null,
    contact_name: s.contact_name?.trim() || null,
    mobile: s.mobile?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

/** Save or replace a warehouse / shipping address slot (1–3) on the active organization. */
export async function saveOrgShipAddress(input: {
  ship_slot: number;
  label?: string | null;
  snapshot: PartySnapshot;
}) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("Unauthorized");
  const slot = Math.floor(Number(input.ship_slot));
  if (slot < 1 || slot > 3) throw new Error("Shipping address slot must be 1, 2, or 3.");
  const snap = partySnapshotWithGstinNormalized(input.snapshot);
  if (!snap.name.trim()) throw new Error("Address name is required.");

  const supabase = await createClient();
  const orgId = ctx.organization.id;
  const row = {
    organization_id: orgId,
    ship_slot: slot,
    label: input.label?.trim() || null,
    ...snapshotToDbRow(snap),
  };

  const { error } = await supabase.from("organization_ship_addresses").upsert(row, {
    onConflict: "organization_id,ship_slot",
  });
  if (error) throw error;

  await insertOrganizationActivity(
    supabase,
    orgId,
    ctx.userId,
    `Warehouse / shipping address ${slot} updated.`,
    null,
  );
  revalidatePath("/settings/company");
  revalidatePath("/purchase-orders/new");
  revalidatePath("/purchase-orders", "layout");
}

export async function deleteOrgShipAddress(ship_slot: number) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("Unauthorized");
  const slot = Math.floor(Number(ship_slot));
  if (slot < 1 || slot > 3) throw new Error("Invalid slot.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_ship_addresses")
    .delete()
    .eq("organization_id", ctx.organization.id)
    .eq("ship_slot", slot);
  if (error) throw error;

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    `Warehouse / shipping address ${slot} removed.`,
    null,
  );
  revalidatePath("/settings/company");
  revalidatePath("/purchase-orders/new");
  revalidatePath("/purchase-orders", "layout");
}

/** Append ship-to from a purchase order as the next free org warehouse slot (1–3). */
export async function appendOrgShipAddressFromDocument(ship: PartySnapshot) {
  const ctx = await getOrgContext();
  if (!ctx || !canUseFeature(ctx, "purchase_order")) throw new Error("Unauthorized");
  const snap = partySnapshotWithGstinNormalized(ship);
  if (!snap.name.trim()) throw new Error("Shipping address name is required.");

  const supabase = await createClient();
  const orgId = ctx.organization.id;
  const row = snapshotToDbRow(snap);

  const { data, error } = await supabase.rpc("append_org_ship_address_from_po", {
    p_org_id: orgId,
    p_name: row.name,
    p_address_line1: row.address_line1,
    p_address_line2: row.address_line2,
    p_city: row.city,
    p_state: row.state,
    p_pin: row.pin,
    p_country: row.country,
    p_gstin: row.gstin,
    p_contact_name: row.contact_name,
    p_mobile: row.mobile,
  });
  if (error) throw error;

  const result = data as { ok?: boolean; error?: string; ship_slot?: number } | null;
  if (!result?.ok) {
    if (result?.error === "no free slot") {
      throw new Error(
        "Your company already has three warehouse / shipping addresses. Remove one under Company profile before saving another.",
      );
    }
    throw new Error(result?.error ?? "Could not save warehouse address");
  }

  const slot = result.ship_slot ?? 0;

  await insertOrganizationActivity(
    supabase,
    orgId,
    ctx.userId,
    `Warehouse / shipping address ${slot} saved from a purchase order.`,
    null,
  );
  revalidatePath("/settings/company");
  revalidatePath("/purchase-orders", "layout");
}
