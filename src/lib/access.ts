import { redirect } from "next/navigation";
import type { MemberRole } from "@/types/database";

/** Keys stored in memberships.feature_permissions (JSON) and used by RLS. */
export type FeatureKey =
  | "quotation"
  | "purchase_order"
  | "packing_list"
  | "delivery_challan"
  | "gate_pass"
  | "visitor"
  | "visitor_checkpoint"
  | "material_movement"
  | "parties"
  | "items"
  | "settings_company";

export const FEATURE_KEYS: FeatureKey[] = [
  "quotation",
  "purchase_order",
  "packing_list",
  "delivery_challan",
  "gate_pass",
  "visitor",
  "visitor_checkpoint",
  "material_movement",
  "parties",
  "items",
  "settings_company",
];

/** Human-readable module names (Team & access UI, notifications). */
export const FEATURE_MODULE_LABELS: Record<FeatureKey, string> = {
  quotation: "Quotations",
  purchase_order: "Purchase orders",
  packing_list: "Packing lists",
  delivery_challan: "Delivery challans",
  gate_pass: "Gate passes",
  visitor: "Visitors",
  visitor_checkpoint: "Visitor desk (check-in / check-out)",
  material_movement: "Record material in / out at gate",
  parties: "Parties",
  items: "Saved items",
  settings_company: "Company profile",
};

/** Gate / security role cannot be granted these modules (UI + server). */
export const GATE_ROLE_FORCED_OFF_FEATURES: readonly FeatureKey[] = [
  "quotation",
  "purchase_order",
  "parties",
  "settings_company",
];

export function enforceGateRoleFeatureCaps(role: MemberRole, perms: FeaturePermissionMap): FeaturePermissionMap {
  if (role !== "gate") return perms;
  const next = { ...perms };
  for (const k of GATE_ROLE_FORCED_OFF_FEATURES) next[k] = false;
  return next;
}

/**
 * Company profile settings are only usable by company admins or the account owner (see effectiveFeaturePermissions).
 * Non-admins cannot get sidebar access even if this flag is stored true — keep UI/DB aligned.
 */
export function enforceCompanyProfilePermissionCap(
  isCompanyAdmin: boolean,
  perms: FeaturePermissionMap,
): FeaturePermissionMap {
  if (isCompanyAdmin) return perms;
  return { ...perms, settings_company: false };
}

export type FeaturePermissionMap = Record<FeatureKey, boolean>;

export function defaultFeaturePermissionsForRole(role: MemberRole): FeaturePermissionMap {
  if (role === "gate") {
    return {
      quotation: false,
      purchase_order: false,
      packing_list: false,
      delivery_challan: false,
      gate_pass: true,
      visitor: true,
      visitor_checkpoint: true,
      material_movement: true,
      parties: false,
      items: false,
      settings_company: false,
    };
  }
  return {
    quotation: true,
    purchase_order: true,
    packing_list: true,
    delivery_challan: true,
    gate_pass: false,
    visitor: true,
    visitor_checkpoint: false,
    material_movement: false,
    parties: true,
    items: true,
    settings_company: false,
  };
}

export function fullAccessPermissions(): FeaturePermissionMap {
  return {
    quotation: true,
    purchase_order: true,
    packing_list: true,
    delivery_challan: true,
    gate_pass: true,
    visitor: true,
    visitor_checkpoint: true,
    material_movement: true,
    parties: true,
    items: true,
    settings_company: true,
  };
}

/** Merge stored JSON with role defaults (missing keys inherit defaults). */
export function effectiveFeaturePermissions(
  role: MemberRole,
  isCompanyAdmin: boolean,
  isMasterAdmin: boolean,
  stored: Record<string, boolean | undefined> | null | undefined,
): FeaturePermissionMap {
  if (isMasterAdmin || isCompanyAdmin) {
    return fullAccessPermissions();
  }
  const base = defaultFeaturePermissionsForRole(role);
  const out = { ...base };
  for (const k of FEATURE_KEYS) {
    const v = stored?.[k];
    if (typeof v === "boolean") out[k] = v;
  }
  if (role === "gate") {
    for (const k of GATE_ROLE_FORCED_OFF_FEATURES) out[k] = false;
  }
  if (!isMasterAdmin && !isCompanyAdmin) {
    out.settings_company = false;
  }
  return out;
}

export function canUseFeature(ctx: { featurePermissions: FeaturePermissionMap }, key: FeatureKey): boolean {
  return ctx.featurePermissions[key] === true;
}

export function assertModuleAccess(ctx: { featurePermissions: FeaturePermissionMap }, key: FeatureKey): void {
  if (!canUseFeature(ctx, key)) {
    redirect("/dashboard");
  }
}
