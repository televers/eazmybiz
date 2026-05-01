import type { QuotationAdditionalCharge } from "@/lib/quotation/types";
import type { QuotationLine } from "@/lib/quotation/types";
import {
  computeAdditionalCharge,
  quotationTotals,
  quotationTotalsWithAdditionalCharges,
} from "@/lib/quotation/compute";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";

/** Same math as quotation line; goods only — single HSN/SAC field (optional). */
export function computeDcLineFromInputs(input: {
  description: string;
  make_service_provider?: string;
  model_part_no_description?: string;
  hsn: string;
  unit: string;
  qty: number;
  unit_price: number;
  tax_percent: number;
  item_preset_id?: string | null;
  save_as_item?: boolean;
}): DeliveryChallanLine {
  const qIn = Number(input.qty);
  const q = Number.isFinite(qIn) ? Math.round(qIn * 1000) / 1000 : 0;
  const upIn = Number(input.unit_price);
  const up = Number.isFinite(upIn) ? Math.round(upIn * 10000) / 10000 : 0;
  const taxRaw = String(input.tax_percent).replace(",", ".").trim();
  const tpParsed = Number.parseFloat(taxRaw);
  const tp = Number.isFinite(tpParsed) ? tpParsed : 0;
  const taxable = Math.round(q * up * 100) / 100;
  const tax = Math.round(((taxable * tp) / 100) * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;
  const unitRaw = String(input.unit ?? "");
  const unitTrimmed = unitRaw.trim();
  const unitStored = unitTrimmed === "" ? "" : unitTrimmed.slice(0, 32);
  return {
    description: String(input.description ?? ""),
    make_service_provider: String(input.make_service_provider ?? ""),
    model_part_no_description: String(input.model_part_no_description ?? ""),
    hsn: String(input.hsn ?? ""),
    unit: unitStored,
    qty: q,
    unit_price: up,
    taxable_value: taxable,
    tax_percent: tp,
    tax_amount: tax,
    line_total: total,
    ...(input.item_preset_id != null && input.item_preset_id !== ""
      ? { item_preset_id: input.item_preset_id }
      : {}),
    ...(input.save_as_item !== undefined ? { save_as_item: input.save_as_item } : {}),
  };
}

export function dcTotals(lines: DeliveryChallanLine[]) {
  return quotationTotals(lines as unknown as QuotationLine[]);
}

export function dcTotalsWithAdditionalCharges(
  lines: DeliveryChallanLine[],
  charges: QuotationAdditionalCharge[],
) {
  return quotationTotalsWithAdditionalCharges(lines as unknown as QuotationLine[], charges);
}

export { computeAdditionalCharge };

export function normalizeDcLineForSave(l: DeliveryChallanLine): DeliveryChallanLine {
  return computeDcLineFromInputs({
    description: l.description.trim(),
    make_service_provider: l.make_service_provider ?? "",
    model_part_no_description: l.model_part_no_description ?? "",
    hsn: l.hsn.trim(),
    unit: l.unit.trim() || "Pcs",
    qty: l.qty,
    unit_price: l.unit_price,
    tax_percent: l.tax_percent,
    item_preset_id: l.item_preset_id,
    save_as_item: l.item_preset_id ? undefined : l.save_as_item,
  });
}
