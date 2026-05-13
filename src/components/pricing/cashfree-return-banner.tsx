"use client";

/**
 * Polls subscription status after Cashfree redirect or Razorpay Checkout redirect (same `subscriptions` rows).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCashfreeOrderReturnStatus } from "@/app/(main)/settings/pricing/actions";
import { replacePricingPageHistoryEntry } from "@/lib/pricing/checkout-history";
import { formatIsoDateMedium, planTierDisplayName } from "@/lib/pricing/display";

type PollState =
  | { phase: "polling" }
  | { phase: "paid"; targetLabel: string; until: string | null }
  | { phase: "failed" }
  | { phase: "user_dropped" }
  | { phase: "error"; message: string };

const terminal: Set<string> = new Set(["failed", "cancelled", "expired", "user_dropped"]);

export function CashfreeReturnBanner({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<PollState>({ phase: "polling" });
  const clearedQuery = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 28;
    const intervalMs = 1200;

    const tick = async () => {
      const res = await getCashfreeOrderReturnStatus(orderId);
      if (cancelled) return;

      if (!res.ok) {
        setState({ phase: "error", message: res.message });
        return;
      }

      if (res.status === "paid") {
        setState({
          phase: "paid",
          targetLabel: planTierDisplayName(res.targetPlan),
          until: formatIsoDateMedium(res.planPeriodEnd),
        });
        router.refresh();
        if (!clearedQuery.current && typeof window !== "undefined") {
          clearedQuery.current = true;
          replacePricingPageHistoryEntry();
        }
        return;
      }

      if (terminal.has(res.status)) {
        if (res.status === "user_dropped") setState({ phase: "user_dropped" });
        else setState({ phase: "failed" });
        if (!clearedQuery.current && typeof window !== "undefined") {
          clearedQuery.current = true;
          replacePricingPageHistoryEntry();
        }
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        replacePricingPageHistoryEntry();
        setState({
          phase: "error",
          message:
            "We could not confirm this payment yet. If money was debited, wait a minute and refresh this page, or contact support with your order reference.",
        });
        return;
      }

      window.setTimeout(tick, intervalMs);
    };

    void tick();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  if (state.phase === "polling") {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p className="font-medium text-amber-950 dark:text-amber-100">Confirming your payment…</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This usually takes a few seconds. Your plan updates automatically once the payment is verified.
        </p>
      </div>
    );
  }

  if (state.phase === "paid") {
    return (
      <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p className="font-medium text-emerald-950 dark:text-emerald-100">Payment successful</p>
        <p className="mt-1 text-[var(--foreground)]">
          You&apos;re now on the <strong>{state.targetLabel}</strong> plan
          {state.until ? (
            <>
              , valid through <strong>{state.until}</strong>
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  if (state.phase === "failed") {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p className="font-medium text-red-900 dark:text-red-100">Payment did not complete</p>
        <p className="mt-1 text-xs text-[var(--muted)]">You can try checkout again from the buttons below.</p>
      </div>
    );
  }

  if (state.phase === "user_dropped") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)]">
        <p className="font-medium">Checkout closed</p>
        <p className="mt-1 text-xs text-[var(--muted)]">No charge was finalized. You can start checkout again when ready.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
      <p className="font-medium text-red-900 dark:text-red-100">Could not confirm order</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{state.message}</p>
    </div>
  );
}
