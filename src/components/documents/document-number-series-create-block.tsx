"use client";

import { useEffect, useState } from "react";
import { peekDocumentNumber } from "@/lib/documents/peek-document-number";
import type { DocumentNumberingCreateProps } from "@/lib/documents/document-numbering";

const field =
  "min-w-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full sm:max-w-[280px]";

export function DocumentNumberSeriesCreateBlock({
  numbering,
  documentDateYmd,
  seriesSlot,
  onSeriesSlotChange,
  existingDocumentNumber,
  committedSeriesSlot,
}: {
  numbering: DocumentNumberingCreateProps;
  documentDateYmd: string;
  seriesSlot: number;
  onSeriesSlotChange: (slot: number) => void;
  /** When editing a draft, show this number until the user changes numbering series. */
  existingDocumentNumber?: string | null;
  committedSeriesSlot?: number | null;
}) {
  const [peek, setPeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const existingTrimmed = existingDocumentNumber?.trim() ?? "";
  const showCommittedNumber =
    existingTrimmed.length > 0 &&
    (!numbering.multiSeriesEnabled || seriesSlot === committedSeriesSlot);

  useEffect(() => {
    if (showCommittedNumber) {
      setPeek(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const n = await peekDocumentNumber({
          docType: numbering.docType,
          referenceYmd: documentDateYmd,
          seriesSlot: numbering.multiSeriesEnabled ? seriesSlot : null,
        });
        if (!cancelled) setPeek(n);
      } catch {
        if (!cancelled) setPeek(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    numbering.docType,
    numbering.multiSeriesEnabled,
    documentDateYmd,
    seriesSlot,
    showCommittedNumber,
  ]);

  const slotOpts = Array.from({ length: numbering.maxSlots }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 gap-4 sm:flex sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Document no. (preview)</span>
        <div
          className={`${field} tabular-nums text-[var(--foreground)]`}
          aria-live="polite"
        >
          {showCommittedNumber
            ? existingTrimmed
            : loading
              ? "…"
              : peek && peek.length > 0
                ? peek
                : "—"}
        </div>
      </div>
      {numbering.multiSeriesEnabled ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Numbering series</span>
          <select
            className={field}
            value={seriesSlot}
            onChange={(e) => onSeriesSlotChange(Number(e.target.value))}
          >
            {slotOpts.map((n) => (
              <option key={n} value={n}>
                Series {n}
                {n === numbering.effectiveDefaultSlot ? " (default for this type)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
