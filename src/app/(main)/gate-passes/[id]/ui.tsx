"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { recordGatePassMaterialMovement } from "../actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function RecordMaterialMovementButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "in" | "out";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const label =
    direction === "in" ? "Record material received (inward)" : "Record material left premises (outward)";

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await recordGatePassMaterialMovement(id);
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "Could not record movement");
        return;
      }
      router.refresh();
    } catch (e) {
      setLoading(false);
      const msg = e instanceof Error ? e.message : "Could not record movement";
      if (msg.includes("not allowed to record material movement")) {
        setError("Only gate staff can record material movement.");
      } else if (msg.includes("material movement already recorded")) {
        setError("Movement was already recorded.");
      } else {
        setError(msg);
      }
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading || disabled}
        className={primaryButtonMd}
      >
        {loading ? "Recording…" : label}
      </button>
      {error ? (
        <p className="max-w-md text-left text-xs text-red-600 leading-snug">{error}</p>
      ) : null}
    </div>
  );
}
