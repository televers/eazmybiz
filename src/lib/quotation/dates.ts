/** Display ISO date (YYYY-MM-DD or leading slice) as dd-mm-yyyy for print/PDF. */
export function formatDateDdMmYyyy(input: string | null | undefined): string {
  if (input == null || String(input).trim() === "") return "—";
  const ymd = String(input).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Add days to a YYYY-MM-DD date in local calendar terms (avoids UTC shift). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Default “valid until”: 7 days after quotation date or 7 days after org “today”, whichever is later.
 * `orgTodayYmd` is the company calendar date upper bound (see `orgDocumentDatePickerBounds().maxYmd`).
 */
export function defaultQuotationValidUntilYmd(quotationDateYmd: string, orgTodayYmd: string): string {
  const q = String(quotationDateYmd).trim().slice(0, 10);
  const t = String(orgTodayYmd).trim().slice(0, 10);
  const fromQuote = addDaysToIsoDate(q, 7);
  const fromToday = addDaysToIsoDate(t, 7);
  return fromQuote > fromToday ? fromQuote : fromToday;
}
