/** Shared YYYY-MM-DD helpers — safe for Client Components (no server-only imports). */

const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeOptionalDocumentYmd(d: string | null | undefined): string | null {
  if (d == null || String(d).trim() === "") return null;
  const s = String(d).trim().slice(0, 10);
  if (!ISO_YMD.test(s)) return null;
  return s;
}
