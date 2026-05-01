import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { effectiveFeaturePermissions } from "@/lib/access";
import type { AccountEntitlement, CommercialRegion, Membership, Organization } from "@/types/database";
import type { FullOrgContext } from "@/lib/org-context-types";
import { isAccountOwnerForActiveOrg as isAccountOwnerForActiveOrgImpl } from "@/lib/org/is-account-owner-for-active-org";

export type { OrgContext, FullOrgContext } from "@/lib/org-context-types";

export const ACTIVE_ORG_COOKIE = "eazmybiz_active_org";

export function isAccountOwnerForActiveOrg(ctx: FullOrgContext): boolean {
  return isAccountOwnerForActiveOrgImpl(ctx);
}

/**
 * Pricing & subscription UI for the **active** company: account owner of this org’s billing, or a company admin.
 * Plain invited members (office / gate without admin) do not see pricing — avoids confusion; owners/admins handle upgrades.
 */
export function canAccessSubscriptionPricing(ctx: FullOrgContext): boolean {
  return isAccountOwnerForActiveOrg(ctx) || ctx.membership.is_company_admin;
}

const baseOrgSelect = `
      id,
      name,
      plan,
      commercial_region,
      country_code,
      calendar_time_zone,
      region,
      gstin,
      created_at,
      org_address_line1,
      org_address_line2,
      org_city,
      org_state,
      org_pin,
      org_country,
      org_email,
      logo_storage_path,
      packing_terms,
      delivery_challan_terms,
      default_currency,
      bank_account_holder_name,
      bank_name,
      bank_branch,
      bank_account_no,
      bank_ifsc,
      quotation_terms,
      doc_prefix_quotation,
      doc_prefix_packing_list,
      doc_prefix_delivery_challan,
      doc_prefix_gate_pass,
      doc_prefix_visitor,
      doc_prefix_overrides,
      doc_series_mode,
      doc_series_custom_month,
      doc_series_custom_day,
      doc_multi_series_enabled,
      doc_series_profiles,
      doc_series_default_slot,
      doc_series_slot_quotation,
      doc_series_slot_packing_list,
      doc_series_slot_delivery_challan,
      doc_series_slot_gate_pass,
      doc_series_slot_visitor,
      doc_number_format,
      billing_country_code,
      plan_period_start,
      plan_period_end,
      entitlement_id,
      visitor_pass_print_layout
    `;

async function fetchOrganizationRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<Organization | null> {
  const withMobile = await supabase
    .from("organizations")
    .select(`${baseOrgSelect},org_mobile`)
    .eq("id", orgId)
    .single();

  if (!withMobile.error && withMobile.data) {
    const raw = withMobile.data as Organization & { commercial_region?: string | null };
    return {
      ...raw,
      commercial_region: raw.commercial_region === "intl" ? "intl" : "in",
    };
  }

  const fallback = await supabase.from("organizations").select(baseOrgSelect).eq("id", orgId).single();
  if (fallback.error || !fallback.data) return null;
  const raw = fallback.data as Organization & { commercial_region?: string | null };
  return {
    ...raw,
    commercial_region: raw.commercial_region === "intl" ? "intl" : "in",
    org_mobile: null,
  };
}

function mapEntitlementRow(e: Record<string, unknown>): AccountEntitlement {
  return {
    id: e.id as string,
    owner_user_id: e.owner_user_id as string,
    plan: e.plan as AccountEntitlement["plan"],
    commercial_region: e.commercial_region as CommercialRegion,
    max_companies: e.max_companies as number,
    plan_period_start: e.plan_period_start as string | null,
    plan_period_end: e.plan_period_end as string | null,
    billing_country_code: e.billing_country_code as string | null,
    created_at: e.created_at as string,
    updated_at: e.updated_at as string,
  };
}

export async function getOrgContext(): Promise<FullOrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ownedEnt } = await supabase
    .from("account_entitlements")
    .select(
      "id, owner_user_id, plan, commercial_region, max_companies, plan_period_start, plan_period_end, billing_country_code, created_at, updated_at",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const isMasterAdmin = !!ownedEnt;

  const { data: memRows, error: memErr } = await supabase
    .from("memberships")
    .select(
      "id, organization_id, user_id, role, is_active, is_company_admin, feature_permissions, created_at",
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (memErr) return null;

  const membershipByOrg = new Map<string, (typeof memRows)[number]>();
  for (const row of memRows ?? []) {
    membershipByOrg.set(row.organization_id, row);
  }

  let entitlementOrgIds: string[] = [];
  if (ownedEnt?.id) {
    const { data: entOrgs } = await supabase.from("organizations").select("id").eq("entitlement_id", ownedEnt.id);
    entitlementOrgIds = (entOrgs ?? []).map((r) => r.id as string);
  }

  const fromMemberships = (memRows ?? []).map((m) => m.organization_id);
  const accessibleIds = [...new Set([...fromMemberships, ...entitlementOrgIds])];

  if (accessibleIds.length === 0) return null;

  const { data: orgList } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", accessibleIds)
    .order("name", { ascending: true });

  const accessibleOrganizations = (orgList ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) || "Company",
  }));

  const cookieStore = await cookies();
  const cookieOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  let activeOrgId: string | null =
    cookieOrg && accessibleIds.includes(cookieOrg) ? cookieOrg : (memRows?.[0]?.organization_id ?? null);

  if (!activeOrgId && isMasterAdmin && entitlementOrgIds.length > 0) {
    activeOrgId = entitlementOrgIds[0];
  }
  if (!activeOrgId) return null;

  const org = await fetchOrganizationRow(supabase, activeOrgId);
  if (!org) return null;

  const memRow = membershipByOrg.get(activeOrgId);
  if (!memRow && !isMasterAdmin) return null;

  const membership: Membership = memRow
    ? {
        id: memRow.id as string,
        organization_id: memRow.organization_id as string,
        user_id: memRow.user_id as string,
        role: memRow.role as Membership["role"],
        is_active: memRow.is_active as boolean,
        is_company_admin: !!(memRow as { is_company_admin?: boolean }).is_company_admin,
        feature_permissions: ((memRow as { feature_permissions?: Record<string, boolean> }).feature_permissions ??
          {}) as Membership["feature_permissions"],
      }
    : {
        id: "",
        organization_id: activeOrgId,
        user_id: user.id,
        role: "office",
        is_active: true,
        is_company_admin: false,
        feature_permissions: {},
      };

  let entitlement: AccountEntitlement | null = null;
  if (ownedEnt?.id) {
    entitlement = mapEntitlementRow(ownedEnt as Record<string, unknown>);
  } else if (org.entitlement_id) {
    const entRes = await supabase
      .from("account_entitlements")
      .select(
        "id, owner_user_id, plan, commercial_region, max_companies, plan_period_start, plan_period_end, billing_country_code, created_at, updated_at",
      )
      .eq("id", org.entitlement_id)
      .maybeSingle();
    if (!entRes.error && entRes.data) {
      entitlement = mapEntitlementRow(entRes.data as Record<string, unknown>);
    }
  }

  const canManageMemberships =
    isMasterAdmin ||
    (memRow ? !!(memRow as { is_company_admin?: boolean }).is_company_admin : false);

  const featurePermissions = effectiveFeaturePermissions(
    membership.role,
    membership.is_company_admin,
    isMasterAdmin,
    membership.feature_permissions as Record<string, boolean | undefined>,
  );

  return {
    organization: org,
    membership,
    entitlement,
    userId: user.id,
    userEmail: user.email,
    isMasterAdmin,
    canManageMemberships,
    featurePermissions,
    accessibleOrganizations,
  };
}
