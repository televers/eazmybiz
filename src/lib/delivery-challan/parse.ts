import { computeDcLineFromInputs } from "@/lib/delivery-challan/compute";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";

export function emptyDcLine(): DeliveryChallanLine {
  return computeDcLineFromInputs({
    description: "",
    hsn: "",
    unit: "Pcs",
    qty: 1,
    unit_price: 0,
    tax_percent: 0,
    save_as_item: true,
  });
}

/**
 * Parse line_items JSON into computed lines.
 * Legacy: { description, qty, uom?, unit?, hsn? } without prices → zeros.
 */
export function dcLinesFromJson(raw: unknown): DeliveryChallanLine[] {
  if (!Array.isArray(raw)) return [emptyDcLine()];
  const out: DeliveryChallanLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const uom = o.uom != null ? String(o.uom) : "";
    const unit = o.unit != null ? String(o.unit) : uom || "Pcs";
    const taxRaw = String(o.tax_percent ?? "").replace(",", ".");
    const taxParsed = Number.parseFloat(taxRaw);
    const taxPercent = Number.isFinite(taxParsed) ? taxParsed : 0;
    const hsn = String(o.hsn ?? o.hsn_sac ?? "");
    const base = computeDcLineFromInputs({
      description: String(o.description ?? ""),
      make_service_provider: String(o.make_service_provider ?? ""),
      model_part_no_description: String(o.model_part_no_description ?? ""),
      hsn,
      unit,
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
  return out.length ? out : [emptyDcLine()];
}
