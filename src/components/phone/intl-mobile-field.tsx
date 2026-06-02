"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { buildIsdCountrySelectOptions } from "@/lib/phone/isd-select-options";
import {
  PHONE_ISD_CUSTOM,
  e164PartsForIntlMobileField,
  inferIsoFromDefaultIsd,
  defaultPhoneIsdFromCountryCode,
  validateNationalForIsd,
  combineToE164,
  digitsOnly,
  normalizeCustomIsdInput,
} from "@/lib/phone/intl-mobile";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-full";

function normalizedDefaultIsd(defaultIsd: string): string {
  return (defaultIsd.startsWith("+") ? defaultIsd : `+${digitsOnly(defaultIsd)}`) || "+91";
}

export function IntlMobileField({
  id,
  value,
  onChange,
  disabled,
  required,
  /** Preferred: company / document ISO country → default calling code & dropdown order. */
  organizationCountryIso,
  /** Subscription billing country — listed first in Suggested when set. */
  billingCountryIso,
  /** Legacy: used only if `organizationCountryIso` is omitted. */
  defaultIsd = "+91",
  className = "",
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  required?: boolean;
  organizationCountryIso?: string | null;
  billingCountryIso?: string | null;
  defaultIsd?: string;
  className?: string;
  "aria-describedby"?: string;
}) {
  const orgIso = useMemo(() => {
    if (organizationCountryIso != null && String(organizationCountryIso).trim() !== "") {
      return coerceToLibphonenumberCountry(organizationCountryIso);
    }
    return inferIsoFromDefaultIsd(normalizedDefaultIsd(defaultIsd));
  }, [organizationCountryIso, defaultIsd]);

  const defIsd = useMemo(() => defaultPhoneIsdFromCountryCode(orgIso), [orgIso]);

  const { suggested, rest } = useMemo(
    () => buildIsdCountrySelectOptions(orgIso, billingCountryIso),
    [orgIso, billingCountryIso],
  );

  const [selectValue, setSelectValue] = useState<string>(orgIso);
  const [customIsd, setCustomIsd] = useState("");
  const [national, setNational] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const prevValueRef = useRef<string | undefined>(undefined);
  const prevOrgIsoRef = useRef<string | undefined>(undefined);

  function resolvedIsd(): string {
    if (selectValue === PHONE_ISD_CUSTOM) {
      const c = normalizeCustomIsdInput(customIsd);
      return c || defIsd;
    }
    try {
      return `+${getCountryCallingCode(selectValue as CountryCode)}`;
    } catch {
      return defIsd;
    }
  }

  const applyFromStored = useCallback((stored: string) => {
    const parts = e164PartsForIntlMobileField(stored, orgIso);
    if (parts.kind === "country") {
      setSelectValue(parts.iso);
      setCustomIsd("");
      setNational(parts.national);
      setLocalError(parts.national ? validateNationalForIsd(parts.isd, parts.national) : null);
    } else {
      setSelectValue(PHONE_ISD_CUSTOM);
      setCustomIsd(parts.customDigits);
      setNational(parts.national);
      setLocalError(parts.national ? validateNationalForIsd(parts.isd, parts.national) : null);
    }
  }, [orgIso]);

  useEffect(() => {
    const valueChanged = prevValueRef.current !== value;
    const orgChanged = prevOrgIsoRef.current !== orgIso;
    if (!valueChanged && !orgChanged) return;
    prevValueRef.current = value;
    prevOrgIsoRef.current = orgIso;
    applyFromStored(value);
  }, [value, orgIso, applyFromStored]);

  function emit(nextSelect: string, nextNational: string, customDigits: string) {
    const isd =
      nextSelect === PHONE_ISD_CUSTOM
        ? normalizeCustomIsdInput(customDigits) || defIsd
        : `+${getCountryCallingCode(nextSelect as CountryCode)}`;
    const n = digitsOnly(nextNational);
    if (!n) {
      onChange("");
      setLocalError(null);
      return;
    }
    const err = validateNationalForIsd(isd, n);
    setLocalError(err);
    if (!err) onChange(combineToE164(isd, n));
    else onChange("");
  }

  const ri = resolvedIsd();

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start gap-2">
        <select
          id={id ? `${id}-isd` : undefined}
          disabled={disabled}
          className={`${field} min-w-[min(100%,18rem)] max-w-xl shrink-0 flex-1 sm:flex-none`}
          aria-describedby={ariaDescribedBy}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            setSelectValue(v);
            emit(v, national, customIsd);
          }}
        >
          {suggested.length > 0 ? (
            <optgroup label="Suggested">
              {suggested.map((o) => (
                <option key={o.iso} value={o.iso}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="All countries (A–Z)">
            {rest.map((o) => (
              <option key={o.iso} value={o.iso}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <option value={PHONE_ISD_CUSTOM}>Other calling code…</option>
        </select>
        {selectValue === PHONE_ISD_CUSTOM ? (
          <input
            className={`${field} w-28 shrink-0`}
            disabled={disabled}
            placeholder="e.g. 352"
            value={customIsd}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCustomIsd(v);
              emit(PHONE_ISD_CUSTOM, national, v);
            }}
            aria-label="Country calling code (digits only, without +)"
          />
        ) : null}
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required={required}
          disabled={disabled}
          className={`${field} min-w-[8rem] flex-1 basis-[10rem]`}
          placeholder={ri === "+91" ? "10-digit mobile" : "National number"}
          value={national}
          onChange={(e) => {
            const v = digitsOnly(e.target.value);
            setNational(v);
            const isd = resolvedIsd();
            if (!v) {
              onChange("");
              setLocalError(null);
              return;
            }
            const err = validateNationalForIsd(isd, v);
            setLocalError(err);
            if (!err) onChange(combineToE164(isd, v));
            else onChange("");
          }}
          onBlur={() => emit(selectValue, national, customIsd)}
        />
      </div>
      {localError ? <p className="mt-1 text-[11px] text-red-600">{localError}</p> : null}
    </div>
  );
}
