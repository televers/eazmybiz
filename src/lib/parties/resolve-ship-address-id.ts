import type { PartySnapshot } from "@/lib/packing/types";
import { addressStructuralEqual } from "@/lib/parties/snapshot";
import type { PartyListRow } from "@/lib/parties/load-parties";

/** Resolve `party_addresses.id` for shipping, preferring structural match then slot. */
export function resolvePartyShipAddressId(
  row: PartyListRow | undefined,
  shipSnap: PartySnapshot,
  preferredSlotIndex: 0 | 1 | 2,
): string | null {
  if (!row?.ship_tos.length) return null;
  const struct = row.ship_tos.find((s) => addressStructuralEqual(s.snapshot, shipSnap));
  if (struct) return struct.id;
  const wantSlot = preferredSlotIndex + 1;
  const bySlot = row.ship_tos.find((s) => s.slot === wantSlot);
  if (bySlot) return bySlot.id;
  return row.ship_tos[0]?.id ?? null;
}
