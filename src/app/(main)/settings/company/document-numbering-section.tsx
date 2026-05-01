"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  clampSeriesSlotValue,
  effectivePrefixForKindAndSlot,
  effectiveSeriesSlotForDocKind,
  emptyPrefixOverridesBySlot,
  maxDocumentSeriesSlots,
  parseDocPrefixOverridesFromOrg,
  parseDocSeriesProfilesJson,
  previewDocumentNumber,
  seriesConfigForPreviewSlot,
  type DocNumberFormat,
  type DocPrefixOverrideKind,
  type DocPrefixOverridesBySlot,
  type DocSeriesExtraProfile,
  type DocSeriesMode,
  type DocumentSeriesConfig,
} from "@/lib/documents/document-numbering";
import { orgCalendarTodayYmd } from "@/lib/dates/org-calendar";
import type { Organization } from "@/types/database";
import { saveDocumentNumberingSettings } from "./actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";

const seriesColumnField =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm w-full min-w-0";

const MONTH_OPTIONS: readonly [number, string][] = [
  [1, "January"],
  [2, "February"],
  [3, "March"],
  [4, "April"],
  [5, "May"],
  [6, "June"],
  [7, "July"],
  [8, "August"],
  [9, "September"],
  [10, "October"],
  [11, "November"],
  [12, "December"],
];

function normMode(s: string | undefined, isPaid: boolean): DocSeriesMode {
  if (
    s === "year_january" ||
    s === "year_april" ||
    s === "year_custom" ||
    s === "continuous"
  ) {
    if (!isPaid && s === "continuous") return "year_april";
    if (
      !isPaid &&
      s !== "year_january" &&
      s !== "year_april" &&
      s !== "year_custom"
    ) {
      return "year_april";
    }
    return s;
  }
  return isPaid ? "continuous" : "year_april";
}

function normFmt(s: string | undefined, isPaid: boolean): DocNumberFormat {
  if (!isPaid) return "dash";
  return s === "slash" ? "slash" : "dash";
}

