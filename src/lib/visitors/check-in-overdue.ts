const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Wall-clock window after check-in during which check-out is allowed (matches server). */
export const VISITOR_CHECKOUT_WINDOW_MS = TWENTY_FOUR_HOURS_MS;

/** Checked in, not checked out, and past the 24h check-out window since check-in. */
export function isCheckedInOverdueNoCheckout(input: {
  status: string;
  checked_in_at?: string | null | undefined;
  checked_out_at?: string | null | undefined;
}): boolean {
  if (input.status !== "checked_in") return false;
  if (input.checked_out_at) return false;
  const raw = input.checked_in_at;
  if (raw == null || String(raw).trim() === "") return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > TWENTY_FOUR_HOURS_MS;
}

/** Whether check-out is still allowed (within 24h of `checked_in_at`). */
export function canVisitorCheckOutNow(checkedInAt: string | null | undefined): boolean {
  if (checkedInAt == null || String(checkedInAt).trim() === "") return false;
  const t = new Date(checkedInAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= TWENTY_FOUR_HOURS_MS;
}

/** Row highlight for visitor tables (Tailwind). */
export const visitorOverdueRowClassName =
  "bg-red-500/10 border-l-4 border-red-600 dark:bg-red-950/40 dark:border-red-500";
