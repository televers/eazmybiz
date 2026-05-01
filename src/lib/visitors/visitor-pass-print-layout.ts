export type VisitorPassPrintLayout = "id_card" | "a5_foldable";

export const VISITOR_PASS_PRINT_LAYOUT_VALUES: readonly VisitorPassPrintLayout[] = ["id_card", "a5_foldable"];

export function normalizeVisitorPassPrintLayout(
  raw: string | null | undefined,
): VisitorPassPrintLayout {
  return raw === "a5_foldable" ? "a5_foldable" : "id_card";
}

function firstSearchParamValue(
  raw: string | string[] | undefined,
): string | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = typeof s === "string" ? s.trim() : "";
  return t ? t : undefined;
}

/**
 * Explicit `layout` query wins (`a5` / `a5_foldable` vs `id_card`), else organization default.
 */
export function resolveVisitorPassPrintLayout(
  layoutParam: string | string[] | undefined,
  orgDefault: string | null | undefined,
): VisitorPassPrintLayout {
  const v = firstSearchParamValue(layoutParam)?.toLowerCase();
  if (v === "a5" || v === "a5_foldable" || v === "foldable") {
    return "a5_foldable";
  }
  if (v === "id_card" || v === "card" || v === "id1") {
    return "id_card";
  }
  return normalizeVisitorPassPrintLayout(orgDefault);
}

/**
 * Build path with optional `layout` and `fromCheckin` query params.
 */
export function visitorPassPrintPath(
  visitId: string,
  layout: VisitorPassPrintLayout,
  options?: { fromCheckin?: boolean },
): string {
  const p = new URLSearchParams();
  p.set("layout", layout === "a5_foldable" ? "a5" : "id_card");
  if (options?.fromCheckin) p.set("fromCheckin", "1");
  const q = p.toString();
  return `/visitors/${visitId}/print${q ? `?${q}` : ""}`;
}
