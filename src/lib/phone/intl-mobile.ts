/** Mobile numbers with ISD — India-first (+91), E.164 storage. */

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

/** Sentinel for "Other" in ISD dropdown — use `customIsd` text field (digits only, we add +). */
export const PHONE_ISD_CUSTOM = "__custom__";

const ISD_LONGEST_FIRST: string[] = (() => {
  const codes = new Set<string>();
  for (const iso of getCountries()) {
    codes.add(`+${getCountryCallingCode(iso)}`);
  }
  return Array.from(codes).sort((a, b) => b.length - a.length);
})();

export type E164IntlFieldParts =
  | { kind: "country"; iso: string; isd: string; national: string }
  | { kind: "custom"; isd: string; national: string; customDigits: string };

/** When only legacy `defaultIsd` (+NN) is known, infer ISO for dropdown default. */
export function inferIsoFromDefaultIsd(defaultIsd: string): string {
  const raw = (defaultIsd ?? "+91").trim();
  const d = raw.startsWith("+") ? raw.slice(1) : digitsOnly(raw);
  if (!d) return "IN";
  const map: Record<string, string> = { "91": "IN", "1": "US", "44": "GB" };
  if (map[d]) return map[d];
  for (const iso of getCountries()) {
    if (getCountryCallingCode(iso) === d) return iso;
  }
  return "IN";
}

function findIsoForCallingCodeDigits(codeDigits: string, preferredIso: string): string | null {
  if (getCountryCallingCode(preferredIso as CountryCode) === codeDigits) return preferredIso;
  const matches = getCountries().filter((c) => getCountryCallingCode(c) === codeDigits);
  if (matches.length === 1) return matches[0];
  if (codeDigits === "1") return "US";
  if (matches.length > 0) return matches[0];
  return null;
}

/**
 * Parse stored E.164 / legacy Indian / partial input into country row or custom ISD for the mobile field.
 */
export function e164PartsForIntlMobileField(stored: string, defaultCountryIso: string): E164IntlFieldParts {
  const defIso = coerceToLibphonenumberCountry(defaultCountryIso);
  const defIsd = `+${getCountryCallingCode(defIso as CountryCode)}`;
  const raw = (stored ?? "").trim();
  if (!raw) {
    return { kind: "country", iso: defIso, isd: defIsd, national: "" };
  }

  try {
    const a = parsePhoneNumberFromString(raw, defIso as CountryCode);
    if (a?.country) {
      return {
        kind: "country",
        iso: a.country,
        isd: `+${a.countryCallingCode}`,
        national: a.nationalNumber,
      };
    }
  } catch {
    /* ignore */
  }
  try {
    const b = parsePhoneNumberFromString(raw);
    if (b?.country) {
      return {
        kind: "country",
        iso: b.country,
        isd: `+${b.countryCallingCode}`,
        national: b.nationalNumber,
      };
    }
  } catch {
    /* ignore */
  }

  const { isd, national } = splitE164ToParts(raw, defIsd);
  const digits = isd.replace(/^\+/, "");
  const isoHit = findIsoForCallingCodeDigits(digits, defIso);
  if (isoHit) {
    return { kind: "country", iso: isoHit, isd, national };
  }
  return {
    kind: "custom",
    isd,
    national,
    customDigits: digits,
  };
}

/**
 * Default ISD from organization ISO 3166-1 alpha-2 country (e.g. IN → +91).
 * Uses libphonenumber metadata so all supported countries map correctly.
 */
export function defaultPhoneIsdFromCountryCode(isoCountry: string | null | undefined): string {
  const raw = (isoCountry ?? "IN").trim().toUpperCase();
  const cc = raw === "UK" ? "GB" : raw;
  try {
    return `+${getCountryCallingCode(cc as CountryCode)}`;
  } catch {
    return cc === "IN" ? "+91" : "+1";
  }
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Normalize custom ISD user input to +digits (max 4 digits for country code). */
export function normalizeCustomIsdInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 4);
  return d ? `+${d}` : "";
}

export function isIndia10DigitNational(nationalDigits: string): boolean {
  return /^[6-9]\d{9}$/.test(nationalDigits);
}

export function validateNationalForIsd(isd: string, nationalDigits: string): string | null {
  const n = digitsOnly(nationalDigits);
  if (!n) return "Enter the mobile number (digits only).";
  if (isd === "+91") {
    if (!isIndia10DigitNational(n)) {
      return "India: enter a valid 10-digit mobile (starts with 6–9).";
    }
    return null;
  }
  if (isd === "+1") {
    if (!/^\d{10}$/.test(n)) return "US/Canada: enter 10 digits.";
    return null;
  }
  if (n.length < 8 || n.length > 12) {
    return "Enter 8–12 digits for this country code.";
  }
  return null;
}

export function combineToE164(isd: string, nationalDigits: string): string {
  const isdNorm = isd.startsWith("+") ? isd : `+${digitsOnly(isd)}`;
  const n = digitsOnly(nationalDigits);
  return `${isdNorm}${n}`;
}

