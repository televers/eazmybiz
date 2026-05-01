import type { PartySnapshot } from "@/lib/packing/types";

/** Dropdown / header label for billing (print default). */
export function billingAddressOptionLabel(p: PartySnapshot): string {
  const c = p.city?.trim();
  return c ? `Billing address (default), ${c}` : "Billing address (default)";
}

/** Section title in Edit party cards (slots 1–3). */
export function shippingAddressCardTitle(slot: number): string {
  const def = slot === 1 ? " (default)" : "";
  return `Shipping Address ${slot}${def}`;
}

/** Dropdown / header label for a saved shipping slot (slot 1–3), with city when present. */
export function shippingAddressSlotLabel(slot: number, p: PartySnapshot): string {
  const c = p.city?.trim();
  const def = slot === 1 ? " (default)" : "";
  const cityPart = c ? `, ${c}` : "";
  return `Shipping Address ${slot}${def}${cityPart}`;
}
