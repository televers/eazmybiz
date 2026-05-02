"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { resolvePartyShipAddressId } from "@/lib/parties/resolve-ship-address-id";
import type { PlanTier } from "@/types/database";
import {
  clampSeriesSlotValue,
  type DocumentNumberingCreateProps,
} from "@/lib/documents/document-numbering";
import { DocumentNumberSeriesCreateBlock } from "@/components/documents/document-number-series-create-block";
import {
  parsePackingListTemplateId,
  packingListTemplateOptionsForPlan,
} from "@/lib/packing/packing-list-templates";
import {
  PACKAGE_TYPE_SELECT_OTHER,
  STANDARD_PACKAGE_TYPES,
  canonicalStandardPackageType,
  packageTypeSelectValue,
} from "@/lib/packing/package-type";
import {
  emptyParty,
  emptyPackage,
  PACKING_SIZE_FIELD_LABEL,
  type PackingListTemplateId,
  type PackingPackage,
  type PartySnapshot,
} from "@/lib/packing/types";
import { createPackingList, updatePackingList } from "@/app/(main)/packing-lists/actions";
import {
  loadPartySelectClassName,
  PartyFields,
  partyBillFromList,
  partyShipFromList,
  type PartyListRow,
} from "@/components/packing/party-fields";
import { useSavePartyFlags } from "@/components/packing/save-party-section";
import { confirmPartyChange } from "@/lib/parties/confirm-party-change";
import { addressStructuralEqual } from "@/lib/parties/snapshot";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { ItemDescriptionWithSavedSuggest } from "@/components/items/item-description-saved-suggest";
import { savedItemDetailsSubtitle } from "@/lib/items/saved-item-subtitle";

export type { PartyListRow };
export type { SavedItemRow };

function normalizePackingPackagesForSave(pkgs: PackingPackage[]): PackingPackage[] {
  return pkgs.map((pkg) => {
    const lines = pkg.lines.map((line) =>
      line.item_preset_id ? { ...line, save_as_item: undefined } : line,
    );
    if (pkg.package_type_mode === "other") {
      return { ...pkg, lines };
    }
    const { package_type_mode, ...rest } = pkg;
    void package_type_mode;
    return { ...rest, lines };
  });
}

