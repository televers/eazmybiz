import type { PartySnapshot } from "@/lib/packing/types";

export type QuotationLine = {
  /** Main product or service name (required for a valid line). */
  description: string;
  /** Optional; second line on print/PDF — make / service provider (comma-separated after model/part). */
  make_service_provider: string;
  /** Optional; second line on print/PDF — model / part no. (comma-separated before make). */
  model_part_no_description: string;
  hsn_sac: string;
  unit: string;
  qty: number;
  unit_price: number;
  taxable_value: number;
  tax_percent: number;
  tax_amount: number;
  line_total: number;
  item_preset_id?: string | null;
  save_as_item?: boolean;
};

export function emptyQuotationLine(): QuotationLine {
  return {
    description: "",
    make_service_provider: "",
    model_part_no_description: "",
    hsn_sac: "",
    unit: "Pcs",
    qty: 1,
    unit_price: 0,
    taxable_value: 0,
    tax_percent: 0,
    tax_amount: 0,
    line_total: 0,
    save_as_item: true,
  };
}

/** Optional extra charge (packing, transport, etc.); stored as JSON, max two per quotation. */
export type QuotationAdditionalCharge = {
  label: string;
  amount: number;
  tax_percent: number;
  tax_amount: number;
  line_total: number;
};

export type QuotationFormState = {
  document_date: string | null;
  currency: string;
  bill_to: PartySnapshot;
  lines: QuotationLine[];
  payment_term: string;
  delivery_inco_term: string;
  terms_notes: string;
  notes: string;
};
