/** Standard delivery period choices for quotations (stored as the exact string in `delivery_period`). */

export const DELIVERY_PERIOD_STANDARD_OPTIONS = [
  "Immediately upon PO / payment",
  "Within one week from date of PO / payment",
  "Within one week from date of PO",
  "Within 2 weeks from date of PO / payment",
  "Within 2 weeks from date of PO",
  "Within 4 weeks from date of PO / payment",
  "Within 4 weeks from date of PO",
  "Within 6 weeks from date of PO / payment",
  "Within 6 weeks from date of PO",
  "Within 8 weeks from date of PO / payment",
  "Within 8 weeks from date of PO",
  "Within 12 weeks from date of PO / payment",
  "Within 12 weeks from date of PO",
] as const;

export const DELIVERY_PERIOD_OTHER = "__other__";

const STANDARD_SET = new Set<string>(DELIVERY_PERIOD_STANDARD_OPTIONS);

export function deliveryPeriodEditorStateFromSaved(saved: string | null | undefined): {
  preset: string;
  custom: string;
} {
  const t = String(saved ?? "").trim();
  if (!t) return { preset: "", custom: "" };
  if (STANDARD_SET.has(t)) return { preset: t, custom: "" };
  const ci = DELIVERY_PERIOD_STANDARD_OPTIONS.find((o) => o.toLowerCase() === t.toLowerCase());
  if (ci) return { preset: ci, custom: "" };
  return { preset: DELIVERY_PERIOD_OTHER, custom: t };
}

/** Value persisted on the quotation row. */
export function formatDeliveryPeriodForSave(preset: string, custom: string): string {
  if (preset === DELIVERY_PERIOD_OTHER) return custom.trim();
  if (preset && STANDARD_SET.has(preset)) return preset;
  return "";
}
