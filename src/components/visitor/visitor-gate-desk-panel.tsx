"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateVisitorCheckInSupplement, visitorCheckIn } from "@/lib/visitors/actions";
import { VisitorPhotoField } from "@/components/visitor/visitor-photo-field";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";

const input =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-full max-w-md";

export function VisitorGateDeskPanel({
  visitId,
  initialVehicleReg,
  initialDriverName,
  photoUrl,
  photoHint,
}: {
  visitId: string;
  initialVehicleReg: string | null;
  initialDriverName: string | null;
  photoUrl: string | null;
  photoHint: string | null;
}) {
  const router = useRouter();
  const [vehicleReg, setVehicleReg] = useState(initialVehicleReg ?? "");
  const [driverName, setDriverName] = useState(initialDriverName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  function openPrintAfterCheckIn() {
    window.open(`/visitors/${visitId}/print?fromCheckin=1`, "visitor-pass-print", "noopener,noreferrer");
  }

  async function onSaveGateDetails() {
    setError(null);
    setSaveLoading(true);
    try {
      await updateVisitorCheckInSupplement(visitId, { vehicleReg, driverName });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaveLoading(false);
    }
  }

  async function onCheckInAndPrint() {
    setError(null);
    setCheckInLoading(true);
    try {
      await updateVisitorCheckInSupplement(visitId, { vehicleReg, driverName });
      const res = await visitorCheckIn(visitId);
      if (!res.ok) {
        setError(
          res.error === "quota exceeded"
            ? "Monthly visitor pass quota reached."
            : (res.error ?? "Could not check in"),
        );
        return;
      }
      openPrintAfterCheckIn();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not check in";
      if (msg.includes("not allowed to check in visitors")) {
        setError("Only visitor-desk staff can check visitors in.");
      } else {
        setError(msg);
      }
    } finally {
      setCheckInLoading(false);
    }
  }

  const busy = saveLoading || checkInLoading;

  return (
    <div className="mt-3 flex max-w-lg flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Vehicle no. (optional)</span>
        <input
          value={vehicleReg}
          onChange={(e) => setVehicleReg(e.target.value)}
          className={input}
          placeholder="e.g. KA01AB1234"
          autoCapitalize="characters"
          disabled={busy}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Driver (optional)</span>
        <input
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          className={input}
          disabled={busy}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSaveGateDetails}
          className={`w-fit ${secondarySkyButtonMd}`}
        >
          {saveLoading ? "Saving…" : "Save gate details"}
        </button>
      </div>
      <div className="mt-2">
        <VisitorPhotoField
          visitorId={visitId}
          photoUrl={photoUrl}
          canEdit
          hint={photoHint}
        />
      </div>
      <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={onCheckInAndPrint}
          className={`w-fit ${primaryButtonMd}`}
        >
          {checkInLoading ? "Checking in…" : "Check-in & Print Pass"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
