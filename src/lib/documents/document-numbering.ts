import { orgCalendarTodayYmd, type OrgCalendarSource } from "@/lib/dates/org-calendar";
import { normalizeOptionalDocumentYmd } from "@/lib/documents/document-ymd";
import type { Organization, PlanTier } from "@/types/database";

export const DOC_SERIES_MODES = [
  "continuous",
  "year_january",
  "year_april",
  "year_custom",
] as const;
export type DocSeriesMode = (typeof DOC_SERIES_MODES)[number];

export const DOC_NUMBER_FORMATS = ["dash", "slash"] as const;
export type DocNumberFormat = (typeof DOC_NUMBER_FORMATS)[number];

/** Paid prefixes: 1–18 chars (letters, digits, /, -) before the serial (e.g. 00001). */
const PREFIX_RE = /^[A-Za-z0-9/-]{1,18}$/;

export type DocumentSeriesConfig = {
  mode: DocSeriesMode;
  customMonth?: number | null;
  customDay?: number | null;
};

export function normalizeDocSeriesMode(
  raw: string | null | undefined,
  plan: PlanTier,
): DocSeriesMode {
  const s = String(raw ?? "").trim();
  if (s === "year_january" || s === "year_april" || s === "year_custom" || s === "continuous") {
    if (plan === "free" && s === "continuous") return "year_april";
    if (
      plan === "free" &&
      s !== "year_january" &&
      s !== "year_april" &&
      s !== "year_custom"
    ) {
      return "year_april";
    }
    return s;
  }
  return plan === "free" ? "year_april" : "continuous";
}

export function normalizeDocNumberFormat(raw: string | null | undefined): DocNumberFormat {
  return String(raw ?? "").trim() === "slash" ? "slash" : "dash";
}

export function validatePaidDocPrefix(label: string, value: string): string {
  const v = value.trim();
  if (!PREFIX_RE.test(v)) {
    throw new Error(
      `${label}: use 1–18 characters (letters, digits, / or - only; no spaces).`,
    );
  }
  return v;
}

/** Calendar-valid month/day for an annual reset (uses a leap year so 29 Feb is allowed). */
export function assertValidAnnualResetDay(month: number, day: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Reset month must be between 1 and 12.");
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Reset day must be between 1 and 31.");
  }
  const cal = new Date(2024, month - 1, day);
  if (cal.getMonth() !== month - 1 || cal.getDate() !== day) {
    throw new Error("That month does not have that many days.");
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Period-start YYYY-MM-DD for custom annual reset (matches SQL next_document_number). */
export function anchorYmdForYearCustom(refYmd: string, month: number, day: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refYmd)) return "";
  const y = Number.parseInt(refYmd.slice(0, 4), 10);
  const dim = daysInMonth(y, month);
  const dEff = Math.min(day, dim);
  const anchorThis = `${y}-${String(month).padStart(2, "0")}-${String(dEff).padStart(2, "0")}`;
  if (refYmd < anchorThis) {
    const py = y - 1;
    const dimP = daysInMonth(py, month);
    const dEffP = Math.min(day, dimP);
    return `${py}-${String(month).padStart(2, "0")}-${String(dEffP).padStart(2, "0")}`;
  }
  return anchorThis;
}

/** Series key segment used in `document_sequences` (SQL); not shown in the printed number. */
export function seriesSegmentFromRef(refYmd: string, config: DocumentSeriesConfig): string {
  const { mode, customMonth, customDay } = config;
  if (mode === "continuous") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refYmd)) return "";
  if (mode === "year_january") return refYmd.slice(0, 4);
  if (mode === "year_april") {
    const y = Number.parseInt(refYmd.slice(0, 4), 10);
    const m = Number.parseInt(refYmd.slice(5, 7), 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
    const startYear = m >= 4 ? y : y - 1;
    const endYear = startYear + 1;
    return `${startYear}-${String(endYear % 100).padStart(2, "0")}`;
  }
  if (mode === "year_custom") {
    const cm = customMonth ?? null;
    const cd = customDay ?? null;
    if (cm == null || cd == null) return "";
    return anchorYmdForYearCustom(refYmd, cm, cd);
  }
  return "";
}

