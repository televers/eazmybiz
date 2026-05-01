"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issueQuotation } from "../actions";
import { errorMessage } from "@/lib/errors";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function IssueQuotationButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await issueQuotation(id);
      if (!res.ok) {
        setError(
          res.error === "terms required"
            ? "Add payment term and delivery / incoterm before issuing."
            : res.error === "delivery_period required"
              ? "Add delivery period before issuing."
              : res.error === "valid_until required"
                ? "Set quotation valid until date before issuing."
                : res.error === "quota exceeded"
                  ? "Monthly document quota reached."
                  : res.error ?? "Could not issue",
        );
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not issue"));
    } finally {
      setLoading(false);
    }
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
