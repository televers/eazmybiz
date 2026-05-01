"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issueVisitorPass, updateDraftVisitor } from "@/lib/visitors/actions";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";

const input =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm w-full max-w-md";

export type VisitorDraftSnapshot = {
  visit_date: string;
  visitor_name: string;
  visitor_mobile: string;
  visitor_company: string | null;
  purpose: string | null;
  host_name: string;
  vehicle_reg: string | null;
  driver_name: string | null;
};

export function VisitorDraftForm({
  visitId,
  initial,
  minVisitDateYmd,
  maxVisitDateYmd,
  calendarTzLabel,
  organizationCountryCode,
  billingCountryCode,
  /** Issued pass for a future visit day: save only, no Issue control. */
  formMode = "draft",
}: {
  visitId: string;
  initial: VisitorDraftSnapshot;
  minVisitDateYmd: string;
  maxVisitDateYmd: string;
  calendarTzLabel: string;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
  formMode?: "draft" | "issued_before_visit";
}) {
  const router = useRouter();
  const [visitDate, setVisitDate] = useState(initial.visit_date.slice(0, 10));
  const [visitorName, setVisitorName] = useState(initial.visitor_name);
  const [visitorMobile, setVisitorMobile] = useState(initial.visitor_mobile);
  const [visitorCompany, setVisitorCompany] = useState(initial.visitor_company ?? "");
  const [purpose, setPurpose] = useState(initial.purpose ?? "");
  const [hostName, setHostName] = useState(initial.host_name);
  const [vehicleReg, setVehicleReg] = useState(initial.vehicle_reg ?? "");
  const [driverName, setDriverName] = useState(initial.driver_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateDraftVisitor(visitId, {
        visitDate,
        visitorName,
        visitorCompany,
        purpose,
        hostName,
        visitorMobile,
        vehicleReg,
        driverName,
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function onIssuePass() {
    setError(null);
    setIssueError(null);
    setIssueLoading(true);
    try {
      await updateDraftVisitor(visitId, {
        visitDate,
        visitorName,
        visitorCompany,
        purpose,
        hostName,
        visitorMobile,
        vehicleReg,
        driverName,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
      setIssueLoading(false);
      return;
    }
    try {
      const res = await issueVisitorPass(visitId);
      if (!res.ok) {
        setIssueError(
          res.error === "quota exceeded"
            ? "Monthly visitor pass quota reached."
            : (res.error ?? "Could not issue pass"),
        );
        return;
      }
      router.replace("/visitors");
      router.refresh();
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : "Could not issue pass");
    } finally {
      setIssueLoading(false);
    }
  }

  const isDraftForm = formMode === "draft";

  return (
    <form onSubmit={onSubmit} className="mt-4 flex max-w-lg flex-col gap-3 border-t border-[var(--border)] pt-4">
      <p className="text-sm font-medium text-[var(--foreground)]">
        {isDraftForm ? "Edit draft" : "Edit pass (visit day not started)"}
      </p>
      {!isDraftForm ? (
        <p className="text-xs text-[var(--muted)]">
          Check-in and check-out follow the usual rules when the visit date arrives.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Visit date *</span>
        <input
          required
          type="date"
          min={minVisitDateYmd.slice(0, 10)}
          max={maxVisitDateYmd.slice(0, 10)}
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          className={input}
        />
        <span className="text-[11px] text-[var(--muted)]">
          Organization calendar ({calendarTzLabel}): today or a future date — past dates are not allowed.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Visitor name *</span>
        <input required value={visitorName} onChange={(e) => setVisitorName(e.target.value)} className={input} />
      </label>
      <div className="flex max-w-md flex-col gap-1 text-sm">
        <span className="font-medium">Visitor mobile *</span>
        <IntlMobileField
          required
          value={visitorMobile}
          onChange={setVisitorMobile}
          organizationCountryIso={organizationCountryCode}
          billingCountryIso={billingCountryCode}
          className="max-w-md"
        />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Company (optional)</span>
        <input value={visitorCompany} onChange={(e) => setVisitorCompany(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Purpose (optional)</span>
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Host *</span>
        <input required value={hostName} onChange={(e) => setHostName(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Vehicle no. (optional)</span>
        <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Driver (optional)</span>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={input} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {issueError ? <p className="text-sm text-red-600">{issueError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={loading || issueLoading}
          className={`w-fit ${secondarySkyButtonMd}`}
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
        {isDraftForm ? (
          <button
            type="button"
            disabled={loading || issueLoading}
            onClick={onIssuePass}
            className={`w-fit ${primaryButtonMd}`}
          >
            {issueLoading ? "Saving & issuing…" : "Issue pass"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