/** Reference calendar day for numbering (document / pass / visit date), else org today. */
export function referenceYmdForDocNumber(
  documentYmd: string | null | undefined,
  org: OrgCalendarSource,
): string {
  const d = normalizeOptionalDocumentYmd(documentYmd);
  if (d) return d;
  return orgCalendarTodayYmd(org);
}

export function previewDocumentNumber(
  prefix: string,
  _seriesConfig: DocumentSeriesConfig,
  format: DocNumberFormat,
  _refYmd: string,
  seq: number = 1,
): string {
  const n = String(seq).padStart(5, "0");
  const p = prefix.trim();
  return format === "slash" ? `${p}/${n}` : `${p}-${n}`;
}

/** Max independent numbering series per plan (slot 1..N). */
export function maxDocumentSeriesSlots(plan: PlanTier): number {
  if (plan === "max") return 5;
  if (plan === "pro") return 3;
  return 1;
}

export type DocumentNumberingDocKind = "qt" | "pl" | "dc";

export type DocumentSeriesSlotKind = DocumentNumberingDocKind | "gp" | "vs";

/** Props for new-document UI: preview + optional series picker. */
export type DocumentNumberingCreateProps = {
  docType: DocumentNumberingDocKind;
  multiSeriesEnabled: boolean;
  maxSlots: number;
  /** Resolved default for this doc kind (per-type slot or org default). */
  effectiveDefaultSlot: number;
};

export function clampSeriesSlotValue(n: number, maxSlots: number): number {
  if (!Number.isFinite(n)) return 1;
  const x = Math.floor(n);
  if (x < 1) return 1;
  if (x > maxSlots) return maxSlots;
  return x;
}

/** Per-type slot from org, or org default, clamped to plan max. */
export function effectiveSeriesSlotForDocKind(
  org: Pick<
    Organization,
    | "plan"
    | "doc_multi_series_enabled"
    | "doc_series_default_slot"
    | "doc_series_slot_quotation"
    | "doc_series_slot_packing_list"
    | "doc_series_slot_delivery_challan"
    | "doc_series_slot_gate_pass"
    | "doc_series_slot_visitor"
  >,
  kind: DocumentSeriesSlotKind,
): number {
  const maxSlots = maxDocumentSeriesSlots(org.plan);
  const def = clampSeriesSlotValue(Number(org.doc_series_default_slot ?? 1), maxSlots);
  const col =
    kind === "qt"
      ? org.doc_series_slot_quotation
      : kind === "pl"
        ? org.doc_series_slot_packing_list
        : kind === "dc"
          ? org.doc_series_slot_delivery_challan
          : kind === "gp"
            ? org.doc_series_slot_gate_pass
            : org.doc_series_slot_visitor;
  const raw = col == null ? def : Number(col);
  return clampSeriesSlotValue(raw, maxSlots);
}

export function documentNumberingCreateProps(
  org: Pick<
    Organization,
    | "plan"
    | "doc_multi_series_enabled"
    | "doc_series_default_slot"
    | "doc_series_slot_quotation"
    | "doc_series_slot_packing_list"
    | "doc_series_slot_delivery_challan"
  >,
  docType: DocumentNumberingDocKind,
): DocumentNumberingCreateProps {
  return {
    docType,
    multiSeriesEnabled: org.plan !== "free" && Boolean(org.doc_multi_series_enabled),
    maxSlots: maxDocumentSeriesSlots(org.plan),
    effectiveDefaultSlot: effectiveSeriesSlotForDocKind(org, docType),
  };
}

