"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createPartyRecord,
  deleteParty,
  getPartyHasDocuments,
  updatePartyDisplayName,
  upsertPartyAddress,
  deletePartyAddress,
} from "@/app/(main)/parties/actions";
import { PartyFields } from "@/components/packing/party-fields";
import { shippingAddressCardTitle } from "@/lib/parties/address-option-labels";
import type { PartyListRow } from "@/lib/parties/load-parties";
import type { PartySnapshot } from "@/lib/packing/types";
import { emptyParty } from "@/lib/packing/types";
import { primaryButtonMd } from "@/lib/ui/primary-button";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm w-full";

function addressSummary(p: PartySnapshot): string {
  const bits = [
    p.name.trim(),
    [p.city, p.state].filter(Boolean).join(", "),
    p.gstin?.trim(),
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "No details yet";
}

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

export function PartyFormModal({
  open,
  onClose,
  mode,
  party,
  hasDocumentsOverride,
  onSaved,
  canEditBilling = true,
  organizationCountryCode = "IN",
  billingCountryCode,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  party?: PartyListRow;
  /** When set (e.g. party detail page), skips loading document flags. */
  hasDocumentsOverride?: boolean;
  onSaved?: () => void;
  /**
   * When false (edit mode), party name and billing are read-only and delete is hidden;
   * shipping addresses stay editable.
   */
  canEditBilling?: boolean;
  /** ISO country for default mobile ISD (company profile). */
  organizationCountryCode?: string;
  /** Subscription billing country — mobile ISD Suggested row. */
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [billSnap, setBillSnap] = useState<PartySnapshot>(() => emptyParty(organizationCountryCode));
  const [editName, setEditName] = useState(false);
  const [editBilling, setEditBilling] = useState(false);
  const [shipRows, setShipRows] = useState<PartyListRow["ship_tos"]>([]);
  const [editShipSlot, setEditShipSlot] = useState<number | null>(null);
  const [newShipDrafts, setNewShipDrafts] = useState<PartySnapshot[]>([]);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetFromParty = useCallback((p: PartyListRow) => {
    setDisplayName(p.display_name);
    setBillSnap({ ...p.bill_to });
    setShipRows(p.ship_tos.map((s) => ({ ...s, snapshot: { ...s.snapshot } })));
    setEditName(false);
    setEditBilling(false);
    setEditShipSlot(null);
    setNewShipDrafts([]);
    setError(null);
  }, []);

  const resetCreate = useCallback(() => {
    setDisplayName("");
    setBillSnap(emptyParty(organizationCountryCode));
    setShipRows([]);
    setEditName(true);
    setEditBilling(true);
    setEditShipSlot(null);
    setNewShipDrafts([]);
    setError(null);
  }, [organizationCountryCode]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && party) {
      resetFromParty(party);
      if (hasDocumentsOverride !== undefined) {
        setHasDocuments(hasDocumentsOverride);
      } else {
        getPartyHasDocuments(party.id)
          .then(setHasDocuments)
          .catch(() => setHasDocuments(true));
      }
    } else if (mode === "create") {
      resetCreate();
      setHasDocuments(false);
    }
  }, [open, mode, party?.id, party?.updated_at, hasDocumentsOverride, resetFromParty, resetCreate, party]);

  useEffect(() => {
    if (!open || mode !== "edit" || canEditBilling) return;
    setEditName(false);
    setEditBilling(false);
  }, [open, mode, canEditBilling]);

  async function saveDisplayNameOnly() {
    if (mode !== "edit" || !party) return;
    setError(null);
    if (!displayName.trim()) {
      setError("Party name is required.");
      return;
    }
    setLoading(true);
    try {
      await updatePartyDisplayName(party.id, displayName);
      setEditName(false);
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveBilling() {
    setError(null);
    if (mode === "edit" && !party) return;
    if (!billSnap.name.trim()) {
      setError("Billing address name is required.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "create") {
        setEditBilling(false);
        setLoading(false);
        return;
      }
      await upsertPartyAddress(party!.id, "bill_to", null, billSnap);
      setEditBilling(false);
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveShipSlot(slot: number, snap: PartySnapshot) {
    if (mode !== "edit" || !party) return;
    setError(null);
    if (!snap.name.trim()) {
      setError("Shipping address name is required.");
      return;
    }
    setLoading(true);
    try {
      await upsertPartyAddress(party.id, "ship_to", slot, snap);
      setEditShipSlot(null);
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeShip(entry: PartyListRow["ship_tos"][0]) {
    if (mode !== "edit" || !party) return;
    if (!confirm("Remove this shipping address?")) return;
    setLoading(true);
    try {
      await deletePartyAddress(party.id, entry.id);
      setShipRows((prev) => prev.filter((s) => s.id !== entry.id));
      setEditShipSlot(null);
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitCreate() {
    setError(null);
    if (!displayName.trim()) {
      setError("Party name is required.");
      return;
    }
    if (!billSnap.name.trim()) {
      setError("Billing address name is required.");
      return;
    }
    setLoading(true);
    try {
      const id = await createPartyRecord(displayName);
      await upsertPartyAddress(id, "bill_to", null, billSnap);
      let slot = 1;
      for (const s of newShipDrafts) {
        if (s.name.trim()) {
          await upsertPartyAddress(id, "ship_to", slot, s);
          slot += 1;
          if (slot > 3) break;
        }
      }
      onSaved?.();
      onClose();
      router.push(`/parties/${id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteParty() {
    if (mode !== "edit" || !party || hasDocuments) return;
    if (!confirm("Delete this party permanently? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteParty(party.id);
      onClose();
      router.push("/parties");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function addNewShipDraft() {
    if (mode === "create") {
      if (newShipDrafts.length >= 3) return;
      setNewShipDrafts((prev) => [...prev, emptyParty(organizationCountryCode)]);
      return;
    }
    if (!party) return;
    const used = new Set(shipRows.map((s) => s.slot));
    const next = ([1, 2, 3] as const).find((s) => !used.has(s));
    if (next == null) return;
    setShipRows((prev) => [
      ...prev,
      { id: `pending-${next}`, slot: next, snapshot: emptyParty(organizationCountryCode) },
    ]);
    setEditShipSlot(next);
  }

  async function saveNewPendingShip(slot: number, snap: PartySnapshot) {
    if (mode !== "edit" || !party) return;
    setError(null);
    if (!snap.name.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    try {
      await upsertPartyAddress(party.id, "ship_to", slot, snap);
      setShipRows((prev) => prev.filter((s) => !(s.id.startsWith("pending-") && s.slot === slot)));
      setEditShipSlot(null);
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function removePendingRow(slot: number) {
    setShipRows((prev) => prev.filter((s) => !(s.id.startsWith("pending-") && s.slot === slot)));
    setEditShipSlot(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 py-10">
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 id="party-modal-title" className="text-lg font-semibold">
            {mode === "create" ? "New party" : "Edit party"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto px-4 py-4">
          {/* Party name */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Party name</span>
              {mode === "edit" && canEditBilling ? (
                <button
                  type="button"
                  onClick={() => setEditName((e) => !e)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sky-600 hover:bg-sky-500/10"
                >
                  <IconPencil />
                  {editName ? "Done" : "Edit"}
                </button>
              ) : null}
            </div>
            {mode === "create" || (mode === "edit" && canEditBilling && editName) ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  className={field + " flex-1 min-w-[200px]"}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Company / party name"
                  required
                />
                {mode === "edit" ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void saveDisplayNameOnly()}
                    className={primaryButtonMd}
                  >
                    Save name
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium">{displayName}</p>
            )}
          </section>

          {/* Billing */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Billing address
              </span>
              {(mode === "create" || canEditBilling) ? (
                <button
                  type="button"
                  onClick={() => setEditBilling((e) => !e)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sky-600 hover:bg-sky-500/10"
                >
                  <IconPencil />
                  {editBilling ? "Done" : "Edit"}
                </button>
              ) : null}
            </div>
            {mode === "edit" && !canEditBilling ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Only the party maintainer, a company admin, or the account owner can change billing.
              </p>
            ) : null}
            {!editBilling ? (
              <p className="mt-2 text-sm text-[var(--foreground)]">{addressSummary(billSnap)}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <PartyFields
                  title={undefined}
                  value={billSnap}
                  onChange={setBillSnap}
                  parties={[]}
                  pickTarget="bill"
                  onPickParty={() => {}}
                  organizationCountryCode={organizationCountryCode}
                  billingCountryCode={billingCountryCode}
                />
                {mode === "edit" ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void saveBilling()}
                    className={primaryButtonMd}
                  >
                    Save billing address
                  </button>
                ) : null}
              </div>
            )}
          </section>

          {/* Shipping */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Shipping addresses
              </span>
              {(mode === "create" ? newShipDrafts.length < 3 : shipRows.length < 3) ? (
                <button
                  type="button"
                  onClick={addNewShipDraft}
                  className="text-xs font-medium text-sky-600 hover:underline"
                >
                  + Add shipping
                </button>
              ) : null}
            </div>

            {mode === "create"
              ? newShipDrafts.map((snap, i) => (
                  <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="mb-2 flex items-center justify-end">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => setNewShipDrafts((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </div>
                    <PartyFields
                      title={shippingAddressCardTitle(i + 1)}
                      value={snap}
                      onChange={(p) =>
                        setNewShipDrafts((prev) => prev.map((x, j) => (j === i ? p : x)))
                      }
                      parties={[]}
                      pickTarget="ship"
                      onPickParty={() => {}}
                      organizationCountryCode={organizationCountryCode}
                      billingCountryCode={billingCountryCode}
                    />
                  </div>
                ))
              : shipRows.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      {editShipSlot !== entry.slot ? (
                        <span className="text-sm font-medium">{shippingAddressCardTitle(entry.slot)}</span>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditShipSlot((s) => (s === entry.slot ? null : entry.slot))
                          }
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sky-600 hover:bg-sky-500/10"
                        >
                          <IconPencil />
                          {editShipSlot === entry.slot ? "Done" : "Edit"}
                        </button>
                        {!entry.id.startsWith("pending-") ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void removeShip(entry)}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removePendingRow(entry.slot)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    {editShipSlot !== entry.slot ? (
                      <p className="mt-2 text-sm">{addressSummary(entry.snapshot)}</p>
                    ) : (
                      <ShipEditor
                        shipSlot={entry.slot}
                        initial={entry.snapshot}
                        loading={loading}
                        organizationCountryCode={organizationCountryCode}
                        billingCountryCode={billingCountryCode}
                        onSave={(snap) => {
                          if (entry.id.startsWith("pending-")) {
                            void saveNewPendingShip(entry.slot, snap);
                          } else {
                            void saveShipSlot(entry.slot, snap);
                          }
                        }}
                      />
                    )}
                  </div>
                ))}
          </section>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
          <div>
            {mode === "edit" && party && canEditBilling && !hasDocuments ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void onDeleteParty()}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                Delete party
              </button>
            ) : mode === "edit" && canEditBilling && hasDocuments ? (
              <p className="text-xs text-[var(--muted)]">
                Delete unavailable: party is used on a quotation, packing list, delivery challan, or gate pass.
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
            >
              Close
            </button>
            {mode === "create" ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void submitCreate()}
                className={primaryButtonMd}
              >
                {loading ? "Saving…" : "Save party"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipEditor({
  shipSlot,
  initial,
  loading,
  onSave,
  organizationCountryCode,
  billingCountryCode,
}: {
  shipSlot: number;
  initial: PartySnapshot;
  loading: boolean;
  onSave: (snap: PartySnapshot) => void;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
}) {
  const [snap, setSnap] = useState<PartySnapshot>({ ...initial });
  useEffect(() => {
    setSnap({ ...initial });
  }, [initial]);
  return (
    <div className="mt-2 space-y-2">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {shippingAddressCardTitle(shipSlot)}
      </h3>
      <PartyFields
        title={undefined}
        value={snap}
        onChange={setSnap}
        parties={[]}
        pickTarget="ship"
        onPickParty={() => {}}
        organizationCountryCode={organizationCountryCode}
        billingCountryCode={billingCountryCode}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => onSave(snap)}
        className={primaryButtonMd}
      >
        Save shipping address
      </button>
    </div>
  );
}
