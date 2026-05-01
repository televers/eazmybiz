/** Row from `saved_item_presets` (items master). */
export type SavedItemRow = {
  id: string;
  description: string;
  default_unit: string;
  make_service_provider: string;
  model_part_no_description: string;
  hsn_sac: string;
  /** User who may edit this preset with admins / owner; null = legacy (admins / owner only). */
  managed_by_user_id: string | null;
};