export function PackingListEditor({
  mode,
  packingListId,
  listStatus,
  documentDateMinYmd,
  documentDateMaxYmd,
  initial,
  parties,
  savedItems,
  plan,
  organizationCountryCode = "IN",
  billingCountryCode,
  numberingCreate,
  numberingDraft,
  initialNumberingSeriesSlot,
}: {
  mode: "create" | "edit";
  packingListId?: string;
  /** When editing, whether the list is still a draft or already issued. */
  listStatus?: "draft" | "issued";
  documentDateMinYmd: string;
  documentDateMaxYmd: string;
  organizationCountryCode?: string;
  /** Subscription billing country — country list suggestions + context for address fields. */
  billingCountryCode?: string | null;
  initial?: {
    template: string;
    invoice_no: string | null;
    document_date: string | null;
    bill_to: unknown;
    ship_to: unknown;
    packages: unknown;
    notes: string | null;
    party_id?: string | null;
  };
  parties: PartyListRow[];
  savedItems: SavedItemRow[];
  plan: PlanTier;
  numberingCreate?: DocumentNumberingCreateProps | null;
  numberingDraft?: DocumentNumberingCreateProps | null;
  initialNumberingSeriesSlot?: number;
}) {
  const router = useRouter();
  const restrictDocumentBackdate = listStatus !== "issued";

  const [template, setTemplate] = useState<PackingListTemplateId>(() =>
    parsePackingListTemplateId(initial?.template),
  );
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoice_no ?? "");
  const [documentDate, setDocumentDate] = useState(
    (initial?.document_date ?? documentDateMaxYmd).toString().slice(0, 10),
  );
  const numberingUi =
    numberingCreate ?? (mode === "edit" && listStatus === "draft" ? numberingDraft : null);
  const [seriesSlot, setSeriesSlot] = useState(() => {
    if (!numberingUi) return 1;
    if (mode === "edit" && listStatus === "draft" && initialNumberingSeriesSlot != null) {
      return clampSeriesSlotValue(initialNumberingSeriesSlot, numberingUi.maxSlots);
    }
    return numberingUi.effectiveDefaultSlot;
  });
  const [billTo, setBillTo] = useState<PartySnapshot>(() =>
    initial?.bill_to ? (initial.bill_to as PartySnapshot) : emptyParty(organizationCountryCode),
  );
  const [shipTo, setShipTo] = useState<PartySnapshot>(() =>
    initial?.ship_to ? (initial.ship_to as PartySnapshot) : emptyParty(organizationCountryCode),
  );
  const [packages, setPackages] = useState<PackingPackage[]>(() => {
    if (initial?.packages && Array.isArray(initial.packages) && initial.packages.length) {
      return initial.packages as PackingPackage[];
    }
    return [emptyPackage(1)];
  });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shipSlotLoad, setShipSlotLoad] = useState<0 | 1 | 2>(() => {
    const pid = initial?.party_id ?? null;
    const ship = initial?.ship_to as PartySnapshot | undefined;
    if (!pid || !ship) return 0;
    const row = parties.find((p) => p.id === pid);
    if (!row?.ship_tos.length) return 0;
    const sorted = [...row.ship_tos].sort((a, b) => a.slot - b.slot);
    const idx = sorted.findIndex((s) => addressStructuralEqual(s.snapshot, ship));
    return (idx >= 0 ? idx : 0) as 0 | 1 | 2;
  });
  const [linkedPartyId, setLinkedPartyId] = useState<string | null>(() => initial?.party_id ?? null);
  const [billLoadedFromParty, setBillLoadedFromParty] = useState(() => Boolean(initial?.party_id));
  const [shipLoadedFromParty, setShipLoadedFromParty] = useState(() => {
    const pid = initial?.party_id ?? null;
    const ship = initial?.ship_to as PartySnapshot | undefined;
    if (!pid || !ship) return false;
    const row = parties.find((p) => p.id === pid);
    if (!row?.ship_tos.length) return false;
    return row.ship_tos.some((s) => addressStructuralEqual(s.snapshot, ship));
  });
  const [shipSameAsBill, setShipSameAsBill] = useState(false);
  const [saveShipSnapshotToParty, setSaveShipSnapshotToParty] = useState(false);
  const [billAddressLockVersion, setBillAddressLockVersion] = useState(0);
  const [shipAddressLockVersion, setShipAddressLockVersion] = useState(0);
  const [savePartyFlags, savePartyUi] = useSavePartyFlags("bill_ship", billTo, shipTo, {
    partyLinkedId: linkedPartyId,
  });

  const linkedPartyRow = useMemo(
    () => (linkedPartyId ? parties.find((p) => p.id === linkedPartyId) : undefined),
    [parties, linkedPartyId],
  );
  const sortedShipTos = useMemo(
    () => (linkedPartyRow ? [...linkedPartyRow.ship_tos].sort((a, b) => a.slot - b.slot) : []),
    [linkedPartyRow],
  );

  const shipSameAsBillApplies =
    listStatus !== "issued" && (!linkedPartyId || sortedShipTos.length === 0);

  useEffect(() => {
    if (!shipSameAsBill || !shipSameAsBillApplies) return;
    setShipTo({ ...billTo });
  }, [billTo, shipSameAsBill, shipSameAsBillApplies]);

  function applyPickedPartyRow(row: PartyListRow) {
    setShipSameAsBill(false);
    setSaveShipSnapshotToParty(false);
    setBillTo(partyBillFromList(row));
    setLinkedPartyId(row.id);
    setBillLoadedFromParty(true);
    setBillAddressLockVersion((v) => v + 1);
    if (row.ship_tos.length > 0) {
      setShipSlotLoad(0);
      setShipTo(partyShipFromList(row, 0));
      setShipLoadedFromParty(true);
    } else {
      setShipSlotLoad(0);
      setShipTo(emptyParty(organizationCountryCode));
      setShipLoadedFromParty(false);
    }
    setShipAddressLockVersion((v) => v + 1);
  }

  function releaseBillPartyLink() {
    setLinkedPartyId(null);
    setBillLoadedFromParty(false);
    setShipLoadedFromParty(false);
    setSaveShipSnapshotToParty(false);
  }

  const shipSavedPickValue =
    linkedPartyId && shipLoadedFromParty ? String(shipSlotLoad as number) : "custom";

  const billPartyAddressId = useMemo(() => {
    if (!linkedPartyId) return null;
    if (!billLoadedFromParty && listStatus !== "issued") return null;
    return parties.find((p) => p.id === linkedPartyId)?.bill_address_id ?? null;
  }, [parties, linkedPartyId, billLoadedFromParty, listStatus]);

  const shipPartyAddressId = useMemo(() => {
    if (!linkedPartyId) return null;
    if (!shipLoadedFromParty && listStatus !== "issued") return null;
    const row = parties.find((p) => p.id === linkedPartyId);
    return resolvePartyShipAddressId(row, shipTo, shipSlotLoad);
  }, [parties, linkedPartyId, shipTo, shipSlotLoad, shipLoadedFromParty, listStatus]);

  const billLoadPartySelectId =
    linkedPartyId && (listStatus === "issued" || billLoadedFromParty) ? linkedPartyId : null;
  const shipLoadPartySelectId =
    linkedPartyId && (listStatus === "issued" || shipLoadedFromParty) ? linkedPartyId : null;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const partyPickerDisabled = listStatus === "issued";

  const canPickTemplate = plan !== "free";
  const templateOptions = useMemo(() => packingListTemplateOptionsForPlan(plan), [plan]);

  useEffect(() => {
    const allowed = templateOptions.map((o) => o.id);
    if (!allowed.includes(template)) setTemplate("basic");
  }, [template, templateOptions]);

  function updatePackage(i: number, patch: Partial<PackingPackage>) {
    setPackages((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function setPackageTypeSelect(pi: number, value: string) {
    setPackages((prev) =>
      prev.map((p, j) => {
        if (j !== pi) return p;
        if (value === "") {
          const { package_type_mode, ...rest } = p;
          void package_type_mode;
          return { ...rest, package_type: "" };
        }
        if (value === PACKAGE_TYPE_SELECT_OTHER) {
          const wasStandard = canonicalStandardPackageType(p.package_type) != null;
          return {
            ...p,
            package_type_mode: "other",
            package_type: wasStandard ? "" : p.package_type,
          };
        }
        const { package_type_mode, ...rest } = p;
        void package_type_mode;
        return { ...rest, package_type: value };
      }),
    );
  }

  function setPackageTypeOtherText(pi: number, text: string) {
    setPackages((prev) =>
      prev.map((p, j) => (j === pi ? { ...p, package_type: text, package_type_mode: "other" } : p)),
    );
  }

  function addPackage() {
    setPackages((prev) => [...prev, emptyPackage(prev.length + 1)]);
  }

  function removePackage(i: number) {
    setPackages((prev) => prev.filter((_, j) => j !== i).map((p, j) => ({ ...p, package_no: j + 1 })));
  }

  function updateLine(pi: number, li: number, patch: Partial<PackingPackage["lines"][0]>) {
    setPackages((prev) =>
      prev.map((p, j) => {
        if (j !== pi) return p;
        const lines = p.lines.map((line, k) => (k === li ? { ...line, ...patch } : line));
        return { ...p, lines };
      }),
    );
  }

  function addLine(pi: number) {
    setPackages((prev) =>
      prev.map((p, j) =>
        j === pi
          ? {
              ...p,
              lines: [
                ...p.lines,
                {
                  description: "",
                  unit: "Pcs",
                  qty: 1,
                  make_service_provider: "",
                  model_part_no_description: "",
                  hsn_sac: "",
                  save_as_item: true,
                },
              ],
            }
          : p,
      ),
    );
  }

  function removeLine(pi: number, li: number) {
    setPackages((prev) =>
      prev.map((p, j) => {
        if (j !== pi) return p;
        const lines = p.lines.filter((_, k) => k !== li);
        return {
          ...p,
          lines: lines.length
            ? lines
            : [
                {
                  description: "",
                  unit: "Pcs",
                  qty: 1,
                  make_service_provider: "",
                  model_part_no_description: "",
                  hsn_sac: "",
                  save_as_item: true,
                },
              ],
        };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const pkg of packages) {
      for (const line of pkg.lines) {
        if (!line.description?.trim()) {
          setError("Each line needs an item / product / service name.");
          return;
        }
        if (!line.unit?.trim()) {
          setError("Each line needs a unit.");
          return;
        }
      }
    }
    setLoading(true);
    try {
      if (
        listStatus !== "issued" &&
        (savePartyFlags.save_bill ||
          savePartyFlags.save_ship ||
          savePartyFlags.bill_and_ship_same)
      ) {
        if (!savePartyFlags.party_display_name.trim()) {
          setError("Enter a party name to save addresses.");
          setLoading(false);
          return;
        }
      }
      if (listStatus !== "issued" && saveShipSnapshotToParty) {
        if (!linkedPartyId) {
          setError("Choose a saved party on billing before saving this shipping address to the party.");
          setLoading(false);
          return;
        }
        if (shipLoadedFromParty) {
          setError('Use “Custom address” or “New shipping address” to save a new party ship-to.');
          setLoading(false);
          return;
        }
        if (sortedShipTos.length >= 3) {
          setError("This party already has three shipping addresses.");
          setLoading(false);
          return;
        }
        if (!shipTo.name.trim()) {
          setError("Enter a shipping address name before saving it to the party.");
          setLoading(false);
          return;
        }
      }
      const appendShip =
        listStatus !== "issued" &&
        saveShipSnapshotToParty &&
        Boolean(linkedPartyId) &&
        !shipLoadedFromParty &&
        sortedShipTos.length < 3;
      const payload = {
        template,
        invoice_no: invoiceNo,
        document_date: documentDate || null,
        bill_to: billTo,
        ship_to: shipTo,
        packages: normalizePackingPackagesForSave(packages),
        notes,
        party_id: linkedPartyId,
        party_save:
          listStatus === "issued"
            ? undefined
            : savePartyFlags.save_bill || savePartyFlags.save_ship || savePartyFlags.bill_and_ship_same
              ? savePartyFlags
              : undefined,
        append_ship_address_to_linked_party: appendShip ? true : undefined,
      };
      if (mode === "create") {
        const res = await createPackingList({
          ...payload,
          series_slot: numberingCreate?.multiSeriesEnabled ? seriesSlot : null,
        });
        router.replace(`/packing-lists/${res.id}`);
      } else if (packingListId) {
        const res = await updatePackingList(packingListId, {
          ...payload,
          series_slot:
            listStatus === "draft" && numberingDraft?.multiSeriesEnabled ? seriesSlot : undefined,
        });
        setLinkedPartyId(res.party_id);
        router.replace(`/packing-lists/${packingListId}`);
      }
      if (appendShip) setSaveShipSnapshotToParty(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Document date</span>
          <input
            type="date"
            required
            min={restrictDocumentBackdate ? documentDateMinYmd.slice(0, 10) : undefined}
            max={documentDateMaxYmd.slice(0, 10)}
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        {numberingUi ? (
          <DocumentNumberSeriesCreateBlock
            numbering={numberingUi}
            documentDateYmd={documentDate}
            seriesSlot={seriesSlot}
            onSeriesSlotChange={setSeriesSlot}
          />
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Invoice no.</span>
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            placeholder="INV/2025-26/15"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Template</span>
          <select
            disabled={!canPickTemplate}
            value={template}
            onChange={(e) => setTemplate(e.target.value as PackingListTemplateId)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {templateOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {!canPickTemplate ? (
          <p className="text-xs text-[var(--muted)]">Free plan uses the Basic template. Upgrade for template choice.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="grid gap-6 lg:grid-cols-2">
          <PartyFields
            title="Billing Address (consignee)"
            value={billTo}
            onChange={setBillTo}
            parties={parties}
            pickTarget="bill"
            partyNameCombobox={!partyPickerDisabled}
            onReleasePartyLink={releaseBillPartyLink}
            lockAddressFields={billLoadedFromParty || listStatus === "issued"}
            partyAddressRowId={billPartyAddressId}
            addressLockVersion={billAddressLockVersion}
            selectedLoadPartyId={billLoadPartySelectId}
            partyPickerDisabled={partyPickerDisabled}
            addressLockHint={
              listStatus === "issued"
                ? "This packing list is issued — consignee name, address, and GSTIN cannot be changed. You may still update contact person and mobile when needed."
                : null
            }
            organizationCountryCode={organizationCountryCode}
            billingCountryCode={billingCountryCode}
            onPickParty={(id) => {
              if (id == null) {
                setBillTo(emptyParty(organizationCountryCode));
                setShipTo(emptyParty(organizationCountryCode));
                setBillLoadedFromParty(false);
                setShipLoadedFromParty(false);
                setLinkedPartyId(null);
                setShipSameAsBill(false);
                setSaveShipSnapshotToParty(false);
                setBillAddressLockVersion((v) => v + 1);
                setShipAddressLockVersion((v) => v + 1);
                return;
              }
              if (
                !partyPickerDisabled &&
                billLoadedFromParty &&
                linkedPartyId &&
                linkedPartyId !== id &&
                !confirmPartyChange(parties, linkedPartyId, id)
              ) {
                return;
              }
              const row = parties.find((p) => p.id === id);
              if (row) applyPickedPartyRow(row);
            }}
          />
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="text-sm font-semibold">Shipping Address</h3>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
            {linkedPartyId ? (
              <>
                <span className="shrink-0 text-xs text-[var(--muted)]">Ship-to</span>
                <select
                  className={loadPartySelectClassName}
                  value={shipSavedPickValue}
                  disabled={listStatus === "issued"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const row = parties.find((p) => p.id === linkedPartyId);
                    if (!row) return;
                    setShipSameAsBill(false);
                    setSaveShipSnapshotToParty(false);
                    if (v === "custom") {
                      setShipLoadedFromParty(false);
                      setShipAddressLockVersion((x) => x + 1);
                      return;
                    }
                    if (v === "new") {
                      setShipLoadedFromParty(false);
                      setShipTo(emptyParty(organizationCountryCode));
                      setShipAddressLockVersion((x) => x + 1);
                      return;
                    }
                    const idx = Number(v) as 0 | 1 | 2;
                    setShipSlotLoad(idx);
                    setShipTo(partyShipFromList(row, idx));
                    setShipLoadedFromParty(true);
                    setShipAddressLockVersion((x) => x + 1);
                  }}
                >
                  {sortedShipTos.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      Saved shipping {s.slot}:{" "}
                      {s.snapshot.name.trim() || s.snapshot.city?.trim() || "Address"}
                    </option>
                  ))}
                  {sortedShipTos.length < 3 ? (
                    <option value="new">New shipping address (empty form)</option>
                  ) : null}
                  <option value="custom">Custom address (edit below)</option>
                </select>
              </>
            ) : null}
            {shipSameAsBillApplies ? (
              <label className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[11px] leading-snug text-[var(--muted)]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)]"
                  checked={shipSameAsBill}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setShipSameAsBill(on);
                    if (on) setShipTo({ ...billTo });
                  }}
                />
                <span>Shipping address same as billing address</span>
              </label>
            ) : null}
          </div>
          <PartyFields
            embedded
            value={shipTo}
            onChange={(p) => {
              setShipTo(p);
              if (shipSameAsBill) setShipSameAsBill(false);
            }}
            parties={parties}
            pickTarget="ship"
            shipSlotIndex={shipSlotLoad}
            hideLoadPartyPicker
            lockAddressFields={
              (shipLoadedFromParty && Boolean(linkedPartyId)) || listStatus === "issued"
            }
            partyAddressRowId={shipPartyAddressId}
            addressLockVersion={shipAddressLockVersion}
            selectedLoadPartyId={shipLoadPartySelectId}
            partyPickerDisabled={partyPickerDisabled}
            addressLockHint={
              listStatus === "issued"
                ? "This packing list is issued — shipping name, address, and GSTIN cannot be changed. You may still update contact person and mobile when needed."
                : null
            }
            organizationCountryCode={organizationCountryCode}
            billingCountryCode={billingCountryCode}
            onPickParty={() => {}}
          />
          {linkedPartyId && !shipLoadedFromParty && listStatus !== "issued" && sortedShipTos.length < 3 ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] leading-snug text-[var(--muted)]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)]"
                checked={saveShipSnapshotToParty}
                onChange={(e) => setSaveShipSnapshotToParty(e.target.checked)}
              />
              <span>Save this as new shipping address on the party</span>
            </label>
          ) : null}
        </div>
        </div>

        {listStatus !== "issued" ? savePartyUi : null}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold">Packages &amp; lines</h3>
          <button
            type="button"
            onClick={addPackage}
            className="min-h-11 shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--border)] touch-manipulation sm:min-h-0 sm:py-1.5"
          >
            Add package
          </button>
        </div>

        {packages.map((pkg, pi) => (
          <div key={pi} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Package {pkg.package_no}</span>
              {packages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePackage(pi)}
                  className="min-h-10 text-sm text-red-600 hover:underline touch-manipulation"
                >
                  Remove package
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1 text-xs">
                <label htmlFor={`packing-type-${pi}`} className="text-[var(--muted)]">
                  Package type
                </label>
                <select
                  id={`packing-type-${pi}`}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                  value={packageTypeSelectValue(pkg)}
                  onChange={(e) => setPackageTypeSelect(pi, e.target.value)}
                >
                  <option value="">Select…</option>
                  {STANDARD_PACKAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value={PACKAGE_TYPE_SELECT_OTHER}>Other</option>
                </select>
                {packageTypeSelectValue(pkg) === PACKAGE_TYPE_SELECT_OTHER ? (
                  <>
                    <label htmlFor={`packing-type-other-${pi}`} className="text-[var(--muted)]">
                      Specify type
                    </label>
                    <input
                      id={`packing-type-other-${pi}`}
                      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                      value={
                        pkg.package_type_mode === "other"
                          ? pkg.package_type
                          : canonicalStandardPackageType(pkg.package_type)
                            ? ""
                            : pkg.package_type
                      }
                      onChange={(e) => setPackageTypeOtherText(pi, e.target.value)}
                      placeholder="e.g. Pallet, bundle, bag"
                      autoComplete="off"
                    />
                  </>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <label
                  htmlFor={`packing-size-${pi}`}
                  className="font-medium text-[var(--foreground)]"
                >
                  Size: Length×Width×Height (cm)
                </label>
                <input
                  id={`packing-size-${pi}`}
                  name={`packing-size-${pi}`}
                  autoComplete="off"
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                  value={pkg.package_size}
                  onChange={(e) => updatePackage(pi, { package_size: e.target.value })}
                  placeholder="e.g. 10×20×30"
                  aria-label={PACKING_SIZE_FIELD_LABEL}
                />
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <label htmlFor={`packing-weight-${pi}`} className="text-[var(--muted)]">
                  Gross weight (kg)
                </label>
                <input
                  id={`packing-weight-${pi}`}
                  type="number"
                  min={0}
                  step="any"
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                  value={pkg.package_weight_kg ?? ""}
                  onChange={(e) =>
                    updatePackage(pi, {
                      package_weight_kg: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-4">
                <label htmlFor={`packing-remarks-${pi}`} className="text-[var(--muted)]">
                  Packing remarks
                </label>
                <input
                  id={`packing-remarks-${pi}`}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                  value={pkg.packing_remarks}
                  onChange={(e) => updatePackage(pi, { packing_remarks: e.target.value })}
                />
              </div>
            </div>

            <p className="text-xs text-[var(--muted)] lg:hidden">Swipe sideways for all line columns.</p>
            <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [-webkit-overflow-scrolling:touch] sm:mx-0 lg:touch-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-2 pr-2 min-w-[280px]">Item / product / service *</th>
                    <th className="py-2 pr-2 w-24">Unit *</th>
                    <th className="py-2 pr-2 w-28">Qty</th>
                    <th className="py-2 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {pkg.lines.map((line, li) => {
                    const catalogLinked = Boolean(line.item_preset_id);
                    const nameFieldCls =
                      "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5" +
                      (catalogLinked ? " cursor-not-allowed bg-[var(--muted)]/10 opacity-90" : "");
                    const optFieldCls =
                      "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs";
                    const catalogSubtitle = catalogLinked ? savedItemDetailsSubtitle(line) : null;
                    return (
                      <tr key={li} className="border-b border-[var(--border)]">
                        <td className="py-2 pr-2 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-1">
                              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                                {catalogLinked ? (
                                  <>
                                    <input
                                      required
                                      readOnly
                                      className={nameFieldCls + " w-full"}
                                      value={line.description}
                                      placeholder="Item / product / service name"
                                    />
                                    {catalogSubtitle ? (
                                      <p className="text-[11px] leading-snug text-[var(--muted)]">
                                        {catalogSubtitle}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <ItemDescriptionWithSavedSuggest
                                    required
                                    value={line.description}
                                    onChange={(v) => updateLine(pi, li, { description: v })}
                                    savedItems={savedItems}
                                    inputClassName={nameFieldCls}
                                    placeholder="Type to search saved items or enter a new name"
                                    onPickSaved={(it) =>
                                      updateLine(pi, li, {
                                        description: it.description,
                                        unit: it.default_unit || "Pcs",
                                        make_service_provider: it.make_service_provider,
                                        model_part_no_description: it.model_part_no_description,
                                        hsn_sac: it.hsn_sac,
                                        item_preset_id: it.id,
                                        save_as_item: undefined,
                                      })
                                    }
                                  />
                                )}
                              </div>
                              {catalogLinked ? (
                                <button
                                  type="button"
                                  title="Unlink saved item"
                                  aria-label="Unlink saved item"
                                  className="h-[34px] w-8 shrink-0 self-start rounded-md border border-[var(--border)] bg-[var(--card)] text-base leading-none text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                                  onClick={() =>
                                    updateLine(pi, li, {
                                      description: "",
                                      make_service_provider: "",
                                      model_part_no_description: "",
                                      hsn_sac: "",
                                      unit: "Pcs",
                                      item_preset_id: null,
                                      save_as_item: true,
                                    })
                                  }
                                >
                                  -
                                </button>
                              ) : null}
                            </div>
                            {!catalogLinked ? (
                              <>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <input
                                    className={optFieldCls}
                                    value={line.model_part_no_description ?? ""}
                                    onChange={(e) =>
                                      updateLine(pi, li, { model_part_no_description: e.target.value })
                                    }
                                    placeholder="Model / part no / description (optional)"
                                  />
                                  <input
                                    className={optFieldCls}
                                    value={line.make_service_provider ?? ""}
                                    onChange={(e) =>
                                      updateLine(pi, li, { make_service_provider: e.target.value })
                                    }
                                    placeholder="Make / service provider (optional)"
                                  />
                                </div>
                                <input
                                  className={optFieldCls}
                                  value={line.hsn_sac ?? ""}
                                  onChange={(e) => updateLine(pi, li, { hsn_sac: e.target.value })}
                                  placeholder="HSN / SAC (optional)"
                                />
                                <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                                  <input
                                    type="checkbox"
                                    checked={line.save_as_item !== false}
                                    onChange={(e) => updateLine(pi, li, { save_as_item: e.target.checked })}
                                  />
                                  Save as item in database when saving this document
                                </label>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <input
                            required
                            readOnly={catalogLinked}
                            className={
                              "w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5" +
                              (catalogLinked ? " cursor-not-allowed bg-[var(--muted)]/10 opacity-90" : "")
                            }
                            value={line.unit}
                            onChange={(e) => updateLine(pi, li, { unit: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                            value={line.qty}
                            onChange={(e) => updateLine(pi, li, { qty: Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-2 text-right align-top">
                          {pkg.lines.length > 1 ? (
                            <button
                              type="button"
                              className="min-h-10 min-w-[3.25rem] px-2 text-sm text-red-600 hover:underline touch-manipulation"
                              onClick={() => removeLine(pi, li)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => addLine(pi)}
              className="flex min-h-11 items-center text-sm text-sky-600 hover:underline touch-manipulation"
            >
              + Add line in this package
            </button>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={mode === "edit" && packingListId ? `/packing-lists/${packingListId}` : "/packing-lists"}
          className="flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:min-h-0"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className={primaryButtonMd + " min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"}
        >
          {loading
            ? "Saving…"
            : mode === "create"
              ? "Create draft"
              : listStatus === "issued"
                ? "Save changes"
                : "Save draft"}
        </button>
      </div>
    </form>
  );
}