export type DocSeriesExtraProfile = {
  mode: DocSeriesMode;
  month: number | null;
  day: number | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Extra series configs (slots 2..N) stored in `organizations.doc_series_profiles` JSONB. */
export function parseDocSeriesProfilesJson(raw: unknown, expectedLength: number): DocSeriesExtraProfile[] {
  if (!Array.isArray(raw)) {
    return Array.from({ length: expectedLength }, () => ({
      mode: "year_april" as DocSeriesMode,
      month: null,
      day: null,
    }));
  }
  const out: DocSeriesExtraProfile[] = [];
  for (let i = 0; i < expectedLength; i++) {
    const el = raw[i];
    if (!isRecord(el)) {
      out.push({ mode: "year_april", month: null, day: null });
      continue;
    }
    const m = String(el.mode ?? "year_april").trim();
    const mode = (
      m === "continuous" ||
      m === "year_january" ||
      m === "year_april" ||
      m === "year_custom"
        ? m
        : "year_april"
    ) as DocSeriesMode;
    const month = typeof el.month === "number" && Number.isInteger(el.month) ? el.month : null;
    const day = typeof el.day === "number" && Number.isInteger(el.day) ? el.day : null;
    out.push({ mode, month, day });
  }
  return out;
}

export function docSeriesProfilesForDb(profiles: DocSeriesExtraProfile[]): unknown {
  return profiles.map((p) => ({
    mode: p.mode,
    month: p.month,
    day: p.day,
  }));
}

/** Normalize extra profile for paid plan (custom dates only when mode is year_custom). */
export function normalizeExtraSeriesProfile(
  p: DocSeriesExtraProfile,
  plan: PlanTier,
): DocSeriesExtraProfile {
  const mode = normalizeDocSeriesMode(p.mode, plan);
  if (mode !== "year_custom") {
    return { mode, month: null, day: null };
  }
  const mo = p.month;
  const dy = p.day;
  if (mo == null || dy == null) {
    throw new Error("Choose month and day for each custom annual series.");
  }
  assertValidAnnualResetDay(mo, dy);
  return { mode, month: mo, day: dy };
}

/** Fingerprint for lock: same config → same string. */
export function fingerprintSeriesSlot1(org: {
  doc_series_mode?: string | null;
  doc_series_custom_month?: number | null;
  doc_series_custom_day?: number | null;
}): string {
  const mode = String(org.doc_series_mode ?? "");
  const m = org.doc_series_custom_month ?? "";
  const d = org.doc_series_custom_day ?? "";
  return `${mode}|${m}|${d}`;
}

export function fingerprintExtraProfile(p: DocSeriesExtraProfile): string {
  return `${p.mode}|${p.month ?? ""}|${p.day ?? ""}`;
}

/** Parse slot from stored `document_sequences.series_key` (`slot/period`). */
export function parseSeriesSlotFromKey(seriesKey: string | null | undefined): number | null {
  const m = /^([0-9]+)\//.exec(String(seriesKey ?? ""));
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** Slots that have at least one issued sequence row (`last_number` > 0). */
export function usedDocumentSeriesSlots(
  rows: { series_key: string }[] | null | undefined,
): Set<number> {
  const s = new Set<number>();
  for (const r of rows ?? []) {
    const slot = parseSeriesSlotFromKey(r.series_key);
    if (slot != null) s.add(slot);
    else if (String(r.series_key ?? "").length > 0) s.add(1);
  }
  return s;
}

/** Doc-type keys aligned with `organizations.doc_prefix_*` and RPC `p_doc_type`. */
export const DOC_PREFIX_OVERRIDE_KINDS = ["qt", "pl", "dc", "gp", "vs"] as const;
export type DocPrefixOverrideKind = (typeof DOC_PREFIX_OVERRIDE_KINDS)[number];

/** Series 2..N only: optional printed prefix per document type (slot 1 uses main prefix fields). */
export type DocPrefixOverridesBySlot = Record<
  number,
  Partial<Record<DocPrefixOverrideKind, string>>
>;

export function emptyPrefixOverridesBySlot(maxSlots: number): DocPrefixOverridesBySlot {
  const o: DocPrefixOverridesBySlot = {};
  if (maxSlots < 2) return o;
  for (let s = 2; s <= maxSlots; s++) o[s] = {};
  return o;
}

export function parseDocPrefixOverridesFromOrg(
  raw: unknown,
  maxSlots: number,
): DocPrefixOverridesBySlot {
  const slots = emptyPrefixOverridesBySlot(maxSlots);
  if (maxSlots < 2) return slots;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return slots;
  const root = raw as Record<string, unknown>;
  for (const kind of DOC_PREFIX_OVERRIDE_KINDS) {
    const row = root[kind];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    for (let s = 2; s <= maxSlots; s++) {
      const v = r[String(s)];
      if (typeof v === "string") {
        const t = v.trim();
        if (t) slots[s] = { ...slots[s], [kind]: t };
      }
    }
  }
  return slots;
}

const PREFIX_OVERRIDE_LABEL: Record<DocPrefixOverrideKind, string> = {
  qt: "Quotation prefix",
  pl: "Packing list prefix",
  dc: "Delivery challan prefix",
  gp: "Gate pass prefix",
  vs: "Visitor pass prefix",
};

/** Build JSON for `organizations.doc_prefix_overrides` (empty inner maps omitted). */
export function serializeDocPrefixOverridesForDb(
  slots: DocPrefixOverridesBySlot,
  maxSlots: number,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (maxSlots < 2) return out;
  for (const kind of DOC_PREFIX_OVERRIDE_KINDS) {
    const inner: Record<string, string> = {};
    for (let s = 2; s <= maxSlots; s++) {
      const raw = slots[s]?.[kind];
      if (raw == null || !String(raw).trim()) continue;
      const label = `${PREFIX_OVERRIDE_LABEL[kind]} (series ${s})`;
      inner[String(s)] = validatePaidDocPrefix(label, String(raw));
    }
    if (Object.keys(inner).length) out[kind] = inner;
  }
  return out;
}

export function seriesConfigForPreviewSlot(
  slot: number,
  slot1: DocumentSeriesConfig,
  extras: DocSeriesExtraProfile[],
): DocumentSeriesConfig {
  if (slot <= 1) return slot1;
  const ex = extras[slot - 2];
  if (!ex) return { mode: "year_april", customMonth: null, customDay: null };
  return {
    mode: ex.mode,
    customMonth: ex.mode === "year_custom" ? ex.month : null,
    customDay: ex.mode === "year_custom" ? ex.day : null,
  };
}

export function effectivePrefixForKindAndSlot(
  kind: DocPrefixOverrideKind,
  main: Record<DocPrefixOverrideKind, string>,
  overrides: DocPrefixOverridesBySlot,
  slot: number,
): string {
  if (slot > 1) {
    const o = overrides[slot]?.[kind];
    if (o != null && String(o).trim()) return String(o).trim();
  }
  return main[kind];
}

/** Last 5-digit serial from a displayed document number (matches DB allocation). */
export function parseAllocatedDocumentSerial(docNumberDisplay: string): number | null {
  const m = /(\d{5})$/.exec(String(docNumberDisplay ?? "").trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Resolved slot stored on new/duplicated rows and passed to `next_document_number`. */
export function resolvedSeriesSlotForDocCreate(
  org: Organization,
  kind: DocumentNumberingDocKind,
  inputSlot: number | null | undefined,
): number {
  const max = maxDocumentSeriesSlots(org.plan);
  if (org.plan === "free" || !org.doc_multi_series_enabled) return 1;
  if (inputSlot != null) return clampSeriesSlotValue(inputSlot, max);
  return effectiveSeriesSlotForDocKind(org, kind);
}
