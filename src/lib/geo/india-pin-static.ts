import { reconcileIndiaPinLookup, sanitizeIndiaLocalityField } from "@/lib/geo/india-pin-region";

type StaticFind = (postalCode: string) => {
  state: string;
  district: string;
  subDistrict: string;
  place: string;
  isValid: boolean;
};

let findIndiaPostal: StaticFind | null = null;

async function loadStaticFind(): Promise<StaticFind> {
  if (!findIndiaPostal) {
    const mod = await import("postalcodes-india");
    findIndiaPostal = mod.find;
  }
  return findIndiaPostal;
}

function cityFromStaticLookup(input: {
  state: string;
  district: string;
  subDistrict: string;
}): string {
  const sub = sanitizeIndiaLocalityField(input.subDistrict);
  const dist = sanitizeIndiaLocalityField(input.district);

  if (input.state === "Delhi") return sub || "New Delhi";

  if (sub && dist && sub.toLowerCase() !== dist.toLowerCase()) {
    if (dist.split(/\s+/).length >= 2) return sub;
    if (/\b(north|south|east|west|urban estate)\b/i.test(sub)) return dist;
    return sub;
  }

  return dist || sub;
}

/** Offline India Post–derived lookup (primary for India PIN autofill). */
export async function lookupIndiaPinStatic(
  postal: string,
): Promise<{ city: string; state: string } | null> {
  const find = await loadStaticFind();
  const row = find(postal);
  if (!row.isValid) return null;

  const state = sanitizeIndiaLocalityField(row.state) || row.state.trim();
  const city = cityFromStaticLookup({
    state,
    district: row.district,
    subDistrict: row.subDistrict,
  });
  if (!state) return null;

  return reconcileIndiaPinLookup(postal, { city, state });
}
