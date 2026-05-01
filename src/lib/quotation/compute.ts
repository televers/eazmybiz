import type { QuotationAdditionalCharge, QuotationLine } from "@/lib/quotation/types";

export function computeLineFromInputs(input: {
  description: string;
  make_service_provider: string;
  model_part_no_description: string;
  hsn_sac: string;
  unit: string;
  qty: number;
  unit_price: number;
  tax_percent: number;
  item_preset_id?: string | null;
  save_as_item?: boolean;
}): QuotationLine {
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
    hsn_sac: String(input.hsn_sac ?? ""),
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

export function quotationTotals(lines: QuotationLine[]) {
  let qty = 0;
  let taxable = 0;
  let tax = 0;
  let grand = 0;
  for (const l of lines) {
    qty += l.qty;
    taxable += l.taxable_value;
    tax += l.tax_amount;
    grand += l.line_total;
  }
  return {
    qty: Math.round(qty * 1000) / 1000,
    taxable_value: Math.round(taxable * 100) / 100,
    tax_amount: Math.round(tax * 100) / 100,
    grand_total: Math.round(grand * 100) / 100,
  };
}

export function computeAdditionalCharge(input: {
  label: string;
  amount: number;
  tax_percent: number;
}): QuotationAdditionalCharge {
  const label = String(input.label ?? "").trim();
  const amtIn = Number(input.amount);
  const amount = Number.isFinite(amtIn) ? Math.round(amtIn * 100) / 100 : 0;
  const taxRaw = String(input.tax_percent).replace(",", ".").trim();
  const tpParsed = Number.parseFloat(taxRaw);
  const tax_percent = Number.isFinite(tpParsed) ? tpParsed : 0;
  const tax_amount = Math.round(((amount * tax_percent) / 100) * 100) / 100;
  const line_total = Math.round((amount + tax_amount) * 100) / 100;
  return { label, amount, tax_percent, tax_amount, line_total };
}

/** Line-item totals plus optional additional charges (max two); `final_grand_total` includes charges. */
export function quotationTotalsWithAdditionalCharges(
  lines: QuotationLine[],
  charges: QuotationAdditionalCharge[],
) {
  const lineTotals = quotationTotals(lines);
  const nonEmpty = charges.filter((c) => c.label.length > 0 || c.amount > 0);
  let addGrand = 0;
  let addTax = 0;
  for (const c of nonEmpty) {
    addGrand += c.line_total;
    addTax += c.tax_amount;
  }
  return {
    lines: lineTotals,
    additional_charges: nonEmpty,
    final_grand_total: Math.round((lineTotals.grand_total + addGrand) * 100) / 100,
    total_tax_including_charges: Math.round((lineTotals.tax_amount + addTax) * 100) / 100,
  };
}
