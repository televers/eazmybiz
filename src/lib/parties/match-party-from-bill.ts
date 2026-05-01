import type { PartySnapshot } from "@/lib/packing/types";
import type { PartyListRow } from "@/lib/parties/load-parties";
import { addressStructuralEqual } from "@/lib/parties/snapshot";

/**
 * When a document has no `party_id` but a billing snapshot, find the party whose saved bill
 * matches on address structure (name, lines, city, state, pin, country, GSTIN).
 * Contact name and mobile are ignored so legacy / one-off contact lines on the document
 * do not block a match.
 *
 * Returns an id only if exactly one party matches (avoids ambiguous links).
 */
export function matchPartyIdFromBillSnapshot(
  docBill: PartySnapshot,
  parties: PartyListRow[],
): string | null {
  if (!docBill.name.trim()) return null;
  const matches = parties.filter((p) => addressStructuralEqual(docBill, p.bill_to));
  if (matches.length !== 1) return null;
  return matches[0]!.id;
}
