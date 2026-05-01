"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { PartySnapshot } from "@/lib/packing/types";
import { snapshotsEqual } from "@/lib/parties/snapshot";
import type { SavePartyFlags } from "@/lib/parties/save-flags";

export type { SavePartyFlags };

type Mode = "bill_only" | "bill_ship";

export type UseSavePartyFlagsOptions = {
  partyLinkedId?: string | null;
};

/**
 * Single-checkbox “Save as new party” for documents. Quotation (bill_only) saves billing only;
 * packing list / challan (bill_ship) saves billing + shipping (same → one step, different → bill + next ship slot).
 */
export function useSavePartyFlags(
  mode: Mode,
  billTo: PartySnapshot,
  shipTo: PartySnapshot | undefined,
  options?: UseSavePartyFlagsOptions,
): [SavePartyFlags, ReactElement | null] {
  const partyLinkedId = options?.partyLinkedId ?? null;
  const both = mode === "bill_ship" && shipTo != null;
  const same = both ? snapshotsEqual(billTo, shipTo!) : false;

  const [saveAsNewParty, setSaveAsNewParty] = useState(false);

  useEffect(() => {
    if (partyLinkedId) setSaveAsNewParty(false);
  }, [partyLinkedId]);

  const hasBillName = Boolean(billTo.name.trim());
  const hasShipName = Boolean(shipTo?.name.trim());

  const flags: SavePartyFlags = {
    party_display_name: billTo.name.trim(),
    save_bill: Boolean(
      saveAsNewParty && !partyLinkedId && hasBillName && !(both && same),
    ),
    save_ship: Boolean(saveAsNewParty && !partyLinkedId && both && !same && hasShipName),
    bill_and_ship_same: Boolean(saveAsNewParty && !partyLinkedId && both && same && hasBillName),
  };

  if (partyLinkedId) {
    return [flags, null];
  }

  const hint =
    mode === "bill_ship"
      ? "Stores billing and shipping from this document. Reuse on packing lists, quotations, and delivery challans."
      : "Stores billing from this document. Reuse on packing lists, quotations, and delivery challans.";

  const ui = (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--border)]"
        checked={saveAsNewParty}
        onChange={(e) => setSaveAsNewParty(e.target.checked)}
      />
      <span className="min-w-0 text-sm leading-snug">
        <span className="font-medium text-[var(--foreground)]">Save as new party</span>
        <span className="text-[11px] text-[var(--muted)]"> · {hint}</span>
      </span>
    </label>
  );

  return [flags, ui];
}
