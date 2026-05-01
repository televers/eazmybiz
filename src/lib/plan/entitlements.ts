import type { Organization, PlanTier, UsageMetric } from "@/types/database";
import { pricingRegionFromOrganization } from "@/lib/pricing/display";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Commercial / pricing book (see docs/PRODUCT.md §2.1.3–2.1.5). */
export type CommercialRegion = "in" | "intl";

export const MAX_COMPANIES_BY_PLAN: Record<PlanTier, number> = {
  free: 1,
  pro: 2,
  max: 5,
};

export const MAX_USERS_BY_PLAN: Record<PlanTier, number> = {
  free: 2,
  pro: 10,
  max: 50,
};

/** Company-admin seats across the account (distinct users), excluding the account owner. */
export const MAX_COMPANY_ADMINS_BY_PLAN: Record<PlanTier, number> = {
  free: 0,
  pro: 2,
  max: 5,
};

/** Pro: at most this many active company admins per company (excluding the account owner). Max: no separate per-org cap in DB — UI shows plan account cap as the per-company ceiling label. */
export const MAX_COMPANY_ADMINS_PER_ORGANIZATION_PRO = 1;

export function maxCompaniesForPlan(plan: PlanTier): number {
  return MAX_COMPANIES_BY_PLAN[plan];
}

export function maxUsersForPlan(plan: PlanTier): number {
  return MAX_USERS_BY_PLAN[plan];
}

export function maxCompanyAdminsForPlan(plan: PlanTier): number {
  return MAX_COMPANY_ADMINS_BY_PLAN[plan];
}

/** Display / client guard: Pro = 1 per company; Max = up to plan account cap on one company. */
export function maxCompanyAdminsPerOrgForPlan(plan: PlanTier): number {
  if (plan === "free") return 0;
  if (plan === "pro") return MAX_COMPANY_ADMINS_PER_ORGANIZATION_PRO;
  return MAX_COMPANY_ADMINS_BY_PLAN.max;
}

/**
 * Monthly issued quotas per company (IST calendar month). See docs/PRODUCT.md §2.1.1, §2.3.
 * `null` = unlimited (Max plan, combined documents only).
 */
export function monthlyIssuedQuotaForPlan(plan: PlanTier, metric: UsageMetric): number | null {
  if (plan === "free") {
    return metric === "documents_combined" ? 30 : 60;
  }
  if (plan === "pro") {
    return 500;
  }
  return metric === "documents_combined" ? null : 2000;
}

/** True if this org’s profile is treated as India-situated (nexus for INR commercial rules). */
export function orgProfileIndicatesIndia(
  org: Pick<Organization, "country_code" | "org_country" | "gstin" | "default_currency">,
): boolean {
  return pricingRegionFromOrganization(org) === "in";
}

/**
 * India-priced commercial region requires an India commercial profile on the organization.
 * International (`intl`) may include orgs based anywhere, including India.
 */
export function assertIndiaCommercialEntitlementProfile(
  org: Pick<Organization, "commercial_region" | "country_code" | "org_country" | "gstin" | "default_currency">,
): void {
  if (org.commercial_region !== "in") return;
  if (!orgProfileIndicatesIndia(org)) {
    throw new Error(
      "India-priced accounts must keep an India commercial profile (country and tax details). Update your company country or contact support to change billing region.",
    );
  }
}

export function commercialRegionLabel(region: CommercialRegion): string {
  return region === "in" ? "India (INR price book)" : "International (USD price book)";
}

/** Count organizations tied to the same entitlement (multi-company limits). */
export async function countOrganizationsForEntitlement(
  supabase: SupabaseClient,
  entitlementId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("entitlement_id", entitlementId);
  if (error) return 0;
  return count ?? 0;
}

/** Active org memberships for a user (distinct companies they belong to). */
export async function countActiveOrganizationsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error || !data) return 0;
  return new Set(data.map((r) => r.organization_id)).size;
}
