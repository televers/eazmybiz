"use client";

import { useTransition } from "react";
import { createRazorpayUsdSubscriptionOrder, getUsdCheckoutQuote } from "@/app/(main)/settings/pricing/actions";
import { replacePricingPageHistoryEntry } from "@/lib/pricing/checkout-history";
import { formatUsd, planTierDisplayName, PRICING_USD } from "@/lib/pricing/display";
import { primaryButtonMd } from "@/lib/ui/primary-button";

/** Standard Checkout instance (success handler + optional failure events). */
type RazorpayHostedInstance = {
  open: () => void;
  on?: (event: string, handler: (payload: unknown) => void) => void;
};

type RazorpayConstructorOptions = {
  key: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayConstructorOptions) => RazorpayHostedInstance;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayCheckoutJs(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="1"]');
    if (existing) {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed to load")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.dataset.razorpayCheckout = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(s);
  });
  return razorpayScriptPromise;
}

type Props = {
  targetPlan: "pro" | "max";
  variant?: "primary" | "secondary";
  ownerEmail?: string | null;
  children: React.ReactNode;
};

export function RazorpayUsdCheckoutButton({ targetPlan, variant = "primary", ownerEmail, children }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const quote = await getUsdCheckoutQuote(targetPlan);
          if (!quote.ok) {
            window.alert(quote.message);
            return;
          }
          const label = planTierDisplayName(quote.targetPlan);
          const catalogUsd =
            quote.targetPlan === "pro" ? PRICING_USD.pro.sale : PRICING_USD.max.sale;
          const proRataLines = quote.proRata
            ? [
                "",
                `Pro → Max upgrade: ${quote.proRata.daysRemainingIst} day(s) left on your Pro period (IST calendar).`,
                `Unused Pro value applied as credit (USD): ${formatUsd(quote.proRata.unusedProCreditPreTaxUsd)}.`,
                `Payable amount after credit: ${formatUsd(quote.proRata.payablePreTaxUsd)}.`,
                "After payment, your Max subscription runs for one year from upgrade.",
              ]
            : [];

          const confirmText = [
            `You are paying for: ${label} (1 year).`,
            `Amount (USD): ${formatUsd(catalogUsd)}.`,
            ...proRataLines,
            "",
            "Pay with Razorpay (international cards). Continue?",
          ].join("\n");
          if (!window.confirm(confirmText)) {
            return;
          }

          const res = await createRazorpayUsdSubscriptionOrder(targetPlan);
          if (!res.ok) {
            window.alert(res.message);
            return;
          }
          try {
            await loadRazorpayCheckoutJs();
          } catch (e) {
            window.alert(e instanceof Error ? e.message : "Could not load payment checkout");
            return;
          }
          const RZ = window.Razorpay;
          if (!RZ) {
            window.alert("Payment checkout is unavailable. Please try again.");
            return;
          }

          const opts: RazorpayConstructorOptions = {
            key: res.razorpayKeyId,
            order_id: res.razorpayOrderId,
            name: "eazmybiz",
            description: `${label} — annual subscription`,
            prefill:
              ownerEmail?.trim()
                ? {
                    email: ownerEmail.trim(),
                  }
                : undefined,
            modal: {},
            handler(response) {
              void (async () => {
                try {
                  const vr = await fetch("/api/verify-payment", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  });
                  let data: { error?: string } = {};
                  try {
                    data = (await vr.json()) as { error?: string };
                  } catch {
                    /* ignore */
                  }
                  if (!vr.ok) {
                    window.alert(
                      typeof data.error === "string"
                        ? data.error
                        : "Could not verify payment. If you were charged, contact support.",
                    );
                    return;
                  }
                  window.location.replace(
                    `${window.location.origin}/settings/pricing?rz_order_id=${encodeURIComponent(response.razorpay_order_id)}`,
                  );
                } catch {
                  window.alert("Verification request failed. Check your connection or try again.");
                }
              })();
            },
          };

          try {
            /** Modal checkout does not push history by itself — keep pricing as single entry before Razorpay runs. */
            replacePricingPageHistoryEntry();
            const inst = new RZ(opts);
            inst.on?.("payment.failed", (payload: unknown) => {
              const p = payload as { error?: { description?: string; reason?: string } };
              window.alert(p?.error?.description ?? p?.error?.reason ?? "Payment failed.");
            });
            inst.open();
          } catch (e) {
            window.alert(e instanceof Error ? e.message : "Could not open checkout");
          }
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
