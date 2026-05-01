/** Standard payment terms for quotations; user can pick Others and enter custom text. */
export const PAYMENT_TERM_OPTIONS = [
  "100% advance along with PO",
  "50% advance along with PO and balance 50% before material dispatch",
  "100% against proforma invoice before material dispatch",
  "100% immediately upon delivery",
  "100% within 7 days from date of delivery",
  "100% within 15 days from date of delivery",
  "100% within 30 days from date of delivery",
  "100% within 45 days from date of delivery",
] as const;

export const PAYMENT_TERM_OTHER = "__PAYMENT_TERM_OTHER__";

export function paymentTermEditorStateFromSaved(saved: string | null | undefined): {
  preset: string;
  custom: string;
} {
  const raw = saved ?? "";
  const s = raw.trim();
  if (!s) return { preset: "", custom: "" };
  if ((PAYMENT_TERM_OPTIONS as readonly string[]).includes(s)) {
    return { preset: s, custom: "" };
  }
  return { preset: PAYMENT_TERM_OTHER, custom: raw };
}
