"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type FullOrgContext } from "@/lib/org";
import { deleteParty as deletePartyRow } from "@/app/(main)/parties/actions";
import { canEditOrgMaintainedRecord, orgMaintainedEditDeniedMessage } from "@/lib/access/org-maintained-record";
import { canEditSavedItemNameAndUnit } from "@/lib/items/can-edit-saved-item-name-unit";
import { maybeLogSavedItemMemberEdit } from "@/lib/items/item-member-activity";

export async function deleteSavedParty(id: string) {
  await deletePartyRow(id);
  revalidatePath("/packing-lists/saved/parties");
}

export async function deleteSavedPartyForm(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSavedParty(id);
}

export async function createSavedItemPreset(input: {
  description: string;
  defaultUnit: string;
  make_service_provider?: string;
  model_part_no_description?: string;
  hsn_sac?: string;
}) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!input.description.trim()) throw new Error("Item / product / service name is required");
  if (!input.defaultUnit.trim()) throw new Error("Unit is required");

  const supabase = await createClient();
  const { error } = await supabase.from("saved_item_presets").insert({
    organization_id: ctx.organization.id,
    description: input.description.trim(),
    default_unit: input.defaultUnit.trim(),
    make_service_provider: (input.make_service_provider ?? "").trim() || "",
    model_part_no_description: (input.model_part_no_description ?? "").trim() || "",
    hsn_sac: (input.hsn_sac ?? "").trim() || "",
  });

  if (error) throw error;
  revalidatePath("/items");
  revalidatePath("/packing-lists/saved/items");
  revalidatePath("/packing-lists/new");
  revalidatePath("/quotations/new");
  revalidatePath("/delivery-challans/new");
}

async function requireSavedItemEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: FullOrgContext,
  presetId: string,
) {
  const { data, error } = await supabase
    .from("saved_item_presets")
    .select("managed_by_user_id")
    .eq("id", presetId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Item not found.");
  if (!canEditOrgMaintainedRecord(ctx, (data as { managed_by_user_id?: string | null }).managed_by_user_id)) {
    throw new Error(orgMaintainedEditDeniedMessage("item"));
  }
}

export async function updateSavedItemPreset(
  id: string,
  input: {
    description: string;
    default_unit: string;
    make_service_provider: string;
    model_part_no_description: string;
    hsn_sac: string;
  },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: current, error: curErr } = await supabase
    .from("saved_item_presets")
    .select("description, default_unit, make_service_provider, model_part_no_description, hsn_sac")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (curErr) throw curErr;
  if (!current) throw new Error("Item not found.");

  const row = current as {
    description: string;
    default_unit: string;
    make_service_provider: string;
    model_part_no_description: string;
    hsn_sac: string;
  };

  const canNameUnit = canEditSavedItemNameAndUnit(ctx);
  const description = canNameUnit ? input.description.trim() : row.description;
  const default_unit = canNameUnit ? input.default_unit.trim() : row.default_unit;
  if (canNameUnit) {
    if (!description) throw new Error("Item / product / service name is required");
    if (!default_unit) throw new Error("Unit is required");
  }

  const make_service_provider = input.make_service_provider.trim() || "";
  const model_part_no_description = input.model_part_no_description.trim() || "";
  const hsn_sac = input.hsn_sac.trim() || "";

  const beforeTrio = {
    hsn_sac: row.hsn_sac ?? "",
    make_service_provider: row.make_service_provider ?? "",
    model_part_no_description: row.model_part_no_description ?? "",
  };

  const { error } = await supabase
    .from("saved_item_presets")
    .update({
      description,
      default_unit,
      make_service_provider,
      model_part_no_description,
      hsn_sac,
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);

  if (error) throw error;

  await maybeLogSavedItemMemberEdit(
    supabase,
    ctx,
    id,
    beforeTrio,
    { hsn_sac, make_service_provider, model_part_no_description },
    row.description,
  );

  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  revalidatePath("/packing-lists/new");
  revalidatePath("/quotations/new");
  revalidatePath("/delivery-challans/new");
}

export async function deleteSavedItemPreset(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  await requireSavedItemEditable(supabase, ctx, id);
  const { data: inUse, error: useErr } = await supabase.rpc("saved_item_preset_is_in_use", {
    p_organization_id: ctx.organization.id,
    p_preset_id: id,
  });
  if (useErr) throw useErr;
  if (inUse === true) {
    throw new Error(
      "This item is used on a quotation, packing list, or delivery challan. Remove it from those documents before deleting.",
    );
  }

  const { error } = await supabase
    .from("saved_item_presets")
    .delete()
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);

  if (error) throw error;
  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  revalidatePath("/packing-lists/saved/items");
}

export async function deleteSavedItemPresetForm(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  await deleteSavedItemPreset(id);
  redirect("/items");
}
