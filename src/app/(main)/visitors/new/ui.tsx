"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVisitorVisit, uploadVisitorPhoto } from "@/lib/visitors/actions";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import { primaryButtonMd } from "@/lib/ui/primary-button";

const input =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm w-full max-w-md";
const fileClass =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm file:mr-3 file:rounded file:border file:border-[var(--border)] file:bg-[var(--card)] file:px-2 file:py-1 file:text-xs w-full max-w-md";

export function NewVisitorForm({
  defaultVisitDate,
  minVisitDateYmd,
  maxVisitDateYmd,
  calendarTzLabel,
  organizationCountryCode,
  billingCountryCode,
}: {
  defaultVisitDate: string;
  minVisitDateYmd: string;
  maxVisitDateYmd: string;
  calendarTzLabel: string;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  const [visitDate, setVisitDate] = useState(defaultVisitDate.slice(0, 10));
  const [visitorName, setVisitorName] = useState("");
  const [visitorMobile, setVisitorMobile] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [purpose, setPurpose] = useState("");
  const [hostName, setHostName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [driverName, setDriverName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const id = await createVisitorVisit({
        visitDate,
        visitorName,
        visitorCompany,
        purpose,
        hostName,
        visitorMobile,
        vehicleReg,
        driverName,
      });
      if (photoFile) {
        const fd = new FormData();
        fd.append("photo", photoFile);
        await uploadVisitorPhoto(id, fd);
      }
      router.replace(`/visitors/${id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--foreground)] font-medium">Visit date *</span>
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
        <span className="text-[var(--foreground)] font-medium">Visitor name *</span>
        <input
          required
          value={visitorName}
          onChange={(e) => setVisitorName(e.target.value)}
          className={input}
        />
      </label>
      <div className="flex max-w-md flex-col gap-1 text-sm">
        <span className="text-[var(--foreground)] font-medium">Visitor mobile *</span>
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
        <span className="text-[var(--foreground)] font-medium">Host *</span>
        <input
          required
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="Person the visitor is meeting"
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Vehicle no. (optional)</span>
        <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Driver (optional)</span>
        <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Visitor photo (optional)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className={fileClass}
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-[11px] text-[var(--muted)]">Camera or gallery · max 2MB</span>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className={`w-fit ${primaryButtonMd}`}
      >
        {loading ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}
