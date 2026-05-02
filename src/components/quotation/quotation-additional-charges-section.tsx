"use client";

import { memo, type Dispatch, type SetStateAction } from "react";
import { formatMoney } from "@/lib/currencies";
import type { AdditionalChargeDraftRow } from "@/lib/quotation/additional-charges";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import {
  ADDITIONAL_CHARGE_LABEL_OPTIONS,
  ADDITIONAL_CHARGE_LABEL_OTHER,
} from "@/lib/quotation/line-presets";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";

const UNIT_PRICE_DECIMAL_PLACES = 4;
const TAX_DECIMAL_PLACES = 3;

function sanitizeDecimalInput(raw: string, maxDecimals: number, maxIntLen = 12): string {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (s.startsWith(".")) s = `0${s}`;
  const dot = s.indexOf(".");
  if (dot === -1) return s.slice(0, maxIntLen);
  const intPart = s.slice(0, dot).replace(/\./g, "") || "0";
  let decPart = s.slice(dot + 1).replace(/\./g, "");
  decPart = decPart.slice(0, maxDecimals);
  if (decPart.length === 0) return `${intPart}.`;
  return `${intPart}.${decPart}`;
}

function sanitizeTaxPercentInput(raw: string): string {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (s.startsWith(".")) s = `0${s}`;
  const dot = s.indexOf(".");
  if (dot === -1) return s.slice(0, 8);
  const intPart = s.slice(0, dot).replace(/\./g, "") || "0";
  let decPart = s.slice(dot + 1).replace(/\./g, "");
  decPart = decPart.slice(0, TAX_DECIMAL_PLACES);
  if (decPart.length === 0) return `${intPart}.`;
  return `${intPart}.${decPart}`;
}

function formatTaxDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function formatUnitPriceDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10000) / 10000;
  return String(r);
}

