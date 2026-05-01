"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PartyAddressLabelSize } from "@/lib/parties/address-label-print";
import { linesFromPartySnapshot } from "@/lib/parties/address-label-print";
import {
  billingAddressOptionLabel,
  shippingAddressSlotLabel,
} from "@/lib/parties/address-option-labels";
import type { PartySnapshot } from "@/lib/packing/types";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export type ShipToOption = { slot: number; snapshot: PartySnapshot };

function printStyleBlock(size: PartyAddressLabelSize): string {
  const page =
    size === "a4"
      ? "size: A4 portrait; margin: 12mm;"
      : size === "a5"
        ? "size: A5 portrait; margin: 10mm;"
        : "size: 100mm 150mm; margin: 2mm;";

  const thermalBreak =
    size === "thermal" ? ".label-block--ship-to { page-break-after: always; }" : "";

  const font =
    size === "thermal"
      ? `.label-root { font-size: 11pt; } .label-title { font-size: 13pt; } .label-line { font-size: 11pt; }`
      : size === "a5"
        ? `.label-root { font-size: 16pt; } .label-title { font-size: 20pt; } .label-line { font-size: 16pt; }`
        : `.label-root { font-size: 18pt; } .label-title { font-size: 24pt; } .label-line { font-size: 18pt; }`;

  const sheetLayout =
    size === "thermal"
      ? `.label-sheet { min-height: 100vh; display: flex; flex-direction: column; } .label-block { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4mm; box-sizing: border-box; }`
      : `.label-sheet { min-height: 100vh; display: flex; flex-direction: column; } .label-block { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8mm; box-sizing: border-box; }`;

  return `
    @media print {
      @page { ${page} }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      ${thermalBreak}
    }
    ${sheetLayout}
    ${font}
    .label-title { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.75em; }
    .label-line { line-height: 1.35; max-width: 28ch; }
    .label-powered-in-block { margin-top: auto; padding-top: 0.75em; font-size: 0.65em; font-weight: 500; opacity: 0.85; }
    .label-powered-bottom { flex: 0 0 auto; text-align: center; padding: 6mm 8mm 4mm; font-size: 10pt; opacity: 0.75; }
  `;
}

function AddressBlock({
  title,
  lines,
  className,
  poweredByInBlock,
}: {
  title: string;
  lines: string[];
  className: string;
  poweredByInBlock?: string | null;
}) {
  return (
    <section className={`label-block ${className}`}>
      <h2 className="label-title">{title}</h2>
      {lines.length ? (
        <div className="flex flex-col items-center gap-1">
          {lines.map((line, i) => (
            <p key={i} className="label-line">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="label-line text-[var(--muted)]">No address lines yet.</p>
      )}
      {poweredByInBlock ? <p className="label-powered-in-block">{poweredByInBlock}</p> : null}
    </section>
  );
}

export function PartyAddressLabelsPrint({
  partyId,
  partyDisplayName,
  billTo,
  shippedFromLines,
  shipOptions,
  poweredBy,
}: {
  partyId: string;
  partyDisplayName: string;
  billTo: PartySnapshot;
  shippedFromLines: string[];
  shipOptions: ShipToOption[];
  poweredBy: string | null;
}) {
  const [size, setSize] = useState<PartyAddressLabelSize>("a4");
  /** `billing` or ship slot as string `"1"`..`"3"`. */
  const [shipTarget, setShipTarget] = useState<string>("billing");

  const shipToLines = useMemo(() => {
    if (shipTarget === "billing") return linesFromPartySnapshot(billTo);
    const slot = Number(shipTarget);
    if (!Number.isFinite(slot)) return linesFromPartySnapshot(billTo);
    const opt = shipOptions.find((s) => s.slot === slot);
    if (!opt) return linesFromPartySnapshot(billTo);
    return linesFromPartySnapshot(opt.snapshot);
  }, [shipTarget, billTo, shipOptions]);

  const css = useMemo(() => printStyleBlock(size), [size]);

  return (
    <div className="label-root min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="print:hidden border-b border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/parties/${partyId}`} className="text-sm text-sky-600 underline">
              ← {partyDisplayName}
            </Link>
          </div>
          <h1 className="text-lg font-semibold">Address labels for packages</h1>
          <p className="text-sm text-[var(--muted)]">
            Preview below matches print. Choose which address appears as Ship To on the label, paper size, then
            print (Ctrl+P).
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Address on label (Ship To)</span>
              <select
                value={shipTarget}
                onChange={(e) => setShipTarget(e.target.value)}
                className="min-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="billing">{billingAddressOptionLabel(billTo)}</option>
                {shipOptions.map((s) => (
                  <option key={s.slot} value={String(s.slot)}>
                    {shippingAddressSlotLabel(s.slot, s.snapshot)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Paper / printer</span>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as PartyAddressLabelSize)}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="a4">A4 portrait (default)</option>
                <option value="a5">A5 portrait</option>
                <option value="thermal">Thermal label (100×150 mm, two pages)</option>
              </select>
            </label>
          </div>
          {shipOptions.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No saved shipping addresses yet — use billing on the label or add shipping under Edit party.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className={`w-fit ${primaryButtonMd}`}
          >
            Print
          </button>
        </div>
      </div>

      <div className="label-sheet mx-auto max-w-4xl border border-dashed border-[var(--border)] print:max-w-none print:border-0">
        <AddressBlock
          title="Ship To"
          lines={shipToLines}
          className="label-block--ship-to"
          poweredByInBlock={size === "thermal" ? poweredBy : null}
        />
        <AddressBlock
          title="Shipped From"
          lines={shippedFromLines}
          className="label-block--shipped-from"
          poweredByInBlock={size === "thermal" ? poweredBy : null}
        />
        {poweredBy && size !== "thermal" ? (
          <p className="label-powered-bottom text-[var(--muted)]">{poweredBy}</p>
        ) : null}
      </div>
    </div>
  );
}
