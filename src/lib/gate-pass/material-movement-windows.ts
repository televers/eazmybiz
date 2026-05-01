const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/** Wall-clock window after issue during which gate staff may record material movement (matches app). */
export const MATERIAL_MOVEMENT_RECORD_WINDOW_MS = FORTY_EIGHT_HOURS_MS;

/** Row / card highlight when issued, movement not recorded, and this long since issue. */
export const MATERIAL_MOVEMENT_OVERDUE_HIGHLIGHT_MS = TWENTY_FOUR_HOURS_MS;

/** Same visual language as visitor overdue check-out. */
export const gatePassMovementOverdueRowClassName =
  "bg-red-500/10 border-l-4 border-red-600 dark:bg-red-950/40 dark:border-red-500";

export function canRecordMaterialMovementWithinIssueWindow(issuedAt: string | null | undefined): boolean {
  if (issuedAt == null || String(issuedAt).trim() === "") return false;
  const t = new Date(issuedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= FORTY_EIGHT_HOURS_MS;
}

/** Issued, no movement recorded, and more than 24h since issue — highlight on lists and detail. */
export function isIssuedGatePassMovementPendingOver24h(input: {
  status: string;
  issued_at?: string | null;
  material_moved_at?: string | null;
}): boolean {
  if (input.status !== "issued") return false;
  if (input.material_moved_at) return false;
  const raw = input.issued_at;
  if (raw == null || String(raw).trim() === "") return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > TWENTY_FOUR_HOURS_MS;
}
