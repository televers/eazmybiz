"use client";

import { formatPartyBlock } from "@/lib/packing/format";
import type { PartySnapshot } from "@/lib/packing/types";

/** Compact address block matching print / PDF layout. */
export function PartyAddressPreview({ party }: { party: PartySnapshot }) {
  const lines = formatPartyBlock(party);
  return (
    <pre className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-sans text-sm leading-relaxed text-[var(--foreground)]">
      {lines.length > 0 ? lines.join("\n") : "—"}
    </pre>
  );
}

export function partySnapshotHasAddressContent(p: PartySnapshot): boolean {
  return Boolean(
    p.name?.trim() ||
      p.address_line1?.trim() ||
      p.address_line2?.trim() ||
      p.city?.trim() ||
      p.state?.trim() ||
      p.pin?.trim() ||
      p.gstin?.trim(),
  );
}
