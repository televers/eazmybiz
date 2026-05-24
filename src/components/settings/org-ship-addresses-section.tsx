"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { OrgShipAddressRow } from "@/lib/org-ship-addresses/load";
import type { PartySnapshot } from "@/lib/packing/types";
import { emptyParty } from "@/lib/packing/types";
import { PartyAddressPreview } from "@/components/purchase-order/party-address-preview";
import { AddressLocalityFields } from "@/components/address/address-locality-fields";
import { normalizeIndianGstinInput } from "@/lib/tax/gstin-india";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { deleteOrgShipAddress, saveOrgShipAddress } from "@/lib/org-ship-addresses/actions";
import { primaryButtonCompact } from "@/lib/ui/primary-button";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";

function slotTitle(slot: number, label: string | null): string {
  if (label?.trim()) return label.trim();
  return savedCountLabel(slot);
}

function savedCountLabel(slot: number): string {
  return slot === 1 ? "Shipping address" : `Shipping address ${slot}`;
}

function AddressForm({
  slot,
  label,
  value,
  organizationCountryCode,
  billingCountryCode,
  onLabelChange,
  onPatch,
  onSave,
  onCancel,
  onDelete,
  loading,
  error,
  showDelete,
  saveLabel = "Save",
}: {
  slot: number;
  label: string;
  value: PartySnapshot;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
  onLabelChange: (v: string) => void;
  onPatch: (p: Partial<PartySnapshot>) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  loading: boolean;
  error: string | null;
  showDelete?: boolean;
  saveLabel?: string;
}) {
  const countryIso = coerceToLibphonenumberCountry(value.country || organizationCountryCode);

  return (
    <div className="grid gap-1.5">
      <input
        className={field}
        placeholder="Short label (optional), e.g. Main warehouse"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
      />
      <input
        className={field}
        placeholder="Company / site name"
        value={value.name}
        onChange={(e) => onPatch({ name: e.target.value })}
      />
      <input
        className={field}
        placeholder="Address line 1"
        value={value.address_line1}
        onChange={(e) => onPatch({ address_line1: e.target.value })}
      />
      <input
        className={field}
        placeholder="Address line 2 (optional)"
        value={value.address_line2}
        onChange={(e) => onPatch({ address_line2: e.target.value })}
      />
      <AddressLocalityFields
        city={value.city ?? ""}
        state={value.state ?? ""}
        pin={value.pin ?? ""}
        countryIso={countryIso}
        onChange={onPatch}
        billingCountryCode={billingCountryCode}
        organizationCountryCode={organizationCountryCode}
        inputClassName={field}
        pinHelpId={`org-ship-postal-${slot}`}
      />
      <input
        className={field}
        placeholder="GSTIN"
        value={value.gstin}
        onChange={(e) => onPatch({ gstin: normalizeIndianGstinInput(e.target.value) })}
      />
      <div className="flex flex-wrap gap-2 pt-0.5">
        <button type="button" disabled={loading} onClick={onSave} className={primaryButtonCompact}>
          {loading ? "Saving…" : saveLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]"
          >
            Cancel
          </button>
        ) : null}
        {showDelete && onDelete ? (
          <button
            type="button"
            disabled={loading}
            onClick={onDelete}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function SavedAddressCard({
  row,
  organizationCountryCode,
  billingCountryCode,
}: {
  row: OrgShipAddressRow;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(row.label ?? "");
  const [value, setValue] = useState<PartySnapshot>(row.snapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<PartySnapshot>) => {
    const next = { ...value, ...p };
    if (p.country != null) {
      next.country = coerceToLibphonenumberCountry(p.country || organizationCountryCode);
    }
    setValue(next);
  };

  async function onSave() {
    setError(null);
    setLoading(true);
    try {
      await saveOrgShipAddress({ ship_slot: row.ship_slot, label, snapshot: value });
      setEditing(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Remove ${slotTitle(row.ship_slot, row.label)}?`)) return;
    setError(null);
    setLoading(true);
    try {
      await deleteOrgShipAddress(row.ship_slot);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {slotTitle(row.ship_slot, row.label)}
        </span>
        {!editing ? (
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-medium text-sky-600 hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <AddressForm
          slot={row.ship_slot}
          label={label}
          value={value}
          organizationCountryCode={organizationCountryCode}
          billingCountryCode={billingCountryCode}
          onLabelChange={setLabel}
          onPatch={patch}
          onSave={() => void onSave()}
          onCancel={() => {
            setLabel(row.label ?? "");
            setValue(row.snapshot);
            setEditing(false);
            setError(null);
          }}
          loading={loading}
          error={error}
        />
      ) : (
        <PartyAddressPreview party={row.snapshot} />
      )}
    </div>
  );
}

function AddAddressForm({
  slot,
  organizationCountryCode,
  billingCountryCode,
  onDone,
}: {
  slot: number;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState<PartySnapshot>(() => emptyParty(organizationCountryCode));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<PartySnapshot>) => {
    const next = { ...value, ...p };
    if (p.country != null) {
      next.country = coerceToLibphonenumberCountry(p.country || organizationCountryCode);
    }
    setValue(next);
  };

  async function onSave() {
    setError(null);
    setLoading(true);
    try {
      await saveOrgShipAddress({ ship_slot: slot, label, snapshot: value });
      onDone();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5 space-y-2">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {slot === 1 ? "New shipping address" : `New shipping address ${slot}`}
      </span>
      <AddressForm
        slot={slot}
        label={label}
        value={value}
        organizationCountryCode={organizationCountryCode}
        billingCountryCode={billingCountryCode}
        onLabelChange={setLabel}
        onPatch={patch}
        onSave={() => void onSave()}
        onCancel={onDone}
        loading={loading}
        error={error}
        saveLabel="Save address"
      />
    </div>
  );
}

export function OrgShipAddressesSection({
  slots,
  organizationCountryCode,
  billingCountryCode,
}: {
  slots: OrgShipAddressRow[];
  organizationCountryCode: string;
  billingCountryCode?: string | null;
}) {
  const saved = useMemo(
    () => [...slots].sort((a, b) => a.ship_slot - b.ship_slot),
    [slots],
  );
  const [addingSlot, setAddingSlot] = useState<number | null>(null);

  const nextSlot = useMemo(() => {
    const used = new Set(saved.map((s) => s.ship_slot));
    for (let s = 1; s <= 3; s++) {
      if (!used.has(s)) return s;
    }
    return null;
  }, [saved]);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Warehouse / shipping addresses</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Optional delivery or warehouse addresses for purchase order <strong>Ship to</strong>. You can save up to
          three.
        </p>
      </div>

      {saved.length > 0 ? (
        <div className="space-y-2">
          {saved.map((row) => (
            <SavedAddressCard
              key={row.id}
              row={row}
              organizationCountryCode={organizationCountryCode}
              billingCountryCode={billingCountryCode}
            />
          ))}
        </div>
      ) : null}

      {addingSlot !== null ? (
        <AddAddressForm
          slot={addingSlot}
          organizationCountryCode={organizationCountryCode}
          billingCountryCode={billingCountryCode}
          onDone={() => setAddingSlot(null)}
        />
      ) : null}

      {addingSlot === null && nextSlot !== null ? (
        saved.length === 0 ? (
          <button type="button" onClick={() => setAddingSlot(nextSlot)} className={primaryButtonCompact}>
            Add shipping address
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSlot(nextSlot)}
            className="text-sm font-medium text-sky-600 hover:underline"
          >
            + Add another address ({saved.length}/3)
          </button>
        )
      ) : null}
    </section>
  );
}
