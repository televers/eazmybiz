import type { PartySnapshot } from "@/lib/packing/types";

/** Product line (goods only). HSN/SAC optional. */
export type DeliveryChallanLine = {
  description: string;
  make_service_provider?: string;
  model_part_no_description?: string;
  hsn: string;
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

export type DeliveryChallanPayload = {
  document_date: string | null;
  currency: string;
  bill_to: PartySnapshot;
  ship_to: PartySnapshot;
  lines: DeliveryChallanLine[];
  /** Same shape as quotation: `{ label, amount, tax_percent }` stored JSON, max two. */
  additional_charges?: unknown;
  po_no: string | null;
  po_date: string | null;
  lr_docket_no: string | null;
  eway_bill_no: string | null;
  transport_name: string | null;
  transporter_id: string | null;
  vehicle_no: string | null;
  notes: string | null;
  save_bill_to?: boolean;
  save_ship_to?: boolean;
};
