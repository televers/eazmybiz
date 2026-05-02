"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issueDeliveryChallan } from "../actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function IssueDcButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setError(null);
    setLoading(true);
    const res = await issueDeliveryChallan(id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "quota exceeded" ? "Monthly document quota reached." : res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={primaryButtonMd + " min-h-11 w-full justify-center touch-manipulation sm:w-auto"}
      >
        {loading ? "Issuing…" : "Issue"}
      </button>
      {error ? (
        <p className="w-full max-w-xs text-center text-xs text-red-600 sm:text-right">{error}</p>
      ) : null}
    </div>
  );
}
