export type PlanTier = "free" | "pro" | "max";
export type CommercialRegion = "in" | "intl";
export type MemberRole = "office" | "gate";
export type DocStatus = "draft" | "issued";
export type GateDirection = "in" | "out";
export type VisitorStatus = "draft" | "issued" | "checked_in" | "checked_out";
export type UsageMetric = "documents_combined" | "gate_passes" | "visitor_passes";

export type AccountEntitlement = {
  id: string;
  owner_user_id: string;
  plan: PlanTier;
  commercial_region: CommercialRegion;
  max_companies: number;
  plan_period_start: string | null;
  plan_period_end: string | null;
  billing_country_code: string | null;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  plan: PlanTier;
  commercial_region: CommercialRegion;
  country_code: string;
  /** IANA timezone for document/visit calendar rules (quotas stay IST per product). */
  calendar_time_zone?: string | null;
  region: string | null;
  gstin: string | null;
  created_at: string;
  org_address_line1: string | null;
  org_address_line2: string | null;
  org_city: string | null;
  org_state: string | null;
  org_pin: string | null;
  org_country: string | null;
  org_email: string | null;
  org_mobile?: string | null;
  logo_storage_path: string | null;
  packing_terms: string | null;
  delivery_challan_terms: string | null;
  default_currency?: string | null;
  bank_account_holder_name?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  quotation_terms?: string | null;
  doc_prefix_quotation?: string;
  doc_prefix_packing_list?: string;
  doc_prefix_delivery_challan?: string;
  doc_prefix_gate_pass?: string;
  doc_prefix_visitor?: string;
  /** Optional per-slot (series 2..N) prefix overrides; see migrations. */
  doc_prefix_overrides?: unknown;
  doc_series_mode?: string;
  doc_series_custom_month?: number | null;
  doc_series_custom_day?: number | null;
  doc_multi_series_enabled?: boolean;
  doc_series_profiles?: unknown;
  doc_series_default_slot?: number;
  doc_series_slot_quotation?: number | null;
  doc_series_slot_packing_list?: number | null;
  doc_series_slot_delivery_challan?: number | null;
  doc_series_slot_gate_pass?: number | null;
  doc_series_slot_visitor?: number | null;
  doc_number_format?: string;
  billing_country_code?: string | null;
  plan_period_start?: string | null;
  plan_period_end?: string | null;
  entitlement_id?: string | null;
  /** Visitor pass: wallet card (ISO ID-1) or A5 foldable badge. */
  visitor_pass_print_layout?: string | null;
};

/** Feature flags aligned with RLS / `membership_feature_allowed` (see migrations). */
export type MembershipFeaturePermissions = Partial<
  Record<
    | "quotation"
    | "packing_list"
    | "delivery_challan"
    | "gate_pass"
    | "visitor"
    | "visitor_checkpoint"
    | "material_movement"
    | "parties"
    | "items"
    | "settings_company",
    boolean
  >
>;

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  is_company_admin: boolean;
  feature_permissions: MembershipFeaturePermissions;
};

/** @deprecated legacy flat line — use packing package lines */
export type LineItem = {
  description: string;
  qty: number;
  uom?: string;
};
