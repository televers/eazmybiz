/** Common units for quotation line items; user can pick "Other" and type any value. */
export const QUOTATION_UNIT_OPTIONS = [
  "Numbers",
  "Pcs",
  "Meter",
  "KG",
  "Packet",
  "Lumpsum",
  "Set",
  "Ton",
  "Litre",
  "Sq.M",
] as const;

export const QUOTATION_UNIT_OTHER = "__OTHER__";

export function isPresetQuotationUnit(unit: string): boolean {
  return (QUOTATION_UNIT_OPTIONS as readonly string[]).includes(unit);
}

/** GST-style presets; user can pick "Other" and enter any decimal %. */
export const TAX_PERCENT_PRESETS = [0, 3, 5, 12, 18, 28, 40] as const;

export const TAX_PERCENT_OTHER = "__TAX_OTHER__";

export function isPresetTaxPercent(n: number): boolean {
  return TAX_PERCENT_PRESETS.some((p) => Math.abs(p - n) < 1e-9);
}

/** Standard additional charge labels; user can pick "Other" and type a custom label. */
export const ADDITIONAL_CHARGE_LABEL_OPTIONS = [
  "Packing & forwarding",
  "Transportation",
  "Handling",
  "Labour charges",
  "Insurance",
  "Documentation charges",
] as const;

export const ADDITIONAL_CHARGE_LABEL_OTHER = "__OTHER__";

export function isPresetAdditionalChargeLabel(label: string): boolean {
  return (ADDITIONAL_CHARGE_LABEL_OPTIONS as readonly string[]).includes(label);
}