/**
 * Parse stored value into ISD + national digits for the UI.
 * Legacy: 10-digit Indian without prefix → +91.
 */
export function splitE164ToParts(stored: string, defaultIsd: string): { isd: string; national: string } {
  const raw = (stored ?? "").trim();
  if (!raw) {
    const d = defaultIsd.startsWith("+") ? defaultIsd : `+${digitsOnly(defaultIsd)}`;
    return { isd: d || "+91", national: "" };
  }

  if (/^[6-9]\d{9}$/.test(raw)) {
    return { isd: "+91", national: raw };
  }

  if (/^91[6-9]\d{9}$/.test(raw)) {
    return { isd: "+91", national: raw.slice(2) };
  }

  let s = raw.replace(/\s+/g, "");
  if (!s.startsWith("+")) {
    if (s.startsWith("00")) s = `+${s.slice(2)}`;
    else s = `+${s}`;
  }

  for (const prefix of ISD_LONGEST_FIRST) {
    if (s.startsWith(prefix)) {
      return { isd: prefix, national: digitsOnly(s.slice(prefix.length)) };
    }
  }

  const m = s.match(/^\+(\d{1,3})(\d+)$/);
  if (m) {
    return { isd: `+${m[1]}`, national: m[2] };
  }

  const d = defaultIsd.startsWith("+") ? defaultIsd : `+${digitsOnly(defaultIsd)}`;
  return { isd: d || "+91", national: digitsOnly(raw) };
}

/** Canonical E.164 string, or null if empty input. */
export function toCanonicalE164FromParts(isd: string, nationalDigits: string): string | null {
  const n = digitsOnly(nationalDigits);
  if (!n) return null;
  const isdNorm = isd.startsWith("+") ? isd : `+${digitsOnly(isd)}`;
  if (isd === PHONE_ISD_CUSTOM || !isdNorm || isdNorm === "+") {
    return null;
  }
  const err = validateNationalForIsd(isdNorm, n);
  if (err) return null;
  return combineToE164(isdNorm, n);
}

/**
 * Accept legacy 10-digit India, 91XXXXXXXXXX, or full E.164.
 * Returns canonical E.164 or null if empty / invalid.
 */
export function normalizeIntlMobileToE164(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^[6-9]\d{9}$/.test(t)) return `+91${t}`;
  if (/^91[6-9]\d{9}$/.test(t)) return `+${t}`;
  const s = t.replace(/\s+/g, "");
  if (!s.startsWith("+")) return null;
  return validateStoredE164(s) === null ? s : null;
}

/** Validate a full stored number (E.164). Returns error message or null if OK. */
export function validateStoredE164(e164: string): string | null {
  const s = e164.trim();
  if (!s.startsWith("+")) return "Mobile number must include country code (e.g. +91).";
  const body = s.slice(1);
  if (!/^\d+$/.test(body)) return "Mobile number must contain digits only after +.";
  if (body.length < 10 || body.length > 15) return "Enter a valid international mobile number.";
  if (s.startsWith("+91")) {
    const n = body.slice(2);
    if (!isIndia10DigitNational(n)) return "India: enter a valid 10-digit mobile (starts with 6–9).";
    return null;
  }
  if (s.startsWith("+1")) {
    const n = body.slice(1);
    if (!/^\d{10}$/.test(n)) return "US/Canada: enter 10 digits after +1.";
    return null;
  }
  return null;
}

/**
 * For optional party/org mobile: null/blank OK; otherwise must be valid E.164.
 * Throws Error with user message if invalid non-empty.
 */
export function requireValidIntlMobileOrNull(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  let candidate = t;
  if (/^[6-9]\d{9}$/.test(t)) candidate = `+91${t}`;
  else if (/^91[6-9]\d{9}$/.test(t)) candidate = `+${t}`;
  else if (!t.startsWith("+")) {
    throw new Error("Choose country code (ISD) and enter digits, or use a full number with +.");
  }
  const err = validateStoredE164(candidate);
  if (err) throw new Error(err);
  return candidate;
}

/**
 * Required mobile (visitors, gate hand-carried). Empty invalid.
 * Accepts E.164 from IntlMobileField or legacy 10-digit India / 91…
 */
export function requireValidIntlMobile(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) throw new Error("Mobile number is required.");
  let candidate = t;
  if (/^[6-9]\d{9}$/.test(t)) candidate = `+91${t}`;
  else if (/^91[6-9]\d{9}$/.test(t)) candidate = `+${t}`;
  else if (!t.startsWith("+")) {
    throw new Error("Choose country code (ISD) and enter digits, or use a full number with +.");
  }
  const err = validateStoredE164(candidate);
  if (err) throw new Error(err);
  return candidate;
}

/** Visitor issue / legacy row: 10-digit India or valid E.164. */
export function isValidVisitorMobileStored(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  if (/^[6-9]\d{9}$/.test(t)) return true;
  if (/^91[6-9]\d{9}$/.test(t)) return true;
  return validateStoredE164(t.startsWith("+") ? t : `+${digitsOnly(t)}`) === null;
}
