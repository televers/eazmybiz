/** Calendar YYYY-MM-DD in Asia/Kolkata for an instant. */
export function istCalendarYmdFromDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) {
    throw new Error("istCalendarYmdFromDate: incomplete parts");
  }
  return `${y}-${m}-${day}`;
}

export function istTodayYmd(): string {
  return istCalendarYmdFromDate(new Date());
}

/** Current calendar year-month `YYYY-MM` in Asia/Kolkata. */
export function istYearMonthNow(): string {
  return istTodayYmd().slice(0, 7);
}

/** IST calendar date for an ISO timestamp (e.g. check-in / check-out). */
export function istYmdFromIsoTimestamp(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return istCalendarYmdFromDate(d);
}

const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Add calendar days to a civil YYYY-MM-DD (Gregorian; not timezone-shifted). */
export function civilYmdAddDays(ymd: string, deltaDays: number): string {
  const s = String(ymd).trim().slice(0, 10);
  if (!ISO_YMD.test(s)) {
    throw new Error("civilYmdAddDays: expected YYYY-MM-DD");
  }
  const [y, m, d] = s.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
