"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { updatePartyAddressContacts } from "@/app/(main)/parties/actions";
import type { PartySnapshot } from "@/lib/packing/types";
import { shippingAddressCardTitle } from "@/lib/parties/address-option-labels";
import type { PartyListRow } from "@/lib/parties/load-parties";
import { partyBillFromList, partyShipFromList } from "@/lib/parties/party-from-list";
import { errorMessage } from "@/lib/errors";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import { normalizeIndianGstinInput } from "@/lib/tax/gstin-india";
import { AddressLocalityFields } from "@/components/address/address-locality-fields";

export type { PartyListRow };
export { partyBillFromList, partyShipFromList };

function normContact(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function contactsDiffer(
  a: { contact_name: string; mobile: string },
  b: { contact_name: string; mobile: string },
): boolean {
  return normContact(a.contact_name) !== normContact(b.contact_name) || normContact(a.mobile) !== normContact(b.mobile);
}

/** Same sizing as Load party — content-width `<select>` so inline hints/checkboxes stay on one row. */
export const loadPartySelectClassName =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm max-w-[220px] w-auto min-w-[9rem] shrink-0 disabled:cursor-not-allowed disabled:opacity-60";

export function PartyFields({
  title,
  value,
  onChange,
  parties,
  onPickParty,
  pickTarget,
  shipSlotIndex = 0,
  lockAddressFields = false,
  partyAddressRowId = null,
  addressLockVersion = 0,
  /** When this block was filled via Load party, the party id shown in the dropdown (not "—"). */
  selectedLoadPartyId = null,
  /** When true, Load party is read-only (e.g. issued document). */
  partyPickerDisabled = false,
  /** When set and address is locked, replaces the default “loaded from party” note (e.g. issued quotation). */
  addressLockHint = null,
  /** Billing: searchable party name field + pick to load; hides Load party select. */
  partyNameCombobox = false,
  /** Hide the Load party row (e.g. ship-to is chosen from saved slots in the parent). */
  hideLoadPartyPicker = false,
  /** Omit outer card (border/padding); parent supplies the bordered panel. */
  embedded = false,
  /** After picking a saved party, call when the user edits the billing name so the link can clear without wiping fields. */
  onReleasePartyLink,
  /** ISO country for mobile ISD default & dropdown (company profile). */
  organizationCountryCode = "IN",
  /** Subscription billing country — shown first in mobile ISD Suggested when set. */
  billingCountryCode,
}: {
  /** Omit to hide the section heading (e.g. nested ship forms). */
  title?: string;
  value: PartySnapshot;
  onChange: (p: PartySnapshot) => void;
  parties: PartyListRow[];
  /** Pass `null` when the user chooses "—" or clears a loaded party. */
  onPickParty: (partyId: string | null) => void;
  pickTarget: "bill" | "ship";
  /** When loading ship, which saved ship slot (0 = first / slot 1). */
  shipSlotIndex?: 0 | 1 | 2;
  /** When true, name / address / GSTIN are read-only; contact & mobile stay editable with intent prompt. */
  lockAddressFields?: boolean;
  /** `party_addresses.id` for persisting contact updates to the party master. */
  partyAddressRowId?: string | null;
  /** Increment when the user loads this block from a saved party so contact baseline resets. */
  addressLockVersion?: number;
  selectedLoadPartyId?: string | null;
  partyPickerDisabled?: boolean;
  addressLockHint?: string | null;
  partyNameCombobox?: boolean;
  hideLoadPartyPicker?: boolean;
  embedded?: boolean;
  onReleasePartyLink?: () => void;
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  const field =
    "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";
  const fieldReadOnly = field + " cursor-not-allowed bg-[var(--muted)]/10 opacity-90";

  const masterContactRef = useRef({ contact_name: "", mobile: "" });
  const lastResolvedRef = useRef<{ contact_name: string; mobile: string } | null>(null);
  const contactRegionRef = useRef<HTMLDivElement>(null);

  const [contactIntentOpen, setContactIntentOpen] = useState(false);
  const [contactPersistError, setContactPersistError] = useState<string | null>(null);
  const [contactPersistLoading, setContactPersistLoading] = useState(false);
  const [partyListOpen, setPartyListOpen] = useState(false);
  const partyPickListId = useId();
  const partyComboRef = useRef<HTMLDivElement>(null);

  const selectPartyValue = selectedLoadPartyId ?? "";

  const showNameCombobox =
    partyNameCombobox && pickTarget === "bill" && !partyPickerDisabled && !lockAddressFields;

  const filteredPartyPickList = useMemo(() => {
    if (!showNameCombobox || !parties.length) return [];
    const q = value.name.trim().toLowerCase();
    const base = q
      ? parties.filter(
          (p) =>
            p.display_name.toLowerCase().includes(q) || p.bill_to.name.toLowerCase().includes(q),
        )
      : parties.slice(0, 15);
    return base.slice(0, 12);
  }, [showNameCombobox, parties, value.name]);

  useEffect(() => {
    if (!showNameCombobox) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!partyComboRef.current?.contains(e.target as Node)) setPartyListOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [showNameCombobox]);

  function onBillingNameChange(nextName: string) {
    onChange({ ...value, name: nextName });
    if (onReleasePartyLink && selectPartyValue && pickTarget === "bill") {
      const row = parties.find((p) => p.id === selectPartyValue);
      if (row) {
        const loadedName = row.bill_to.name.trim() || row.display_name.trim();
        if (nextName.trim() !== loadedName) onReleasePartyLink();
      }
    }
  }

  useEffect(() => {
    if (!lockAddressFields) {
      masterContactRef.current = { contact_name: "", mobile: "" };
      lastResolvedRef.current = null;
      return;
    }
    masterContactRef.current = {
      contact_name: value.contact_name ?? "",
      mobile: value.mobile ?? "",
    };
    lastResolvedRef.current = null;
    // Baseline contact is tied to partyAddressRowId / lock version only — not every value.contact_* edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid resetting master while user edits contact
  }, [lockAddressFields, partyAddressRowId, addressLockVersion]);

  function checkContactIntentAfterLeavingRegion() {
    window.requestAnimationFrame(() => {
      const el = contactRegionRef.current;
      if (el && el.contains(document.activeElement)) return;
      if (!lockAddressFields) return;

      const master = masterContactRef.current;
      const cur = { contact_name: value.contact_name ?? "", mobile: value.mobile ?? "" };
      if (!contactsDiffer(cur, master)) {
        lastResolvedRef.current = null;
        return;
      }
      const lr = lastResolvedRef.current;
      if (lr && !contactsDiffer(cur, lr)) return;

      setContactPersistError(null);
      setContactIntentOpen(true);
    });
  }

  function onContactRegionBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!lockAddressFields) return;
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    checkContactIntentAfterLeavingRegion();
  }

  async function onPersistContactToParty() {
    if (!partyAddressRowId) return;
    setContactPersistError(null);
    setContactPersistLoading(true);
    try {
      await updatePartyAddressContacts(partyAddressRowId, value.contact_name ?? "", value.mobile ?? "");
      masterContactRef.current = {
        contact_name: value.contact_name ?? "",
        mobile: value.mobile ?? "",
      };
      lastResolvedRef.current = null;
      setContactIntentOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setContactPersistError(errorMessage(err, "Could not update party"));
    } finally {
      setContactPersistLoading(false);
    }
  }

  function onDocumentOnlyContact() {
    lastResolvedRef.current = {
      contact_name: value.contact_name ?? "",
      mobile: value.mobile ?? "",
    };
    setContactIntentOpen(false);
  }

  function onRevertContact() {
    const m = masterContactRef.current;
    onChange({ ...value, contact_name: m.contact_name ?? "", mobile: m.mobile ?? "" });
    lastResolvedRef.current = null;
    setContactIntentOpen(false);
  }

  const shellCls = embedded
    ? "space-y-2"
    : "space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4";

  return (
    <>
      <div className={shellCls}>
        {title || (parties.length && !hideLoadPartyPicker) ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {title ? <h3 className="text-sm font-semibold">{title}</h3> : <span />}
            {parties.length && !hideLoadPartyPicker ? (
              <label
                className={
                  "flex items-center gap-x-2 text-xs text-[var(--muted)] " +
                  (pickTarget === "ship" ? "min-w-0 flex-wrap gap-y-1" : "min-w-0 flex-nowrap")
                }
              >
                <span className="shrink-0">Load party</span>
                <select
                  className={loadPartySelectClassName}
                  value={selectPartyValue}
                  disabled={partyPickerDisabled}
                  onChange={(e) => {
                    if (partyPickerDisabled) return;
                    const v = e.target.value;
                    if (v === "") {
                      onPickParty(null);
                      return;
                    }
                    onPickParty(v);
                  }}
                >
                  <option value="">—</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {pickTarget === "ship" && selectPartyValue === p.id && lockAddressFields
                        ? `${p.display_name} · ${shippingAddressCardTitle(shipSlotIndex + 1)}`
                        : p.display_name}
                    </option>
                  ))}
                </select>
                {lockAddressFields && pickTarget === "bill" && !addressLockHint ? (
                  <span className="min-w-0 text-[11px] leading-snug">
                    Choose &quot;—&quot; to reset party and address
                    {partyPickerDisabled ? " Party cannot be changed on issued documents." : ""}
                  </span>
                ) : null}
                {pickTarget === "ship" ? (
                  <span className="text-[11px]">
                    Uses {shippingAddressCardTitle(shipSlotIndex + 1)}
                    {shipSlotIndex > 0 ? " (add on Parties if empty)" : ""}
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>
        ) : null}
        {lockAddressFields && addressLockHint ? (
          <p className="text-[11px] leading-snug text-[var(--muted)]">{addressLockHint}</p>
        ) : null}
        {showNameCombobox ? (
          <div ref={partyComboRef} className="relative">
            <input
              className={field}
              placeholder="Type to search saved party or enter a new name"
              value={value.name}
              autoComplete="off"
              role="combobox"
              aria-expanded={partyListOpen}
              aria-controls={partyListOpen && filteredPartyPickList.length > 0 ? partyPickListId : undefined}
              aria-autocomplete="list"
              onFocus={() => setPartyListOpen(true)}
              onChange={(e) => {
                onBillingNameChange(e.target.value);
                setPartyListOpen(true);
              }}
            />
            {partyListOpen && filteredPartyPickList.length > 0 ? (
              <ul
                className="absolute z-30 mt-0.5 max-h-52 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
                id={partyPickListId}
                role="listbox"
              >
                {filteredPartyPickList.map((p) => (
                  <li key={p.id} role="option" aria-selected={selectPartyValue === p.id}>
                    <button
                      type="button"
                      className="w-full px-2 py-2 text-left text-sm hover:bg-[var(--border)]"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        onPickParty(p.id);
                        setPartyListOpen(false);
                      }}
                    >
                      <span className="font-medium text-[var(--foreground)]">{p.display_name}</span>
                      {p.bill_to.name.trim() && p.bill_to.name.trim() !== p.display_name.trim() ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{p.bill_to.name}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <input
            className={lockAddressFields ? fieldReadOnly : field}
            placeholder="Name"
            value={value.name}
            readOnly={lockAddressFields}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        )}
        <input
          className={lockAddressFields ? fieldReadOnly : field}
          placeholder="Address line 1"
          value={value.address_line1}
          readOnly={lockAddressFields}
          onChange={(e) => onChange({ ...value, address_line1: e.target.value })}
        />
        <input
          className={lockAddressFields ? fieldReadOnly : field}
          placeholder="Address line 2"
          value={value.address_line2}
          readOnly={lockAddressFields}
          onChange={(e) => onChange({ ...value, address_line2: e.target.value })}
        />
        <AddressLocalityFields
          city={value.city ?? ""}
          state={value.state ?? ""}
          pin={value.pin ?? ""}
          countryIso={value.country ?? ""}
          disabled={lockAddressFields}
          onChange={(patch) => onChange({ ...value, ...patch })}
          billingCountryCode={billingCountryCode}
          organizationCountryCode={organizationCountryCode}
          inputClassName={lockAddressFields ? fieldReadOnly : field}
          pinHelpId={`party-postal-${pickTarget}`}
        />
        <input
          className={lockAddressFields ? fieldReadOnly : field}
          placeholder="GSTIN"
          value={value.gstin}
          readOnly={lockAddressFields}
          onChange={(e) => onChange({ ...value, gstin: normalizeIndianGstinInput(e.target.value) })}
        />
        <div ref={contactRegionRef} className="grid gap-2 sm:grid-cols-2" onBlur={onContactRegionBlur}>
          <input
            className={field}
            placeholder="Contact person"
            value={value.contact_name ?? ""}
            onChange={(e) => onChange({ ...value, contact_name: e.target.value })}
          />
          <div className="sm:col-span-2">
            <IntlMobileField
              value={value.mobile ?? ""}
              onChange={(v) => onChange({ ...value, mobile: v })}
              disabled={false}
              organizationCountryIso={organizationCountryCode}
              billingCountryIso={billingCountryCode}
            />
          </div>
        </div>
      </div>

      {contactIntentOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-intent-title"
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
            <h3 id="contact-intent-title" className="text-sm font-semibold text-[var(--foreground)]">
              Save contact change?
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              These contact details differ from the saved party. Is this a one-time change for this document only, or do
              you want to update the party? Already issued documents keep the contact details they were issued with.
            </p>
            {contactPersistError ? <p className="mt-2 text-sm text-red-600">{contactPersistError}</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={contactPersistLoading}
                onClick={onDocumentOnlyContact}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)] disabled:opacity-50"
              >
                One-time for this document
              </button>
              {partyAddressRowId ? (
                <button
                  type="button"
                  disabled={contactPersistLoading}
                  onClick={() => void onPersistContactToParty()}
                  className={primaryButtonMd}
                >
                  {contactPersistLoading ? "Updating…" : "Update party (future documents)"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={contactPersistLoading}
                onClick={onRevertContact}
                className="text-sm text-[var(--muted)] underline hover:text-[var(--foreground)] disabled:opacity-50"
              >
                Revert to saved party contact
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
