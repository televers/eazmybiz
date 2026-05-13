"use client";

import { useTransition } from "react";
import { getInrCheckoutQuote, createCashfreeSubscriptionOrder } from "@/app/(main)/settings/pricing/actions";
import { replacePricingPageHistoryEntry } from "@/lib/pricing/checkout-history";
import { formatInr, formatInrPaise, planTierDisplayName, PRICING_INR } from "@/lib/pricing/display";
import { primaryButtonMd } from "@/lib/ui/primary-button";

type CashfreeGlobal = (opts: { mode: "sandbox" | "production" }) => {
  checkout: (opts: { paymentSessionId: string; returnUrl?: string }) => void | Promise<void>;
};

declare global {
  interface Window {
    Cashfree?: CashfreeGlobal;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCashfreeJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Cashfree) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cashfree-sdk="1"]');
    if (existing) {
      if (window.Cashfree) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Cashfree script failed to load")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.async = true;
    s.dataset.cashfreeSdk = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Cashfree checkout"));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  targetPlan: "pro" | "max";
  variant?: "primary" | "secondary";
  children: React.ReactNode;
};

export function CashfreeInrCheckoutButton({ targetPlan, variant = "primary", children }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const quote = await getInrCheckoutQuote(targetPlan);
          if (!quote.ok) {
            window.alert(quote.message);
            return;
          }
          const label = planTierDisplayName(quote.targetPlan);
          const catalogInr =
            quote.targetPlan === "pro" ? PRICING_INR.pro.sale : PRICING_INR.max.sale;
          const proRataLines = quote.proRata
              ? [
                  "",
                  `Pro → Max upgrade: ${quote.proRata.daysRemainingIst} day(s) left on your Pro period (IST).`,
                  `Unused Pro value (pre-tax): ${formatInrPaise(quote.proRata.unusedProCreditPreTaxInr)} applied as credit.`,
                  `Pre-tax amount after credit: ${formatInrPaise(quote.proRata.payablePreTaxInr)}.`,
                  "After payment, your Max subscription runs for one year from upgrade.",
                ]
              : [];
          const confirmText = [
            `You are paying for: ${label} (1 year from upgrade).`,
            `Amount (INR): ${formatInr(catalogInr)} (annual sale price before GST)`,
            `Pre-tax amount for checkout: ${formatInrPaise(quote.subtotalInr)}`,
            `18% Indian GST: ${formatInrPaise(quote.gstInr)}`,
            `Total charged: ${formatInrPaise(quote.totalInr)}`,
            ...proRataLines,
            "",
            "You will be redirected to Cashfree to complete payment. Continue?",
          ].join("\n");
          if (!window.confirm(confirmText)) {
            return;
          }

          const res = await createCashfreeSubscriptionOrder(targetPlan);
          if (!res.ok) {
            window.alert(res.message);
            return;
          }
          try {
            await loadCashfreeJs();
          } catch (e) {
            window.alert(e instanceof Error ? e.message : "Could not load payment checkout");
            return;
          }
          const Cashfree = window.Cashfree;
          if (!Cashfree) {
            window.alert("Payment checkout is unavailable. Please try again.");
            return;
          }
          const returnUrl = `${window.location.origin}/settings/pricing?cf_order_id={order_id}`;
          const checkout = Cashfree({ mode: res.cashfreeMode });
          /** One canonical pricing entry before redirect — reduces duplicated history when returning from Cashfree. */
          replacePricingPageHistoryEntry();
          await Promise.resolve(
            checkout.checkout({ paymentSessionId: res.paymentSessionId, returnUrl }),
          );
        });
      }}
      disabled={pending}
      className={
        variant === "primary"
          ? primaryButtonMd + " disabled:opacity-60"
          : "rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] enabled:hover:bg-[var(--muted)]/10 disabled:opacity-60"
      }
    >
      {pending ? "Opening checkout…" : children}
    </button>
  );
}
