/** Wall-clock window after `issued_at` during which an issued document may still be edited. */
export const ISSUED_EDIT_WINDOW_MS = 8 * 60 * 60 * 1000;

export function canEditIssuedDocument(issuedAt: string | null | undefined): boolean {
  if (!issuedAt) return false;
  const t = new Date(issuedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() <= t + ISSUED_EDIT_WINDOW_MS;
}

/** Native `title` on disabled Edit control — do not surface elsewhere. */
export const ISSUED_EDIT_DISABLED_HOVER =
  "Edits to issued documents are allowed up to 8 hours from the issue time.";

/** Server / bypass UI — avoid mentioning the 8-hour rule in user-visible error strings. */
export const ISSUED_EDIT_CLOSED_MESSAGE = "This issued document can no longer be edited.";
