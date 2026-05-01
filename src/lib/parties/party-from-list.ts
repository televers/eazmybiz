import type { PartySnapshot } from "@/lib/packing/types";
import { emptyParty } from "@/lib/packing/types";
import type { PartyListRow } from "@/lib/parties/load-parties";

export function partyBillFromList(row: PartyListRow): PartySnapshot {
  return row.bill_to;
}

/** `slotIndex` 0 = first saved ship-to (lowest slot no.), up to 2. */
export function partyShipFromList(row: PartyListRow, slotIndex: 0 | 1 | 2): PartySnapshot {
  return row.ship_tos[slotIndex]?.snapshot ?? emptyParty();
}
