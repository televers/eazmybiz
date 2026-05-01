/**
 * Incoterms 2020 (ICC) — eleven rules for any mode(s) of transport.
 * UI: standard preset + place; "Others" for non-standard wording.
 */
export const INCOTERMS_2020 = [
  { code: "EXW", label: "Ex Works" },
  { code: "FCA", label: "Free Carrier" },
  { code: "FAS", label: "Free Alongside Ship" },
  { code: "FOB", label: "Free On Board" },
  { code: "CFR", label: "Cost and Freight" },
  { code: "CIF", label: "Cost, Insurance and Freight" },
  { code: "CPT", label: "Carriage Paid To" },
  { code: "CIP", label: "Carriage and Insurance Paid To" },
  { code: "DAP", label: "Delivered at Place" },
  { code: "DPU", label: "Delivered at Place Unloaded" },
  { code: "DDP", label: "Delivered Duty Paid" },
] as const;

export const INCOTERM_OTHER = "__INCO_TERM_OTHER__";

function isKnownIncotermCode(s: string): boolean {
  return INCOTERMS_2020.some((r) => r.code === s);
}

/**
 * Parse saved `delivery_inco_term` into editor fields.
 * Recognizes a leading Incoterm 2020 code followed by a separator or end of string.
 */
export function deliveryIncoEditorStateFromSaved(saved: string | null | undefined): {
  preset: string;
  place: string;
  custom: string;
} {
  const raw = saved ?? "";
  const t = raw.trim();
  if (!t) return { preset: "", place: "", custom: "" };

  for (const { code } of INCOTERMS_2020) {
    if (!t.startsWith(code)) continue;
    if (t.length === code.length) {
      return { preset: code, place: "", custom: "" };
    }
    const after = t.slice(code.length);
    if (!/^[,;\s—–-]/.test(after)) continue;
    const place = after.replace(/^[,;\s—–-]+/, "").trim();
    return { preset: code, place, custom: "" };
  }

  return { preset: INCOTERM_OTHER, place: "", custom: raw };
}

/** Single line stored on the quotation and shown on print/PDF. */
export function formatDeliveryIncoForSave(preset: string, place: string, custom: string): string {
  if (preset === INCOTERM_OTHER) return custom.trim();
  if (!preset || !isKnownIncotermCode(preset)) return custom.trim();
  const p = place.trim();
  if (!p) return preset;
  return `${preset} — ${p}`;
}
