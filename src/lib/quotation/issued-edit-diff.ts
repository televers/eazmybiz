import { formatMoney } from "@/lib/currencies";
import { computeAdditionalCharge, quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import type { QuotationLine } from "@/lib/quotation/types";

export type QuotationChargePayload = { label: string; amount: number; tax_percent: number };

function taxEq(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

function priceEq(a: number, b: number): boolean {
  return Math.round(a * 10000) === Math.round(b * 10000);
}

function qtyEq(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

/** Short bullet lines for confirm dialog when saving an issued quotation. */
export function quotationIssuedEditSummaryLines(input: {
  currency: string;
  baselineLines: QuotationLine[];
  baselineCharges: QuotationChargePayload[];
  currentLines: QuotationLine[];
  currentCharges: QuotationChargePayload[];
}): string[] {
  const { currency, baselineLines, currentLines, baselineCharges, currentCharges } = input;
  const out: string[] = [];

  const baseComputed = baselineCharges.map((c) => computeAdditionalCharge(c));
  const curComputed = currentCharges.map((c) => computeAdditionalCharge(c));
  const baseTot = quotationTotalsWithAdditionalCharges(baselineLines, baseComputed);
  const curTot = quotationTotalsWithAdditionalCharges(currentLines, curComputed);

  if (baseTot.final_grand_total !== curTot.final_grand_total) {
    out.push(
      `Grand total: ${formatMoney(baseTot.final_grand_total, currency)} → ${formatMoney(curTot.final_grand_total, currency)}`,
    );
  }

  if (baselineLines.length !== currentLines.length) {
    out.push(`Line count: ${baselineLines.length} → ${currentLines.length}`);
  }

  const n = Math.max(baselineLines.length, currentLines.length);
  for (let i = 0; i < n; i++) {
    const b = baselineLines[i];
    const c = currentLines[i];
    const label = `Row ${i + 1}`;
    if (!b && c) {
      const t = c.description.trim().slice(0, 48) || "(new item)";
      out.push(`New ${label}: ${t}`);
      continue;
    }
    if (b && !c) {
      const t = b.description.trim().slice(0, 48) || "item";
      out.push(`Removed ${label}: ${t}`);
      continue;
    }
    if (!b || !c) continue;

    if (b.description.trim() !== c.description.trim()) {
      out.push(`${label}: product / description changed`);
    }
    if (!qtyEq(b.qty, c.qty)) {
      out.push(`${label}: qty ${b.qty} → ${c.qty}`);
    }
    if (!priceEq(b.unit_price, c.unit_price)) {
      out.push(`${label}: unit price ${b.unit_price} → ${c.unit_price}`);
    }
    if (!taxEq(b.tax_percent, c.tax_percent)) {
      out.push(`${label}: tax % ${b.tax_percent} → ${c.tax_percent}`);
    }
  }

  const chKey = (rows: QuotationChargePayload[]) =>
    JSON.stringify(
      rows.map((r) => ({
        label: r.label.trim(),
        amount: Math.round(r.amount * 100) / 100,
        tax_percent: Math.round(r.tax_percent * 1000) / 1000,
      })),
    );

  if (chKey(baselineCharges) !== chKey(currentCharges)) {
    out.push("Additional charges changed");
  }

  return out.slice(0, 14);
}
