"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IsoCountrySelect } from "@/components/iso-country-select";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";

type Props = {
  city: string;
  state: string;
  pin: string;
  /** ISO 3166-1 alpha-2 stored in `PartySnapshot.country` (or org communication country). */
  countryIso: string;
  onChange: (patch: { city?: string; state?: string; pin?: string; country?: string }) => void;
  disabled?: boolean;
  billingCountryCode?: string | null;
  organizationCountryCode?: string;
  inputClassName: string;
  /** Shown under PIN while lookup runs / after miss. */
  pinHelpId?: string;
};

const DEBOUNCE_MS = 480;

async function fetchPostalLookup(country: string, postal: string, signal: AbortSignal): Promise<{
  city: string;
  state: string;
} | null> {
  const q = new URLSearchParams({ country, postal });
  const res = await fetch(`/api/postal-lookup?${q}`, { signal, credentials: "same-origin" });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; city?: string; state?: string };
  if (!data.ok || !data.city || !data.state) return null;
  return { city: data.city, state: data.state };
}

/**
 * Country (ISO) → PIN/ZIP → City & state with debounced autofill where supported.
 */
export function AddressLocalityFields({
  city,
  state,
  pin,
  countryIso,
  onChange,
  disabled = false,
  billingCountryCode,
  organizationCountryCode = "IN",
  inputClassName,
  pinHelpId = "address-pin-lookup-hint",
}: Props) {
  const cc = coerceToLibphonenumberCountry(countryIso || organizationCountryCode);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "hit" | "miss">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastAutofillRef = useRef<{ pin: string; city: string; state: string } | null>(null);

  const runLookup = useCallback(
    (postal: string, country: string) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;
      setLookupStatus("loading");
      void fetchPostalLookup(country, postal, signal)
        .then((r) => {
          if (signal.aborted) return;
          if (r) {
            lastAutofillRef.current = { pin: postal.trim(), city: r.city, state: r.state };
            onChange({ city: r.city, state: r.state });
            setLookupStatus("hit");
          } else {
            lastAutofillRef.current = null;
            setLookupStatus("miss");
          }
        })
        .catch(() => {
          if (!signal.aborted) setLookupStatus("idle");
        });
    },
    [onChange],
  );

  useEffect(() => {
    if (disabled) return;
    const trimmed = pin.trim();
    if (!trimmed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setLookupStatus("idle");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const last = lastAutofillRef.current;
      if (last && last.pin === trimmed && city === last.city && state === last.state) {
        setLookupStatus("hit");
        return;
      }
      runLookup(trimmed, cc);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pin, cc, disabled, runLookup, city, state]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const pinHint =
    lookupStatus === "loading"
      ? "Looking up locality…"
      : lookupStatus === "hit"
        ? "City and state filled from postal code — you can edit if needed."
        : lookupStatus === "miss"
          ? "No automatic match for this postal code. Enter city and state manually."
          : "Enter PIN / ZIP to fill city and state when available for the selected country.";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[10px] font-medium text-[var(--muted)]">Country</span>
        <IsoCountrySelect
          value={countryIso}
          onChange={(iso) => {
            lastAutofillRef.current = null;
            onChange({ country: iso });
            setLookupStatus("idle");
          }}
          billingCountryCode={billingCountryCode}
          organizationCountryCode={organizationCountryCode}
          disabled={disabled}
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[10px] font-medium text-[var(--muted)]">PIN / ZIP</span>
        <input
          className={inputClassName}
          value={pin}
          readOnly={disabled}
          onChange={(e) => {
            lastAutofillRef.current = null;
            onChange({ pin: e.target.value });
          }}
          autoComplete="postal-code"
          aria-describedby={pinHelpId}
        />
        <span id={pinHelpId} className="text-[10px] text-[var(--muted)]">
          {pinHint}
        </span>
      </label>
      <input
        className={disabled ? inputClassName + " cursor-not-allowed bg-[var(--muted)]/10 opacity-90" : inputClassName}
        placeholder="City"
        value={city}
        readOnly={disabled}
        onChange={(e) => {
          lastAutofillRef.current = null;
          onChange({ city: e.target.value });
        }}
        autoComplete="address-level2"
      />
      <input
        className={disabled ? inputClassName + " cursor-not-allowed bg-[var(--muted)]/10 opacity-90" : inputClassName}
        placeholder="State / province"
        value={state}
        readOnly={disabled}
        onChange={(e) => {
          lastAutofillRef.current = null;
          onChange({ state: e.target.value });
        }}
        autoComplete="address-level1"
      />
    </div>
  );
}
