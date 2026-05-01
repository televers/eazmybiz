/** Label for document creator snapshot (`created_by_display_name`). */
export function formatCreatedByLabel(name: string | null | undefined): string {
  const t = name?.trim();
  return t ? t : "—";
}
