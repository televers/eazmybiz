import type { PartySnapshot } from "@/lib/packing/types";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Compare two address snapshots for equality (normalized trim, case-insensitive). */
export function snapshotsEqual(a: PartySnapshot, b: PartySnapshot): boolean {
  return (
    norm(a.name) === norm(b.name) &&
    norm(a.address_line1) === norm(b.address_line1) &&
    norm(a.address_line2) === norm(b.address_line2) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    norm(a.pin) === norm(b.pin) &&
    norm(a.country) === norm(b.country) &&
    norm(a.gstin) === norm(b.gstin) &&
    norm(a.contact_name) === norm(b.contact_name) &&
    norm(a.mobile) === norm(b.mobile)
  );
}

/** Same as full snapshot equality but ignores contact name and mobile (for matching a saved ship slot). */
export function addressStructuralEqual(a: PartySnapshot, b: PartySnapshot): boolean {
  return (
    norm(a.name) === norm(b.name) &&
    norm(a.address_line1) === norm(b.address_line1) &&
    norm(a.address_line2) === norm(b.address_line2) &&
    norm(a.city) === norm(b.city) &&
    norm(a.state) === norm(b.state) &&
    norm(a.pin) === norm(b.pin) &&
    norm(a.country) === norm(b.country) &&
    norm(a.gstin) === norm(b.gstin)
  );
}
