"use client";

import { useMemo } from "react";
import { buildIsoCountrySelectOptions } from "@/lib/geo/iso-country-select-options";

export function IsoCountrySelect({
  id,
  value,
  onChange,
  billingCountryCode,
  organizationCountryCode,
  disabled,
  required,
  className = "",
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (isoAlpha2: string) => void;
  /** Subscription billing country (from entitlement); shown first when valid. */
  billingCountryCode?: string | null;
  /** Company / workspace default ISO (e.g. org.country_code); second in Suggested when valid. */
  organizationCountryCode?: string | null;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-describedby"?: string;
}) {
  const { suggested, rest } = useMemo(
    () => buildIsoCountrySelectOptions(billingCountryCode, "en", organizationCountryCode),
    [billingCountryCode, organizationCountryCode],
  );

  const inList = useMemo(() => {
    const s = new Set<string>();
    for (const o of suggested) s.add(o.value);
    for (const o of rest) s.add(o.value);
    return s;
  }, [suggested, rest]);

  const normalizedValue = value.trim().toUpperCase();
  const orphanValue =
    normalizedValue && !inList.has(normalizedValue) ? normalizedValue : null;
  const selectValue = orphanValue ?? normalizedValue;

  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      className={className}
      aria-describedby={ariaDescribedBy}
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
    >
      {orphanValue ? (
        <option value={orphanValue}>
          {orphanValue} — choose a valid country below
        </option>
      ) : null}
      {suggested.length > 0 ? (
        <optgroup label="Suggested">
          {suggested.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="All countries (A–Z)">
        {rest.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
