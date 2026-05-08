import type { Organization, PlanTier } from "@/types/database";

/** Pricing region for public UI — derived from org profile, not browser geo (see docs/PRODUCT.md §2.1.3). */
export type PricingRegion = "in" | "intl";

/** @deprecated Prefer {@link pricingRegionFromOrganization} — ISO field may contain "INDIA" etc. */
export function pricingRegionFromOrgCountry(countryCode: string | null | undefined): PricingRegion {
  const c = countryCode?.trim().toUpperCase() ?? "";
  if (c === "IN" || c === "IND" || c === "INDIA") return "in";
  return "intl";
}

/** Indian GSTIN (15 chars, standard pattern). */
function looksLikeIndianGstin(gstin: string): boolean {
  const g = gstin.replace(/\s/g, "").toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
}

/**
 * India pricing when legal/tax country is India. Uses `country_code` (IN, IND, INDIA), then address country,
 * then GSTIN shape, then INR default when ISO code is missing (legacy rows).
 */
export function pricingRegionFromOrganization(
  org: Pick<Organization, "country_code" | "org_country" | "gstin" | "default_currency">,
): PricingRegion {
  const ccRaw = org.country_code?.trim() ?? "";
  const cc = ccRaw.toUpperCase();
  if (cc === "IN" || cc === "IND" || cc === "INDIA") return "in";

  const oc = org.org_country?.trim().toLowerCase() ?? "";
  if (oc === "india" || oc === "in") return "in";

  if (org.gstin?.trim() && looksLikeIndianGstin(org.gstin)) return "in";

  if (!ccRaw && org.default_currency?.trim().toUpperCase() === "INR") return "in";

  return "intl";
}

/**
 * Guess India vs international for **anonymous** marketing (e.g. public /pricing page) from edge headers.
 * - **Vercel:** `x-vercel-ip-country`
 * - **Cloudflare:** `cf-ipcountry`
 *
 * Returns `null` if the country cannot be inferred (e.g. local dev). Do not use for billing; checkout must still
 * validate region (see docs/PRODUCT.md).
 */
export function publicPricingAudienceFromHeaders(headers: Headers): PricingRegion | null {
  const vercel = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  if (vercel === "IN") return "in";
  if (vercel.length === 2 && vercel !== "T1") return "intl";

  const cf = headers.get("cf-ipcountry")?.trim().toUpperCase() ?? "";
  if (cf === "IN") return "in";
  if (cf.length === 2 && cf !== "XX" && cf !== "T1") return "intl";

  return null;
}

export const PRICING_INR = {
  pro: { list: 3999, sale: 1999 },
  max: { list: 9999, sale: 4999 },
} as const;

export const PRICING_USD = {
  pro: { list: 99, sale: 49 },
  max: { list: 199, sale: 99 },
} as const;

/** Company-admin seats across the subscription (excl. account owner). Matches docs/PRODUCT.md §5 and DB. */
export const PLAN_COMPANY_ADMIN_SEATS = { free: 0, pro: 2, max: 5 } as const;

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** INR with paise (e.g. GST breakdown and Cashfree totals). */
export function formatInrPaise(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function planTierDisplayName(tier: PlanTier): string {
  if (tier === "free") return "Free";
  if (tier === "pro") return "Pro";
  return "Max";
}

/** Locale-medium date for subscription end/start; null if missing or invalid. */
export function formatIsoDateMedium(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
