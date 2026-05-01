/** Any ISO timestamp or date string → dd-mm-yyyy (date part; uses IST fallback via Intl when needed). */
export function formatIsoDateOnlyDdMmYyyy(iso: string | null | undefined): string {
  return formatDocumentDateDdMmYyyy(null, iso);
}

/** Packing list document date as dd-mm-yyyy (IST), per docs/PRODUCT.md timezone. */
export function formatDocumentDateDdMmYyyy(
  documentDate: string | null | undefined,
  issuedAt: string | null | undefined,
): string {
  if (documentDate != null && String(documentDate).trim() !== "") {
    return toDdMmYyyy(documentDate);
  }
  if (issuedAt) {
    return toDdMmYyyy(issuedAt);
  }
  return "—";
}

function toDdMmYyyy(input: string): string {
  const s = input.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoDate) {
    return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return s;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (day && month && year) {
    return `${day}-${month}-${year}`;
  }
  return s;
}

/** Full date+time in Asia/Kolkata for audit footers (issued / updated). */
export function formatDateTimeIst(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
}
