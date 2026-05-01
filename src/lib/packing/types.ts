import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

/** Party address snapshot (billing / shipping) — stored in `party_addresses` */
export type PartySnapshot = {
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin?: string;
  country?: string;
  gstin?: string;
  contact_name?: string;
  mobile?: string;
};

export type PackingLine = {
  description: string;
  unit: string;
  qty: number;
  make_service_provider?: string;
  model_part_no_description?: string;
  hsn_sac?: string;
  /** Saved items master id when row was loaded from or saved to the item list. */
  item_preset_id?: string | null;
  /** When true (and no preset yet), server creates a `saved_item_presets` row on save. */
  save_as_item?: boolean;
};

export type PackingPackage = {
  package_no: number;
  package_type: string;
  /** When `other`, `package_type` is free text; omit for standard types. */
  package_type_mode?: "other";
  package_size: string;
  package_weight_kg: number | null;
  packing_remarks: string;
  lines: PackingLine[];
};

export type PackingListTemplateId =
  | "basic"
  | "standard_pro"
  | "pro_navy"
  | "pro_burgundy"
  | "pro_slate"
  | "max_teal"
  | "max_amber"
  | "max_charcoal";

/** @param defaultCountryIso Optional ISO 3166-1 alpha-2 (e.g. company `country_code`) for new addresses. */
export function emptyParty(defaultCountryIso?: string | null): PartySnapshot {
  const country =
    defaultCountryIso != null && String(defaultCountryIso).trim()
      ? coerceToLibphonenumberCountry(String(defaultCountryIso).trim())
      : "";
  return {
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    pin: "",
    country,
    gstin: "",
    contact_name: "",
    mobile: "",
  };
}

/** Shown on create / edit packing list for the dimensions field (print/PDF use L×W×H (cm)). */
export const PACKING_SIZE_FIELD_LABEL = "Size: Length×Width×Height (cm)";

export function emptyPackage(no: number): PackingPackage {
  return {
    package_no: no,
    package_type: "",
    package_size: "",
    package_weight_kg: null,
    packing_remarks: "",
    lines: [{ description: "", unit: "Pcs", qty: 1, save_as_item: true }],
  };
}

export function defaultPackingTerms(): string {
  return [
    "E&OE",
    "All matters subject to jurisdiction as per company policy / agreement.",
    "Packing list is made on best effort basis. If any discrepancies, please inform.",
    "This packing list is computer generated, doesn't require any signature.",
  ].join("\n");
}

/** Default delivery challan terms (company profile + print/PDF when unset). */
export function defaultDeliveryChallanTerms(): string {
  return ["E&OE", "All matters subject to jurisdiction as per company policy / agreement."].join("\n");
}

/** Default quotation boilerplate (company profile + print/PDF when unset). */
export function defaultQuotationTerms(): string {
  return [
    "E&OE",
    "All matters subject to jurisdiction as per company policy / agreement.",
    "This Quotation is computer generated, doesn't require any signature.",
  ].join("\n");
}
