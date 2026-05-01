/** `YYYY-MM` → `Apr-2026` for UI labels (IST billing period key). */
export function formatPeriodYmIstDisplay(periodYm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodYm);
  if (!m) return periodYm;
  const y = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  if (monthIdx < 0 || monthIdx > 11) return periodYm;
  return `${labels[monthIdx]}-${y}`;
}

/** Monthly period key in Asia/Kolkata (IST), per docs/PRODUCT.md */
export function currentPeriodYmIst(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (!y || !m) return "";
  return `${y}-${m}`;
}
