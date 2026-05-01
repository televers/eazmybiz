import { getCountries, type CountryCode } from "libphonenumber-js";

const COUNTRY_SET = new Set(getCountries());

/** Map common mistakes and aliases to ISO 3166-1 alpha-2 supported by libphonenumber. */
export function coerceToLibphonenumberCountry(stored: string | null | undefined): string {
  const raw = (stored ?? "IN").trim().toUpperCase();
  if (raw === "UK") return "GB";
  if (raw === "IND" || raw === "INDIA") return "IN";
  if (COUNTRY_SET.has(raw as CountryCode)) return raw;
  return "IN";
}

function normalizeBillingCode(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  return coerceToLibphonenumberCountry(String(raw).trim());
}

export type IsoCountrySelectOption = { value: string; label: string };

export function countryLabel(iso: string, locale = "en"): string {
  const code = iso.trim().toUpperCase();
  try {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const name = names.of(code);
    if (name && name !== code) return `${name} — ${code}`;
  } catch {
    /* ignore */
  }
  return code;
}

/**
 * Suggested = billing country (subscription), then company / org ISO (when passed), then India if not already included.
 * Rest = all other libphonenumber countries A→Z by English name.
 */
export function buildIsoCountrySelectOptions(
  billingCountryCode: string | null | undefined,
  locale = "en",
  /** Company profile / workspace default (e.g. org.country_code). */
  organizationCountryCode?: string | null,
): { suggested: IsoCountrySelectOption[]; rest: IsoCountrySelectOption[] } {
  const codes = getCountries();
  const suggested: IsoCountrySelectOption[] = [];
  const seen = new Set<string>();

  const billing = normalizeBillingCode(billingCountryCode);
  if (billing && COUNTRY_SET.has(billing as CountryCode)) {
    suggested.push({ value: billing, label: countryLabel(billing, locale) });
    seen.add(billing);
  }

  const orgCc = normalizeBillingCode(organizationCountryCode);
  if (orgCc && COUNTRY_SET.has(orgCc as CountryCode) && !seen.has(orgCc)) {
    suggested.push({ value: orgCc, label: countryLabel(orgCc, locale) });
    seen.add(orgCc);
  }

  if (!seen.has("IN")) {
    suggested.push({ value: "IN", label: countryLabel("IN", locale) });
    seen.add("IN");
  }

  const rest: IsoCountrySelectOption[] = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    rest.push({ value: c, label: countryLabel(c, locale) });
  }
  rest.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));

  return { suggested, rest };
}
