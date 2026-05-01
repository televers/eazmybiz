import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";
import type { PackingLine, PackingPackage } from "@/lib/packing/types";
import type { QuotationLine } from "@/lib/quotation/types";

async function insertSavedItemPresetRow(
  supabase: SupabaseClient,
  organizationId: string,
  row: {
    description: string;
    default_unit: string;
    make_service_provider: string;
    model_part_no_description: string;
    hsn_sac: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("saved_item_presets")
    .insert({
      organization_id: organizationId,
      description: row.description.trim(),
      default_unit: row.default_unit.trim() || "Pcs",
      make_service_provider: row.make_service_provider.trim() || "",
      model_part_no_description: row.model_part_no_description.trim() || "",
      hsn_sac: row.hsn_sac.trim() || "",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

function stripSave<T extends { save_as_item?: boolean }>(line: T): Omit<T, "save_as_item"> {
  const { save_as_item, ...rest } = line;
  void save_as_item;
  return rest;
}

/** Insert new `saved_item_presets` rows when `save_as_item` and no `item_preset_id`. Never updates existing presets from documents. */
export async function materializeQuotationLinesForSave(
  supabase: SupabaseClient,
  organizationId: string,
  lines: QuotationLine[],
): Promise<QuotationLine[]> {
  const out: QuotationLine[] = [];
  for (const line of lines) {
    if (
      line.save_as_item &&
      !line.item_preset_id &&
      line.description.trim() &&
      line.unit?.trim()
    ) {
      const id = await insertSavedItemPresetRow(supabase, organizationId, {
        description: line.description,
        default_unit: line.unit,
        make_service_provider: line.make_service_provider ?? "",
        model_part_no_description: line.model_part_no_description ?? "",
        hsn_sac: line.hsn_sac ?? "",
      });
      out.push({ ...stripSave(line), item_preset_id: id });
    } else {
      out.push(stripSave(line) as QuotationLine);
    }
  }
  return out;
}

export async function materializePackingPackagesForSave(
  supabase: SupabaseClient,
  organizationId: string,
  packages: PackingPackage[],
): Promise<PackingPackage[]> {
  return Promise.all(
    packages.map(async (pkg) => {
      const lines: PackingLine[] = [];
      for (const line of pkg.lines) {
        if (
          line.save_as_item &&
          !line.item_preset_id &&
          line.description.trim() &&
          line.unit?.trim()
        ) {
          const id = await insertSavedItemPresetRow(supabase, organizationId, {
            description: line.description,
            default_unit: line.unit,
            make_service_provider: line.make_service_provider ?? "",
            model_part_no_description: line.model_part_no_description ?? "",
            hsn_sac: line.hsn_sac ?? "",
          });
          lines.push({ ...stripSave(line), item_preset_id: id });
        } else {
          lines.push(stripSave(line) as PackingLine);
        }
      }
      return { ...pkg, lines };
    }),
  );
}

export async function materializeDcLinesForSave(
  supabase: SupabaseClient,
  organizationId: string,
  lines: DeliveryChallanLine[],
): Promise<DeliveryChallanLine[]> {
  const out: DeliveryChallanLine[] = [];
  for (const line of lines) {
    if (
      line.save_as_item &&
      !line.item_preset_id &&
      line.description.trim() &&
      line.unit?.trim()
    ) {
      const id = await insertSavedItemPresetRow(supabase, organizationId, {
        description: line.description,
        default_unit: line.unit,
        make_service_provider: line.make_service_provider ?? "",
        model_part_no_description: line.model_part_no_description ?? "",
        hsn_sac: line.hsn ?? "",
      });
      out.push({ ...stripSave(line), item_preset_id: id });
    } else {
      out.push(stripSave(line) as DeliveryChallanLine);
    }
  }
  return out;
}
