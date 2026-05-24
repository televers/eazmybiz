import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

/** Normalize postal input for lookup APIs; null when not yet valid for the country. */
export function normalizePostalForLookup(countryIso: string, raw: string): string | null {
  const cc = coerceToLibphonenumberCountry(countryIso);
  const s = raw.trim();
  if (!s) return null;

  if (cc === "IN") {
    const digits = s.replace(/\D/g, "");
    return digits.length === 6 ? digits : null;
  }

  if (cc === "US") {
    const digits = s.replace(/\D/g, "");
    if (digits.length === 5) return digits;
    if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return null;
  }

  return s.length >= 3 ? s : null;
}

export function postalLookupIdleHint(countryIso: string): string {
  const cc = coerceToLibphonenumberCountry(countryIso);
  if (cc === "IN") return "Enter 6-digit PIN to fill city and state automatically.";
  if (cc === "US") return "Enter 5-digit ZIP to fill city and state when available.";
  return "Enter PIN / ZIP to fill city and state when available for the selected country.";
}