function SeriesResetFields({
  group,
  disabled,
  showContinuous,
  mode,
  onMode,
  customMonth,
  customDay,
  onMonth,
  onDay,
}: {
  group: string;
  disabled: boolean;
  showContinuous: boolean;
  mode: DocSeriesMode;
  onMode: (m: DocSeriesMode) => void;
  customMonth: number;
  customDay: number;
  onMonth: (n: number) => void;
  onDay: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {showContinuous ? (
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name={group}
            className="mt-1"
            disabled={disabled}
            checked={mode === "continuous"}
            onChange={() => onMode("continuous")}
          />
          <span>Never reset (one continuous series)</span>
        </label>
      ) : null}
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name={group}
          className="mt-1"
          disabled={disabled}
          checked={mode === "year_january"}
          onChange={() => onMode("year_january")}
        />
        <span>Every year on 1 January</span>
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name={group}
          className="mt-1"
          disabled={disabled}
          checked={mode === "year_april"}
          onChange={() => onMode("year_april")}
        />
        <span>Every year on 1 April</span>
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name={group}
          className="mt-1"
          disabled={disabled}
          checked={mode === "year_custom"}
          onChange={() => onMode("year_custom")}
        />
        <span className="space-y-2">
          <span className="block">Custom: same calendar date every year</span>
          {mode === "year_custom" ? (
            <span className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
              <span>Reset on</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                disabled={disabled}
                value={customMonth}
                onChange={(e) => onMonth(Number(e.target.value))}
              >
                {MONTH_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                disabled={disabled}
                className="w-16 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                value={customDay}
                onChange={(e) => onDay(Number(e.target.value) || 1)}
              />
              <span>(day of month)</span>
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}

const OVERRIDE_FIELD_LABELS: { kind: DocPrefixOverrideKind; label: string }[] = [
  { kind: "qt", label: "Quotation" },
  { kind: "pl", label: "Packing list" },
  { kind: "dc", label: "Delivery challan" },
  { kind: "gp", label: "Gate pass" },
  { kind: "vs", label: "Visitor pass" },
];

function SeriesPrintedPrefixFields({
  heading,
  hint,
  disabled,
  values,
  onChange,
  placeholders,
}: {
  heading: string;
  hint?: string;
  disabled: boolean;
  values: Partial<Record<DocPrefixOverrideKind, string>>;
  onChange: (kind: DocPrefixOverrideKind, value: string) => void;
  placeholders?: Partial<Record<DocPrefixOverrideKind, string>>;
}) {
  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-2 mt-2">
      <p className="text-xs font-medium text-[var(--foreground)]">{heading}</p>
      {hint ? <p className="text-[11px] leading-snug text-[var(--muted)]">{hint}</p> : null}
      <div className="space-y-2">
        {OVERRIDE_FIELD_LABELS.map(({ kind, label }) => (
          <label key={kind} className="block space-y-0.5">
            <span className="text-[11px] text-[var(--muted)]">{label}</span>
            <input
              type="text"
              className={seriesColumnField}
              maxLength={18}
              disabled={disabled}
              value={values[kind] ?? ""}
              placeholder={placeholders?.[kind] ?? ""}
              onChange={(e) => onChange(kind, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function initialAssignedSlot(
  organization: Organization,
  maxSlots: number,
  kind: "qt" | "pl" | "dc" | "gp" | "vs",
): number {
  const fallback = clampSeriesSlotValue(Number(organization.doc_series_default_slot ?? 1), maxSlots);
  const col =
    kind === "qt"
      ? organization.doc_series_slot_quotation
      : kind === "pl"
        ? organization.doc_series_slot_packing_list
        : kind === "dc"
          ? organization.doc_series_slot_delivery_challan
          : kind === "gp"
            ? organization.doc_series_slot_gate_pass
            : organization.doc_series_slot_visitor;
  return clampSeriesSlotValue(Number(col ?? fallback), maxSlots);
}

export function DocumentNumberingSection({
  organization,
  canManage,
  usedSlots,
  canConfigureAdvancedNumbering,
}: {
  organization: Organization;
  canManage: boolean;
  usedSlots: number[];
  canConfigureAdvancedNumbering: boolean;
}) {
  const router = useRouter();
  const isPaid = organization.plan !== "free";
  const maxSlots = maxDocumentSeriesSlots(organization.plan);
  const extrasLen = Math.max(0, maxSlots - 1);
  const orgCal = organization;

  const used = useMemo(() => new Set(usedSlots), [usedSlots]);

  const [multiEnabled, setMultiEnabled] = useState(
    () => isPaid && Boolean(organization.doc_multi_series_enabled),
  );
  const [seriesMode, setSeriesMode] = useState<DocSeriesMode>(() =>
    normMode(organization.doc_series_mode, isPaid),
  );
  const [customMonth, setCustomMonth] = useState<number>(() => {
    const m = organization.doc_series_custom_month;
    return m != null && m >= 1 && m <= 12 ? m : 4;
  });
  const [customDay, setCustomDay] = useState<number>(() => {
    const d = organization.doc_series_custom_day;
    return d != null && d >= 1 && d <= 31 ? d : 1;
  });

  const [extras, setExtras] = useState<DocSeriesExtraProfile[]>(() =>
    parseDocSeriesProfilesJson(organization.doc_series_profiles, extrasLen),
  );

  const [slotQt, setSlotQt] = useState(() => initialAssignedSlot(organization, maxSlots, "qt"));
  const [slotPl, setSlotPl] = useState(() => initialAssignedSlot(organization, maxSlots, "pl"));
  const [slotDc, setSlotDc] = useState(() => initialAssignedSlot(organization, maxSlots, "dc"));
  const [slotGp, setSlotGp] = useState(() => initialAssignedSlot(organization, maxSlots, "gp"));
  const [slotVs, setSlotVs] = useState(() => initialAssignedSlot(organization, maxSlots, "vs"));

  const [numberFormat, setNumberFormat] = useState<DocNumberFormat>(() =>
    normFmt(organization.doc_number_format, isPaid),
  );
  const [pq, setPq] = useState(organization.doc_prefix_quotation ?? "QT");
  const [pl, setPl] = useState(organization.doc_prefix_packing_list ?? "PL");
  const [dc, setDc] = useState(organization.doc_prefix_delivery_challan ?? "DC");
  const [gp, setGp] = useState(organization.doc_prefix_gate_pass ?? "GP");
  const [vs, setVs] = useState(organization.doc_prefix_visitor ?? "VP");
  const [overridesBySlot, setOverridesBySlot] = useState<DocPrefixOverridesBySlot>(() =>
    parseDocPrefixOverridesFromOrg(organization.doc_prefix_overrides, maxSlots),
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refYmd = useMemo(() => orgCalendarTodayYmd(orgCal), [orgCal]);

  const seriesConfig: DocumentSeriesConfig = useMemo(
    () => ({
      mode: seriesMode,
      customMonth: seriesMode === "year_custom" ? customMonth : null,
      customDay: seriesMode === "year_custom" ? customDay : null,
    }),
    [seriesMode, customMonth, customDay],
  );

  const mainPrefixRec = useMemo(
    (): Record<DocPrefixOverrideKind, string> => ({
      qt: pq,
      pl,
      dc,
      gp,
      vs,
    }),
    [pq, pl, dc, gp, vs],
  );

  const exampleSlots = useMemo(() => {
    if (!isPaid) return [1];
    if (!multiEnabled) return [1];
    return Array.from({ length: maxSlots }, (_, i) => i + 1);
  }, [isPaid, multiEnabled, maxSlots]);

  const compactPreviewCells = useMemo((): string[][] => {
    const pfxFree: Record<DocPrefixOverrideKind, string> = {
      qt: "QT",
      pl: "PL",
      dc: "DC",
      gp: "GP",
      vs: "VP",
    };
    return exampleSlots.map((slot) =>
      OVERRIDE_FIELD_LABELS.map(({ kind }) => {
        const pfx = isPaid
          ? effectivePrefixForKindAndSlot(kind, mainPrefixRec, overridesBySlot, slot)
          : pfxFree[kind];
        const cfg = isPaid ? seriesConfigForPreviewSlot(slot, seriesConfig, extras) : seriesConfig;
        const fmt = isPaid ? numberFormat : "dash";
        return previewDocumentNumber(pfx, cfg, fmt, refYmd, 1);
      }),
    );
  }, [
    exampleSlots,
    isPaid,
    mainPrefixRec,
    overridesBySlot,
    seriesConfig,
    extras,
    numberFormat,
    refYmd,
  ]);

  function updateExtra(i: number, patch: Partial<DocSeriesExtraProfile>) {
    setExtras((prev) => {
      const next = [...prev];
      const cur = next[i] ?? { mode: "year_april" as const, month: null, day: null };
      next[i] = { ...cur, ...patch };
      if (patch.mode != null && patch.mode !== "year_custom") {
        next[i] = { ...next[i]!, month: null, day: null };
      }
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await saveDocumentNumberingSettings({
        docSeriesMode: seriesMode,
        docNumberFormat: numberFormat,
        docSeriesCustomMonth: seriesMode === "year_custom" ? customMonth : null,
        docSeriesCustomDay: seriesMode === "year_custom" ? customDay : null,
        docPrefixQuotation: pq,
        docPrefixPackingList: pl,
        docPrefixDeliveryChallan: dc,
        docPrefixGatePass: gp,
        docPrefixVisitor: vs,
        docMultiSeriesEnabled:
          canConfigureAdvancedNumbering && isPaid ? multiEnabled : undefined,
        docSeriesExtras: extras.map((x) => ({
          mode: x.mode,
          month: x.month,
          day: x.day,
        })),
        docSeriesSlotQuotation: slotQt,
        docSeriesSlotPackingList: slotPl,
        docSeriesSlotDeliveryChallan: slotDc,
        docSeriesSlotGatePass: slotGp,
        docSeriesSlotVisitor: slotVs,
        docPrefixOverridesBySlot:
          canConfigureAdvancedNumbering && isPaid && multiEnabled
            ? overridesBySlot
            : undefined,
      });
      setInfo("Saved document numbering.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  if (!canManage) return null;

  const multiActive = isPaid && multiEnabled;
  const slotOpts = Array.from({ length: maxSlots }, (_, i) => i + 1);
  const seriesGridClass =
    multiActive && maxSlots >= 5
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : multiActive
        ? "grid grid-cols-1 gap-3 md:grid-cols-3"
        : "grid grid-cols-1 gap-3";

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-6">
      <h2 className="text-lg font-semibold">Document numbers</h2>

      <form onSubmit={onSave} className="space-y-6">
        <div className="space-y-3 border-b border-[var(--border)] pb-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">When the counter resets</h3>

          {isPaid && canConfigureAdvancedNumbering ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={multiEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  setMultiEnabled(on);
                  if (on) {
                    setExtras(parseDocSeriesProfilesJson(undefined, extrasLen));
                    setSlotQt(1);
                    setSlotPl(1);
                    setSlotDc(1);
                    setSlotGp(1);
                    setSlotVs(1);
                    setOverridesBySlot(emptyPrefixOverridesBySlot(maxSlots));
                  }
                }}
              />
              <span>
                Multiple independent series: <strong>{maxSlots} parallel columns</strong> below (Pro: 3 ·
                Max: 5). Configure reset rules per column, then assign each document type to a series in
                the table.
              </span>
            </label>
          ) : null}

          {isPaid && organization.doc_multi_series_enabled && !canConfigureAdvancedNumbering ? (
            <p className="text-xs text-[var(--muted)]">
              Multiple numbering series are enabled. Only a company admin or account owner can change
              series setup.
            </p>
          ) : null}

          {isPaid ? (
            <div className={seriesGridClass}>
              <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-3 space-y-2 min-w-0">
                <p className="text-xs font-semibold text-[var(--foreground)]">Series 1</p>
                {used.has(1) ? (
                  <p className="text-xs text-[var(--muted)]">
                    Locked — documents already issued on this series.
                  </p>
                ) : null}
                <SeriesResetFields
                  group="series1"
                  disabled={used.has(1)}
                  showContinuous
                  mode={seriesMode}
                  onMode={setSeriesMode}
                  customMonth={customMonth}
                  customDay={customDay}
                  onMonth={setCustomMonth}
                  onDay={setCustomDay}
                />
                <SeriesPrintedPrefixFields
                  heading="Printed prefixes"
                  hint="Up to 18 characters per type (A–Z, a–z, 0–9, /, -). No spaces."
                  disabled={false}
                  values={{ qt: pq, pl, dc, gp, vs }}
                  placeholders={{ qt: "QT", pl: "PL", dc: "DC", gp: "GP", vs: "VP" }}
                  onChange={(kind, v) => {
                    if (kind === "qt") setPq(v);
                    else if (kind === "pl") setPl(v);
                    else if (kind === "dc") setDc(v);
                    else if (kind === "gp") setGp(v);
                    else setVs(v);
                  }}
                />
              </div>

              {multiActive && extrasLen > 0
                ? extras.map((ex, i) => {
                    const slotNum = i + 2;
                    const locked = used.has(slotNum);
                    return (
                      <div
                        key={slotNum}
                        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-3 space-y-2 min-w-0"
                      >
                        <p className="text-xs font-semibold text-[var(--foreground)]">Series {slotNum}</p>
                        {locked ? (
                          <p className="text-xs text-[var(--muted)]">
                            Locked — documents already issued on this series.
                          </p>
                        ) : null}
                        <SeriesResetFields
                          group={`series${slotNum}`}
                          disabled={locked || !canConfigureAdvancedNumbering}
                          showContinuous
                          mode={ex.mode}
                          onMode={(m) => updateExtra(i, { mode: m })}
                          customMonth={ex.month ?? 4}
                          customDay={ex.day ?? 1}
                          onMonth={(n) => updateExtra(i, { month: n })}
                          onDay={(n) => updateExtra(i, { day: n })}
                        />
                        <SeriesPrintedPrefixFields
                          heading="Printed prefix overrides"
                          hint="Optional — blank uses Series 1 prefix for that document type."
                          disabled={locked || !canConfigureAdvancedNumbering}
                          values={overridesBySlot[slotNum] ?? {}}
                          placeholders={Object.fromEntries(
                            OVERRIDE_FIELD_LABELS.map(({ kind }) => [
                              kind,
                              `Series ${slotNum} · optional`,
                            ]),
                          ) as Partial<Record<DocPrefixOverrideKind, string>>}
                          onChange={(kind, value) => {
                            setOverridesBySlot((prev) => ({
                              ...prev,
                              [slotNum]: { ...prev[slotNum], [kind]: value },
                            }));
                          }}
                        />
                      </div>
                    );
                  })
                : null}
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Series reset schedule</legend>
              <p className="text-sm text-[var(--muted)]">
                Prefixes stay QT, PL, DC, GP, and VP on Free. Pick one reset schedule:
              </p>
              <SeriesResetFields
                group="seriesFree"
                disabled={used.has(1)}
                showContinuous={false}
                mode={seriesMode}
                onMode={setSeriesMode}
                customMonth={customMonth}
                customDay={customDay}
                onMonth={setCustomMonth}
                onDay={setCustomDay}
              />
            </fieldset>
          )}
        </div>

        {multiActive && canConfigureAdvancedNumbering ? (
          <div className="space-y-2 border-b border-[var(--border)] pb-6">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Default series per document type
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Each row must use a series (1–{maxSlots}). New companies default to <strong>Series 1</strong>{" "}
              for every type, matching standard prefixes QT, PL, DC, GP, VP.
            </p>
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                    <th className="px-3 py-2 text-left font-medium">Document</th>
                    <th className="px-3 py-2 text-left font-medium">Uses series</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="px-3 py-2">Quotation</td>
                    <td className="px-3 py-2">
                      <select
                        className={seriesColumnField}
                        value={slotQt}
                        onChange={(e) => setSlotQt(Number(e.target.value))}
                        required
                      >
                        {slotOpts.map((n) => (
                          <option key={n} value={n}>
                            Series {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Packing list</td>
                    <td className="px-3 py-2">
                      <select
                        className={seriesColumnField}
                        value={slotPl}
                        onChange={(e) => setSlotPl(Number(e.target.value))}
                        required
                      >
                        {slotOpts.map((n) => (
                          <option key={n} value={n}>
                            Series {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Delivery challan</td>
                    <td className="px-3 py-2">
                      <select
                        className={seriesColumnField}
                        value={slotDc}
                        onChange={(e) => setSlotDc(Number(e.target.value))}
                        required
                      >
                        {slotOpts.map((n) => (
                          <option key={n} value={n}>
                            Series {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Gate pass</td>
                    <td className="px-3 py-2">
                      <select
                        className={seriesColumnField}
                        value={slotGp}
                        onChange={(e) => setSlotGp(Number(e.target.value))}
                        required
                      >
                        {slotOpts.map((n) => (
                          <option key={n} value={n}>
                            Series {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Visitor pass</td>
                    <td className="px-3 py-2">
                      <select
                        className={seriesColumnField}
                        value={slotVs}
                        onChange={(e) => setSlotVs(Number(e.target.value))}
                        required
                      >
                        {slotOpts.map((n) => (
                          <option key={n} value={n}>
                            Series {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {multiActive && !canConfigureAdvancedNumbering ? (
          <div className="space-y-1 border-b border-[var(--border)] pb-6 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)]">Series in use</p>
            <p>
              Default: series {organization.doc_series_default_slot ?? 1} · Quotation: series{" "}
              {effectiveSeriesSlotForDocKind(organization, "qt")} · Packing: series{" "}
              {effectiveSeriesSlotForDocKind(organization, "pl")} · Challan: series{" "}
              {effectiveSeriesSlotForDocKind(organization, "dc")} · Gate: series{" "}
              {effectiveSeriesSlotForDocKind(organization, "gp")} · Visitor: series{" "}
              {effectiveSeriesSlotForDocKind(organization, "vs")}
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{"Format & examples"}</h3>
          <p className="text-xs text-[var(--muted)]">
            Prefixes for each series are edited in the columns above. Here you choose dash vs slash before
            the serial, and preview the first number (…00001) for <strong>today</strong> on your org
            calendar.
          </p>
          {isPaid ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--foreground)]">Separator</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="docFmt"
                    checked={numberFormat === "dash"}
                    onChange={() => setNumberFormat("dash")}
                  />
                  Dash before serial
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="docFmt"
                    checked={numberFormat === "slash"}
                    onChange={() => setNumberFormat("slash")}
                  />
                  Slash before serial
                </label>
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Upgrade to Pro or Max for custom prefixes (up to 18 characters per document type, including /
              and -) and slash formatting.
            </p>
          )}

          <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 sm:px-3">
            <p className="text-xs font-medium text-[var(--foreground)] mb-2">Sample numbers</p>
            <div className="overflow-x-auto -mx-0.5">
              <table className="w-full min-w-[280px] border-collapse text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th
                      scope="col"
                      className="py-1 pr-2 text-left font-medium text-[var(--foreground)] whitespace-nowrap"
                    />
                    {exampleSlots.map((s) => (
                      <th
                        key={s}
                        scope="col"
                        className="py-1 px-1.5 text-left font-medium text-[var(--foreground)] whitespace-nowrap"
                      >
                        S{s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[var(--muted)]">
                  {OVERRIDE_FIELD_LABELS.map(({ kind, label }, rowIdx) => (
                    <tr key={kind} className="border-b border-[var(--border)] last:border-b-0">
                      <th
                        scope="row"
                        className="py-1 pr-2 text-left font-normal text-[var(--foreground)] whitespace-nowrap align-top"
                      >
                        {label}
                      </th>
                      {exampleSlots.map((slot, colIdx) => (
                        <td
                          key={`${slot}-${kind}`}
                          className="py-1 px-1.5 font-mono tabular-nums align-top break-all"
                        >
                          {compactPreviewCells[colIdx]?.[rowIdx] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{info}</p> : null}

        <button type="submit" disabled={loading} className={primaryButtonMd}>
          {loading ? "Saving…" : "Save numbering"}
        </button>
      </form>
    </section>
  );
}
