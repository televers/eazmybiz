/** Compact one-line details for a saved/catalog line shown under the name in document editors. */
export function savedItemDetailsSubtitle(
  line: {
    model_part_no_description?: string | null;
    make_service_provider?: string | null;
    hsn_sac?: string | null;
    hsn?: string | null;
  },
  options?: { omitHsn?: boolean },
): string | null {
  const omitHsn = options?.omitHsn ?? false;
  const bits: string[] = [];
  const m = line.model_part_no_description?.trim();
  const mk = line.make_service_provider?.trim();
  const h = (line.hsn_sac ?? line.hsn)?.trim();
  if (m) bits.push(m);
  if (mk) bits.push(mk);
  if (!omitHsn && h) bits.push(`HSN: ${h}`);
  return bits.length ? bits.join(" · ") : null;
}
