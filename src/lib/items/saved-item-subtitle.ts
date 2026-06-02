/** Compact make & model line for saved-item pickers and selected line preview. */
export function savedItemMakeModelSubtitle(
  line: {
    make_service_provider?: string | null;
    model_part_no_description?: string | null;
  },
): string | null {
  const bits: string[] = [];
  const mk = line.make_service_provider?.trim();
  const m = line.model_part_no_description?.trim();
  if (mk) bits.push(mk);
  if (m) bits.push(m);
  return bits.length ? bits.join(" · ") : null;
}

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
  const makeModel = savedItemMakeModelSubtitle(line);
  const bits: string[] = makeModel ? [makeModel] : [];
  const h = (line.hsn_sac ?? line.hsn)?.trim();
  if (!omitHsn && h) bits.push(`HSN: ${h}`);
  return bits.length ? bits.join(" · ") : null;
}
