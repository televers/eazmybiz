import type { QuotationAdditionalCharge, QuotationLine } from "@/lib/quotation/types";
import { computeAdditionalCharge, computeLineFromInputs } from "@/lib/quotation/compute";
import { partyFromJson } from "@/lib/packing/parse";

const defaultLine = () =>
  computeLineFromInputs({
    description: "",
    make_service_provider: "",
    model_part_no_description: "",
    hsn_sac: "",
    unit: "Pcs",
    qty: 1,
    unit_price: 0,
    tax_percent: 0,
    save_as_item: true,
  });

export function linesFromJson(raw: unknown): QuotationLine[] {
  if (!Array.isArray(raw)) return [defaultLine()];
  const out: QuotationLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    let description = String(o.description ?? "");
    const makeSvc = String(o.make_service_provider ?? "");
    let modelPart = String(o.model_part_no_description ?? "");
    const legacySub = String(o.make_model_part_no ?? "");

    if (legacySub.trim() && !modelPart.trim()) {
      modelPart = legacySub;
    }

    if (!description.trim() && modelPart.trim() && !makeSvc.trim()) {
      description = modelPart;
      modelPart = "";
    }

    const taxRaw = String(o.tax_percent ?? "").replace(",", ".");
    const taxParsed = Number.parseFloat(taxRaw);
    const taxPercent = Number.isFinite(taxParsed) ? taxParsed : 0;

    const base = computeLineFromInputs({
      description,
      make_service_provider: makeSvc,
      model_part_no_description: modelPart,
      hsn_sac: String(o.hsn_sac ?? ""),
      unit: String(o.unit ?? "Pcs"),
      qty: Number(o.qty) || 0,
      unit_price: Number(o.unit_price) || 0,
      tax_percent: taxPercent,
      ...(typeof o.save_as_item === "boolean" ? { save_as_item: o.save_as_item } : {}),
    });
    const pid = o.item_preset_id;
    out.push({
      ...base,
      ...(typeof pid === "string" && pid ? { item_preset_id: pid } : {}),
    });
  }
  return out.length ? out : [defaultLine()];
}

export function billToFromJson(raw: unknown) {
  return partyFromJson(raw);
}

/** Parse stored JSON (label, amount, tax_percent); returns computed rows, max two. */
export function additionalChargesFromJson(raw: unknown): QuotationAdditionalCharge[] {
  if (!Array.isArray(raw)) return [];
  const out: QuotationAdditionalCharge[] = [];
  for (const row of raw.slice(0, 2)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = String(o.label ?? "");
    const amtIn = Number(o.amount);
    const amount = Number.isFinite(amtIn) ? amtIn : 0;
    const taxRaw = String(o.tax_percent ?? "").replace(",", ".");
    const taxParsed = Number.parseFloat(taxRaw);
    const tax_percent = Number.isFinite(taxParsed) ? taxParsed : 0;
    out.push(computeAdditionalCharge({ label, amount, tax_percent }));
  }
  return out;
}