function parseTaxDraftToNumber(draft: string): number | null {
  const t = draft.trim();
  if (t === "" || t === ".") return null;
  if (t.endsWith(".")) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function parseUnitPriceDraftToNumber(draft: string): number | null {
  const t = draft.trim();
  if (t === "" || t === ".") return null;
  if (t.endsWith(".")) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

type QuotationCombinedTotals = ReturnType<typeof quotationTotalsWithAdditionalCharges>;

function QuotationAdditionalChargesSectionInner({
  currency,
  drafts,
  setDrafts,
  quotationCombined,
}: {
  currency: string;
  drafts: AdditionalChargeDraftRow[];
  setDrafts: Dispatch<SetStateAction<AdditionalChargeDraftRow[]>>;
  quotationCombined: QuotationCombinedTotals;
}) {
  const acCombined = quotationCombined;

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div>
        <h3 className="text-sm font-semibold">Additional charges (optional)</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Up to two (e.g. packing &amp; forwarding, transportation). Tax can also be applied to each charge amount.
        </p>
      </div>
      {drafts.map((row, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[200px]">
              <span className="text-[var(--muted)]">Charge type</span>
              <select
                className={field}
                value={
                  row.labelPreset === ADDITIONAL_CHARGE_LABEL_OTHER
                    ? ADDITIONAL_CHARGE_LABEL_OTHER
                    : row.labelPreset
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setDrafts((prev) =>
                    prev.map((r, j) => {
                      if (j !== idx) return r;
                      if (v === ADDITIONAL_CHARGE_LABEL_OTHER) {
                        return {
                          ...r,
                          labelPreset: ADDITIONAL_CHARGE_LABEL_OTHER,
                          labelCustom: "",
                        };
                      }
                      return { ...r, labelPreset: v, labelCustom: "" };
                    }),
                  );
                }}
              >
                {ADDITIONAL_CHARGE_LABEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value={ADDITIONAL_CHARGE_LABEL_OTHER}>Other…</option>
              </select>
              {row.labelPreset === ADDITIONAL_CHARGE_LABEL_OTHER ? (
                <input
                  className={field + " mt-1 text-xs"}
                  value={row.labelCustom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrafts((prev) =>
                      prev.map((r, j) =>
                        j === idx ? { ...r, labelPreset: ADDITIONAL_CHARGE_LABEL_OTHER, labelCustom: v } : r,
                      ),
                    );
                  }}
                  placeholder="Custom charge description"
                  aria-label="Custom charge description"
                />
              ) : null}
            </div>
            <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-32">
              <span className="text-[var(--muted)]">Amount</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={field + " tabular-nums"}
                value={row.amountDraft}
                onChange={(e) => {
                  const next = sanitizeDecimalInput(e.target.value, UNIT_PRICE_DECIMAL_PLACES);
                  setDrafts((prev) =>
                    prev.map((r, j) => (j === idx ? { ...r, amountDraft: next } : r)),
                  );
                }}
                onBlur={() => {
                  setDrafts((prev) =>
                    prev.map((r, j) => {
                      if (j !== idx) return r;
                      const t = r.amountDraft.trim();
                      if (t === "" || t === ".") return { ...r, amountDraft: "" };
                      const p = parseUnitPriceDraftToNumber(r.amountDraft);
                      return p !== null ? { ...r, amountDraft: formatUnitPriceDraftFromNumber(p) } : r;
                    }),
                  );
                }}
                placeholder="0"
              />
            </label>
            <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-28">
              <span className="text-[var(--muted)]">Tax %</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={field + " tabular-nums"}
                value={row.taxDraft}
                onChange={(e) => {
                  const next = sanitizeTaxPercentInput(e.target.value);
                  setDrafts((prev) =>
                    prev.map((r, j) => (j === idx ? { ...r, taxDraft: next } : r)),
                  );
                }}
                onBlur={() => {
                  setDrafts((prev) =>
                    prev.map((r, j) => {
                      if (j !== idx) return r;
                      const t = r.taxDraft.trim();
                      if (t === "" || t === ".") return { ...r, taxDraft: "0" };
                      const p = parseTaxDraftToNumber(r.taxDraft);
                      return p !== null ? { ...r, taxDraft: formatTaxDraftFromNumber(p) } : r;
                    }),
                  );
                }}
                placeholder="0"
              />
            </label>
            <button
              type="button"
              className="shrink-0 text-xs text-red-600 hover:underline"
              onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== idx))}
            >
              Remove
            </button>
          </div>
      ))}
      {drafts.length < 2 ? (
        <button
          type="button"
          className="text-sm text-sky-600 hover:underline"
          onClick={() =>
            setDrafts((prev) =>
              [
                ...prev,
                {
                  labelPreset: ADDITIONAL_CHARGE_LABEL_OPTIONS[0],
                  labelCustom: "",
                  amountDraft: "",
                  taxDraft: "0",
                },
              ].slice(0, 2),
            )
          }
        >
          + Add charge
        </button>
      ) : null}
      <div className="ml-auto w-full max-w-md space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Line items total</span>
          <span className="tabular-nums font-medium">
            {formatMoney(acCombined.lines.grand_total, currency)}
          </span>
        </div>
        {acCombined.additional_charges.length > 0 ? (
          <ul className="space-y-1 border-t border-[var(--border)] pt-2 text-[var(--muted)]">
            {acCombined.additional_charges.map((c, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2 text-[var(--foreground)]">
                <span className="min-w-0 truncate">{c.label || "Charge"}</span>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums">+{formatMoney(c.line_total, currency)}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {formatMoney(c.amount, currency)} + {c.tax_percent}% tax
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2 text-base font-semibold">
          <span>Grand total</span>
          <span className="tabular-nums">{formatMoney(acCombined.final_grand_total, currency)}</span>
        </div>
      </div>
    </div>
  );
}

export const QuotationAdditionalChargesSection = memo(QuotationAdditionalChargesSectionInner);
