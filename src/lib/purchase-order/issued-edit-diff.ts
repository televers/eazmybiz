import { formatMoney } from "@/lib/currencies";
import type { PartySnapshot } from "@/lib/packing/types";
import { partyFromJson } from "@/lib/packing/parse";
import { computeAdditionalCharge, quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import type { QuotationLine } from "@/lib/quotation/types";

export type QuotationChargePayload = { label: string; amount: number; tax_percent: number };

export type PurchaseOrderIssuedSnapshot = {
  document_date: string | null;
  currency: string;
  payment_term: string;
  delivery_inco_term: string;
  delivery_period: string;
  valid_until: string | null;
  terms_notes: string | null;
  notes: string | null;
  vendor_to: PartySnapshot;
  lines: QuotationLine[];
  charges: QuotationChargePayload[];
};

function taxEq(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

function priceEq(a: number, b: number): boolean {
  return Math.round(a * 10000) === Math.round(b * 10000);
}

function qtyEq(a: number, b: number): boolean {
  return Math.round(a * 1000) === Math.round(b * 1000);
}

function normCell(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function ymd(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function chargeKey(rows: QuotationChargePayload[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      label: r.label.trim(),
      amount: Math.round(r.amount * 100) / 100,
      tax_percent: Math.round(r.tax_percent * 1000) / 1000,
    })),
  );
}

export function purchaseOrderIssuedSnapshotFromRow(row: {
  document_date?: string | null;
  currency?: string | null;
  payment_term?: string | null;
  delivery_inco_term?: string | null;
  delivery_period?: string | null;
  valid_until?: string | null;
  terms_notes?: string | null;
  notes?: string | null;
  vendor_to?: unknown;
  lines?: unknown;
  additional_charges?: unknown;
}): PurchaseOrderIssuedSnapshot {
  return {
    document_date: row.document_date ?? null,
    currency: (row.currency ?? "INR").toString().toUpperCase().slice(0, 3),
    payment_term: normCell(row.payment_term),
    delivery_inco_term: normCell(row.delivery_inco_term),
    delivery_period: normCell(row.delivery_period),
    valid_until: row.valid_until != null ? ymd(row.valid_until) : null,
    terms_notes: normCell(row.terms_notes) || null,
    notes: normCell(row.notes) || null,
    vendor_to: partyFromJson(row.vendor_to),
    lines: linesFromJson(row.lines),
    charges: additionalChargesFromJson(row.additional_charges)
      .map((c) => ({
        label: String(c.label ?? "").trim(),
        amount: Math.round(Number(c.amount) * 100) / 100,
        tax_percent: Math.round(Number(c.tax_percent) * 1000) / 1000,
      }))
      .filter((c) => c.label.length > 0 || c.amount > 0)
      .slice(0, 2),
  };
}

export function buildPurchaseOrderIssuedSnapshot(input: {
  document_date: string | null;
  currency: string;
  payment_term: string;
  delivery_inco_term: string;
  delivery_period: string;
  valid_until: string | null;
  terms_notes?: string | null;
  notes?: string | null;
  vendor_to: PartySnapshot;
  lines: QuotationLine[];
  charges: QuotationChargePayload[];
}): PurchaseOrderIssuedSnapshot {
  return {
    document_date: input.document_date,
    currency: input.currency.toUpperCase().slice(0, 3),
    payment_term: normCell(input.payment_term),
    delivery_inco_term: normCell(input.delivery_inco_term),
    delivery_period: normCell(input.delivery_period),
    valid_until: input.valid_until ? ymd(input.valid_until) : null,
    terms_notes: normCell(input.terms_notes) || null,
    notes: normCell(input.notes) || null,
    vendor_to: input.vendor_to,
    lines: input.lines,
    charges: input.charges.slice(0, 2),
  };
}

/** Short bullet lines describing changes to an issued purchase order. */
export function purchaseOrderIssuedEditSummaryLines(input: {
  baseline: PurchaseOrderIssuedSnapshot;
  current: PurchaseOrderIssuedSnapshot;
}): string[] {
  const { baseline, current } = input;
  const currency = current.currency || baseline.currency || "INR";
  const out: string[] = [];

  if (ymd(baseline.document_date) !== ymd(current.document_date)) {
    out.push(`Purchase order date: ${ymd(baseline.document_date) || "—"} → ${ymd(current.document_date) || "—"}`);
  }
  if (baseline.currency !== current.currency) {
    out.push(`Currency: ${baseline.currency} → ${current.currency}`);
  }
  if (normCell(baseline.payment_term) !== normCell(current.payment_term)) {
    out.push("Payment term changed");
  }
  if (normCell(baseline.delivery_inco_term) !== normCell(current.delivery_inco_term)) {
    out.push("Delivery / Incoterm changed");
  }
  if (normCell(baseline.delivery_period) !== normCell(current.delivery_period)) {
    out.push("Delivery period changed");
  }
  if (ymd(baseline.valid_until) !== ymd(current.valid_until)) {
    out.push(`Delivery by: ${ymd(baseline.valid_until) || "—"} → ${ymd(current.valid_until) || "—"}`);
  }
  if (normCell(baseline.terms_notes) !== normCell(current.terms_notes)) {
    out.push("Additional terms changed");
  }
  if (normCell(baseline.notes) !== normCell(current.notes)) {
    out.push("Notes changed");
  }
  if (normCell(baseline.vendor_to.contact_name) !== normCell(current.vendor_to.contact_name)) {
    out.push("Vendor contact person changed");
  }
  if (normCell(baseline.vendor_to.mobile) !== normCell(current.vendor_to.mobile)) {
    out.push("Vendor mobile changed");
  }

  const baseComputed = baseline.charges.map((c) => computeAdditionalCharge(c));
  const curComputed = current.charges.map((c) => computeAdditionalCharge(c));
  const baseTot = quotationTotalsWithAdditionalCharges(baseline.lines, baseComputed);
  const curTot = quotationTotalsWithAdditionalCharges(current.lines, curComputed);

  if (baseTot.final_grand_total !== curTot.final_grand_total) {
    out.push(
      `Grand total: ${formatMoney(baseTot.final_grand_total, currency)} → ${formatMoney(curTot.final_grand_total, currency)}`,
    );
  }

  if (baseline.lines.length !== current.lines.length) {
    out.push(`Line count: ${baseline.lines.length} → ${current.lines.length}`);
  }

  const n = Math.max(baseline.lines.length, current.lines.length);
  for (let i = 0; i < n; i++) {
    const b = baseline.lines[i];
    const c = current.lines[i];
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
    if (normCell(b.hsn_sac) !== normCell(c.hsn_sac)) {
      out.push(`${label}: HSN/SAC changed`);
    }
    if (normCell(b.unit) !== normCell(c.unit)) {
      out.push(`${label}: unit changed`);
    }
  }

  if (chargeKey(baseline.charges) !== chargeKey(current.charges)) {
    out.push("Additional charges changed");
  }

  return out.slice(0, 20);
}
