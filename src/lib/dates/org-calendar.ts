import type { Organization } from "@/types/database";

/**
 * Primary IANA timezone for organization **document / visit calendar** dates.
 * Quotas remain IST per product; this is only for “today”, backdate windows, and future-date checks.
 */
export const PRIMARY_IANA_TIME_ZONE_BY_ISO_COUNTRY: Record<string, string> = {
  IN: "Asia/Kolkata",
  GB: "Europe/London",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  NL: "Europe/Amsterdam",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  ZA: "Africa/Johannesburg",
  US: "America/New_York",
  CA: "America/Toronto",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
};

export function defaultCalendarTimeZoneForCountryCode(countryCode: string | null | undefined): string {
  const cc = String(countryCode ?? "").trim().toUpperCase();
  if (cc && PRIMARY_IANA_TIME_ZONE_BY_ISO_COUNTRY[cc]) {
    return PRIMARY_IANA_TIME_ZONE_BY_ISO_COUNTRY[cc];
  }
  return "UTC";
}

export type OrgCalendarSource = Pick<Organization, "country_code" | "calendar_time_zone">;

/** Effective IANA zone: stored `calendar_time_zone` when set, else derived from `country_code`. */
export function effectiveOrgCalendarTimeZone(org: OrgCalendarSource): string {
  const stored = org.calendar_time_zone;
  if (stored != null && String(stored).trim() !== "") {
    return String(stored).trim();
  }
  return defaultCalendarTimeZoneForCountryCode(org.country_code);
}

/** Calendar YYYY-MM-DD for an instant in a specific IANA timezone. */
export function calendarYmdFromDateInTimeZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) {
    throw new Error("calendarYmdFromDateInTimeZone: incomplete parts");
  }
  return `${y}-${m}-${day}`;
}

export function orgCalendarTodayYmd(org: OrgCalendarSource): string {
  return calendarYmdFromDateInTimeZone(new Date(), effectiveOrgCalendarTimeZone(org));
}

export function orgCalendarYearMonth(org: OrgCalendarSource): string {
  return orgCalendarTodayYmd(org).slice(0, 7);
}

export function orgCalendarYmdFromIsoTimestamp(
  iso: string | null | undefined,
  org: OrgCalendarSource,
): string | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return calendarYmdFromDateInTimeZone(d, effectiveOrgCalendarTimeZone(org));
}

export function orgCalendarTimezoneShortLabel(org: OrgCalendarSource): string {
  return effectiveOrgCalendarTimeZone(org);
}
