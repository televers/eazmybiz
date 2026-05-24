"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { issuePurchaseOrder } from "../actions";
import { errorMessage } from "@/lib/errors";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function IssuePurchaseOrderButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await issuePurchaseOrder(id);
      if (!res.ok) {
        setError(
          res.error === "terms required"
            ? "Add payment term and delivery / incoterm before issuing."
            : res.error === "delivery_period required"
              ? "Add delivery period before issuing."
              : res.error === "valid_until required"
                ? "Set purchase order delivery by date before issuing."
                : res.error === "vendor required"
                  ? "Add vendor details before issuing."
                  : res.error === "bill_to required"
                    ? "Add bill to details before issuing."
                    : res.error === "ship_to required"
                      ? "Add ship to details before issuing."
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
