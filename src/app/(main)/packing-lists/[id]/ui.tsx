"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issuePackingList } from "../actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function IssuePackingListButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setError(null);
    setLoading(true);
    const res = await issuePackingList(id);
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "quota exceeded" ? "Monthly document quota reached." : res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={primaryButtonMd}
      >
        {loading ? "Issuing…" : "Issue"}
      </button>
      {error ? <p className="max-w-xs text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
