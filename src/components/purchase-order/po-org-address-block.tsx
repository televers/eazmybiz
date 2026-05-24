"use client";

import { useState } from "react";
import type { PartySnapshot } from "@/lib/packing/types";
import { AddressLocalityFields } from "@/components/address/address-locality-fields";
import { normalizeIndianGstinInput } from "@/lib/tax/gstin-india";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import {
  PartyAddressPreview,
  partySnapshotHasAddressContent,
} from "@/components/purchase-order/party-address-preview";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";
const fieldReadOnly = field + " cursor-not-allowed bg-[var(--muted)]/10 opacity-90";

type Props = {
  title: string;
  loadDefaultLabel: string;
  value: PartySnapshot;
  onChange: (next: PartySnapshot) => void;
  defaultSnapshot: PartySnapshot;
  organizationCountryCode?: string | null;
  billingCountryCode?: string | null;
  readOnly?: boolean;
  /** When true, open with editable fields instead of compact preview. */
  initialExpanded?: boolean;
  /** Contact person + mobile on one row (e.g. custom ship-to on PO). */
  showContactFields?: boolean;
};

export function PoOrgAddressBlock({
  title,
  loadDefaultLabel,
  value,
  onChange,
  defaultSnapshot,
  organizationCountryCode = "IN",
  billingCountryCode,
  readOnly = false,
  initialExpanded = false,
  showContactFields = false,
}: Props) {
  const [compact, setCompact] = useState(
    () => !initialExpanded && partySnapshotHasAddressContent(value),
  );

  const loadDefault = () => {
    onChange(defaultSnapshot);
    setCompact(true);
  };

  const inputClass = readOnly ? fieldReadOnly : field;
  const patch = (p: Partial<PartySnapshot>) => {
    const next = { ...value, ...p };
    if (p.country != null) {
      next.country = coerceToLibphonenumberCountry(p.country || organizationCountryCode);
    }
    onChange(next);
  };

  const countryIso = coerceToLibphonenumberCountry(value.country || organizationCountryCode);

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>
        {!readOnly ? (
          <button
            type="button"
            onClick={loadDefault}
            className="text-xs font-medium text-sky-600 hover:underline"
          >
            {loadDefaultLabel}
          </button>
        ) : null}
      </div>

      {compact ? (
        <div className="space-y-2">
          <PartyAddressPreview party={value} />
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setCompact(false)}
              className="text-xs text-sky-600 hover:underline"
            >
              Edit address for this PO
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <input
            className={inputClass}
            placeholder="Company / legal name"
            value={value.name}
            readOnly={readOnly}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Address line 1"
            value={value.address_line1}
            readOnly={readOnly}
            onChange={(e) => patch({ address_line1: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Address line 2 (optional)"
            value={value.address_line2}
            readOnly={readOnly}
            onChange={(e) => patch({ address_line2: e.target.value })}
          />
          <AddressLocalityFields
            city={value.city ?? ""}
            state={value.state ?? ""}
            pin={value.pin ?? ""}
            countryIso={countryIso}
            disabled={readOnly}
            onChange={(p) => patch(p)}
            billingCountryCode={billingCountryCode}
            organizationCountryCode={organizationCountryCode ?? "IN"}
            inputClassName={inputClass}
            pinHelpId={`po-org-postal-${title.replace(/\s+/g, "-").toLowerCase()}`}
          />
          {showContactFields ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
              <input
                className={inputClass}
                placeholder="Contact person (optional)"
                value={value.contact_name ?? ""}
                readOnly={readOnly}
                onChange={(e) => patch({ contact_name: e.target.value })}
              />
              <IntlMobileField
                value={value.mobile ?? ""}
                onChange={(mobile) => patch({ mobile })}
                disabled={readOnly}
                organizationCountryIso={organizationCountryCode ?? "IN"}
                billingCountryIso={billingCountryCode}
              />
            </div>
          ) : null}
          <input
            className={inputClass}
            placeholder="GSTIN"
            value={value.gstin}
            readOnly={readOnly}
            onChange={(e) => patch({ gstin: normalizeIndianGstinInput(e.target.value) })}
          />
          {partySnapshotHasAddressContent(value) && !readOnly ? (
            <button
              type="button"
              onClick={() => setCompact(true)}
              className="w-fit text-xs text-sky-600 hover:underline"
            >
              Show compact view
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
