import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

export type IsdCountryOption = { iso: string; label: string; prefix: string };

/**
 * Full country list for mobile ISD dropdown. Suggested = billing (subscription), company country, then India.
 * Remainder sorted A–Z by English country name.
 */
export function buildIsdCountrySelectOptions(
  organizationIso: string | null | undefined,
  billingIso: string | null | undefined,
  locale = "en",
): { suggested: IsdCountryOption[]; rest: IsdCountryOption[] } {
  const org = coerceToLibphonenumberCountry(organizationIso ?? "IN");
  const billRaw = billingIso?.trim();
  const bill = billRaw ? coerceToLibphonenumberCountry(billRaw) : null;

  const names = new Intl.DisplayNames([locale], { type: "region" });
  const codes = getCountries();
  const all: IsdCountryOption[] = codes.map((iso) => {
    const cc = getCountryCallingCode(iso);
    const prefix = `+${cc}`;
    const name = names.of(iso) ?? iso;
    return { iso, label: `${name} (${prefix})`, prefix };
  });
  all.sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));

  const byIso = new Map(all.map((o) => [o.iso, o]));
  const suggested: IsdCountryOption[] = [];
  const seen = new Set<string>();

  const pushIso = (iso: string) => {
    if (seen.has(iso)) return;
    const row = byIso.get(iso);
    if (!row) return;
    suggested.push(row);
    seen.add(iso);
  };

  if (bill) pushIso(bill);
  pushIso(org);
  if (!seen.has("IN")) pushIso("IN");

  const rest = all.filter((o) => !seen.has(o.iso));
  return { suggested, rest };
}
