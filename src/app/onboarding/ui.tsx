"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IsoCountrySelect } from "@/components/iso-country-select";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("bootstrap_organization", {
      p_name: name.trim(),
      p_country_code: countryCode.trim().toUpperCase() || "IN",
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!data) {
      setError("Could not create organization");
      return;
    }
    router.replace("/settings/company?onboarding=1");
    router.refresh();
  }

  const field =
    "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm w-full";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">
          Enter Company / Firm Name to create an organization on eazmybiz platform
        </span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
          placeholder="e.g. Acme Industries"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Country / region</span>
        <IsoCountrySelect
          value={countryCode}
          onChange={setCountryCode}
          required
          className={field}
          aria-describedby="onboarding-country-hint"
        />
        <span id="onboarding-country-hint" className="text-xs leading-relaxed text-[var(--muted)]">
          Used for tax and document defaults (you can adjust the full profile next).
        </span>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className={primaryButtonMd}
      >
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
