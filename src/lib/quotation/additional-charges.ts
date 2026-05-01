import {
  ADDITIONAL_CHARGE_LABEL_OTHER,
  isPresetAdditionalChargeLabel,
} from "@/lib/quotation/line-presets";

export type AdditionalChargeDraftRow = {
  labelPreset: string;
  labelCustom: string;
  amountDraft: string;
  taxDraft: string;
};

export function resolveAdditionalChargeLabel(d: AdditionalChargeDraftRow): string {
  if (d.labelPreset === ADDITIONAL_CHARGE_LABEL_OTHER) return d.labelCustom.trim();
  return d.labelPreset.trim();
}

/** Build draft row from stored label (preset vs custom). */
export function additionalChargeDraftFromSavedLabel(
  label: string,
  amountDraft: string,
  taxDraft: string,
): AdditionalChargeDraftRow {
  if (isPresetAdditionalChargeLabel(label)) {
    return { labelPreset: label, labelCustom: "", amountDraft, taxDraft };
  }
  return {
    labelPreset: ADDITIONAL_CHARGE_LABEL_OTHER,
    labelCustom: label,
    amountDraft,
    taxDraft,
  };
}
