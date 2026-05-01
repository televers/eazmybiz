/** Size column: show stored dimensions with cm unit (avoid duplicate "cm"). */
export function formatPackageSizeCm(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "—";
  if (/\bcm\b/i.test(s)) return s;
  return `${s} cm`;
}

/** Gross weight column: value with kg unit. */
export function formatGrossWeightKg(kg: number | null | undefined): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return `${kg} kg`;
}
