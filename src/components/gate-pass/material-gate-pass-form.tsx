"use client";

import { useState } from "react";
import { primaryButtonCompact, primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";
import type { PartyListRow } from "@/lib/parties/load-parties";
import type { GatePassSavePayload } from "@/lib/gate-pass/save-payload";
import { validateMaterialGatePass } from "@/lib/gate-pass/validate";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import { GatePassPartyNameField } from "./party-name-field";

const input =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-full";
const labelMuted = "text-[11px] text-[var(--muted)]";

export type { GatePassSavePayload };

function toPayload(state: {
  direction: "in" | "out";
  documentDate: string;
  invoiceNo: string;
  partyId: string | null;
  partyName: string;
  transportName: string;
  lrDocketNo: string;
  handCarriedName: string;
  handCarriedMobile: string;
  vehicleNo: string;
  packageCount: string;
  mainItem: string;
  notes: string;
}): GatePassSavePayload {
  const pc = state.packageCount.trim();
  const n = pc === "" ? null : Number(pc);
  const packageCount =
    n != null && Number.isFinite(n) ? Math.floor(n) : null;
  return {
    direction: state.direction,
    documentDate: state.documentDate.trim().slice(0, 10),
    invoiceNo: state.invoiceNo.trim() || null,
    partyId: state.partyId,
    partyName: state.partyName.trim() || null,
    transportName: state.transportName.trim() || null,
    lrDocketNo: state.lrDocketNo.trim() || null,
    handCarriedName: state.handCarriedName.trim() || null,
    handCarriedMobile: state.handCarriedMobile.trim() || null,
    vehicleNo: state.vehicleNo.trim() || null,
    packageCount,
    mainItem: state.mainItem.trim() || null,
    notes: state.notes.trim() || null,
  };
}

export function MaterialGatePassForm({
  parties,
  disabled,
  defaultValues,
  minPassDateYmd,
  maxPassDateYmd,
  calendarTzLabel,
  onSave,
  onIssuePass,
  submitLabel,
  issuePassLabel = "Issue pass",
  organizationCountryCode = "IN",
  billingCountryCode,
}: {
  parties: PartyListRow[];
  /** Minimum pass date (YYYY-MM-DD, organization calendar “today”; no backdating). */
  minPassDateYmd: string;
  /** Maximum pass date (organization calendar; today + allowed future window in the picker). */
  maxPassDateYmd: string;
  /** Shown in help text (IANA zone or label). */
  calendarTzLabel: string;
  disabled?: boolean;
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
  defaultValues?: Partial<{
    direction: "in" | "out";
    documentDate: string;
    invoiceNo: string;
    partyId: string | null;
    partyName: string;
    transportName: string;
    lrDocketNo: string;
    handCarriedName: string;
    handCarriedMobile: string;
    vehicleNo: string;
    packageCount: string;
    mainItem: string;
    notes: string;
  }>;
  onSave: (payload: GatePassSavePayload) => Promise<void>;
  /** When set, shows a compact Issue control beside Save; must save draft then issue (caller implements). */
  onIssuePass?: (payload: GatePassSavePayload) => Promise<void>;
  submitLabel: string;
  issuePassLabel?: string;
}) {
  const [direction, setDirection] = useState<"in" | "out">(defaultValues?.direction ?? "out");
  const [documentDate, setDocumentDate] = useState(
    (defaultValues?.documentDate ?? minPassDateYmd).slice(0, 10),
  );
  const [invoiceNo, setInvoiceNo] = useState(defaultValues?.invoiceNo ?? "");
  const [partyId, setPartyId] = useState<string | null>(defaultValues?.partyId ?? null);
  const [partyName, setPartyName] = useState(defaultValues?.partyName ?? "");
  const [transportName, setTransportName] = useState(defaultValues?.transportName ?? "");
  const [lrDocketNo, setLrDocketNo] = useState(defaultValues?.lrDocketNo ?? "");
  const [handCarriedName, setHandCarriedName] = useState(defaultValues?.handCarriedName ?? "");
  const [handCarriedMobile, setHandCarriedMobile] = useState(
    defaultValues?.handCarriedMobile ?? "",
  );
  const [vehicleNo, setVehicleNo] = useState(defaultValues?.vehicleNo ?? "");
  const [packageCount, setPackageCount] = useState(defaultValues?.packageCount ?? "");
  const [mainItem, setMainItem] = useState(defaultValues?.mainItem ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);

  const passYmd = documentDate.trim().slice(0, 10);
  const orgTodayYmd = minPassDateYmd.slice(0, 10);
  /** Issue and gate movement only on or after pass date; picker min is org today. */
  const issueAllowedOnPassDate = passYmd <= orgTodayYmd;

  function buildPayload(): GatePassSavePayload {
    return toPayload({
      direction,
      documentDate,
      invoiceNo,
      partyId,
      partyName,
      transportName,
      lrDocketNo,
      handCarriedName,
      handCarriedMobile,
      vehicleNo,
      packageCount,
      mainItem,
      notes,
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = buildPayload();
      const v = validateMaterialGatePass(payload);
      if (v) {
        setError(v);
        return;
      }
      await onSave(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  async function handleIssuePass() {
    if (!onIssuePass) return;
    if (!issueAllowedOnPassDate) {
      setError(
        `Issue is only allowed on or after the pass date (${calendarTzLabel}). Save a draft and issue on that day, or change the pass date to today.`,
      );
      return;
    }
    setError(null);
    setIssueLoading(true);
    try {
      const payload = buildPayload();
      const v = validateMaterialGatePass(payload);
      if (v) {
        setError(v);
        return;
      }
      await onIssuePass(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not issue");
    } finally {
      setIssueLoading(false);
    }
  }

  const outActive = direction === "out";
  const inActive = direction === "in";
  const segOut = `flex-1 rounded-md py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
    outActive
      ? "bg-red-600 text-white shadow-sm ring-1 ring-red-700 dark:bg-red-600 dark:ring-red-500"
      : "text-[var(--muted)] hover:bg-red-500/15 hover:text-red-800 dark:hover:text-red-300"
  }`;
  const segIn = `flex-1 rounded-md py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
    inActive
      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700 dark:bg-emerald-600 dark:ring-emerald-500"
      : "text-[var(--muted)] hover:bg-emerald-500/15 hover:text-emerald-800 dark:hover:text-emerald-300"
  }`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5 text-sm">
        <div>
          <span className="text-xs font-medium text-[var(--muted)]">
            Material movement (inward / outward)
          </span>
          <div className="mt-1.5 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-1">
            <button
              type="button"
              disabled={disabled}
              className={segOut}
              onClick={() => setDirection("out")}
            >
              Out
            </button>
            <button
              type="button"
              disabled={disabled}
              className={segIn}
              onClick={() => setDirection("in")}
            >
              In
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">Pass date *</span>
          <input
            required
            type="date"
            min={minPassDateYmd.slice(0, 10)}
            max={maxPassDateYmd.slice(0, 10)}
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className={input}
            disabled={disabled}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">
            Invoice / delivery challan no. *
          </span>
          <input
            required
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className={input}
            disabled={disabled}
            placeholder="Invoice or DC number"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">Party</span>
          <span className={labelMuted}>Customer / vendor — pick from list or type</span>
          <GatePassPartyNameField
            parties={parties}
            partyId={partyId}
            partyName={partyName}
            disabled={disabled}
            onChange={(id, name) => {
              setPartyId(id);
              setPartyName(name);
            }}
          />
        </div>

        <p className={`${labelMuted} -mt-1`}>
          * One of <strong className="font-medium text-[var(--foreground)]">Courier / transport</strong> or{" "}
          <strong className="font-medium text-[var(--foreground)]">Hand-carried</strong> (name + mobile) is
          required.
        </p>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 p-3">
            <div className="text-xs font-semibold text-[var(--foreground)]">Courier / transport</div>
            <p className={`mt-0.5 ${labelMuted}`}>At least transporter name or LR/AWB (if not hand-carried).</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[var(--foreground)]">Name</span>
                <input
                  value={transportName}
                  onChange={(e) => setTransportName(e.target.value)}
                  className={input}
                  disabled={disabled}
                  placeholder="Transporter or courier"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[var(--foreground)]">LR / docket / AWB</span>
                <input
                  value={lrDocketNo}
                  onChange={(e) => setLrDocketNo(e.target.value)}
                  className={input}
                  disabled={disabled}
                  placeholder="Tracking or LR number"
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 p-3">
            <div className="text-xs font-semibold text-[var(--foreground)]">Hand-carried</div>
            <p className={`mt-0.5 ${labelMuted}`}>Name and mobile both required if using this instead of courier.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[var(--foreground)]">Name</span>
                <input
                  value={handCarriedName}
                  onChange={(e) => setHandCarriedName(e.target.value)}
                  className={input}
                  disabled={disabled}
                  placeholder="Full name"
                />
              </label>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[var(--foreground)]">Mobile</span>
                <IntlMobileField
                  value={handCarriedMobile}
                  onChange={setHandCarriedMobile}
                  disabled={disabled}
                  organizationCountryIso={organizationCountryCode}
                  billingCountryIso={billingCountryCode}
                />
              </div>
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">Vehicle no. (optional)</span>
          <span className={labelMuted}>Transporter/courier truck or hand-carried vehicle.</span>
          <input
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            className={input}
            disabled={disabled}
            placeholder="e.g. KA01AB1234"
            autoCapitalize="characters"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">Packages *</span>
          <input
            required
            type="number"
            min={1}
            step={1}
            value={packageCount}
            onChange={(e) => setPackageCount(e.target.value)}
            className={input}
            disabled={disabled}
            placeholder="At least 1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--foreground)]">Main item</span>
          <input
            value={mainItem}
            onChange={(e) => setMainItem(e.target.value)}
            className={input}
            disabled={disabled}
            placeholder="What is mainly in the shipment?"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--muted)]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={input}
            disabled={disabled}
            placeholder="Optional — anything security should know"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!disabled ? (
          onIssuePass ? (
            <div className="mt-1 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={loading || issueLoading}
                  className={secondarySkyButtonMd}
                >
                  {loading ? "Saving…" : submitLabel}
                </button>
                <button
                  type="button"
                  disabled={loading || issueLoading || !issueAllowedOnPassDate}
                  onClick={handleIssuePass}
                  className={primaryButtonCompact}
                >
                  {issueLoading ? "Issuing…" : issuePassLabel}
                </button>
              </div>
              {!issueAllowedOnPassDate ? (
                <p className={labelMuted}>
                  Issue is available on the pass date in your organization calendar ({calendarTzLabel}). You can still
                  save this draft now.
                </p>
              ) : null}
            </div>
          ) : (
            <button type="submit" disabled={loading} className={`${primaryButtonMd} mt-1 w-full sm:w-auto`}>
              {loading ? "Saving…" : submitLabel}
            </button>
          )
        ) : null}
      </form>
    </div>
  );
}
