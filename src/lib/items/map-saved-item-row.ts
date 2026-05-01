import type { SavedItemRow } from "@/lib/items/saved-item-types";

export function mapRowToSavedItem(r: Record<string, unknown>): SavedItemRow {
  const mb = r.managed_by_user_id;
  return {
    id: String(r.id ?? ""),
    description: String(r.description ?? ""),
    default_unit: String(r.default_unit ?? "Pcs"),
    make_service_provider: String(r.make_service_provider ?? ""),
    model_part_no_description: String(r.model_part_no_description ?? ""),
    hsn_sac: String(r.hsn_sac ?? ""),
    managed_by_user_id: mb != null && String(mb).trim() !== "" ? String(mb) : null,
  };
}
