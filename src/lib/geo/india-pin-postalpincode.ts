import {
  expectedIndiaStateFromPin,
  indiaStateMatchesPin,
  reconcileIndiaPinLookup,
  sanitizeIndiaLocalityField,
} from "@/lib/geo/india-pin-region";

export type IndiaPostOffice = {
  Name?: string;
  BranchType?: string;
  District?: string;
  State?: string;
  Block?: string;
  Division?: string;
  Region?: string;
};

type IndiaPinPayload = {
  Status?: string;
  PostOffice?: IndiaPostOffice[];
};

function scorePostOffice(postal: string, po: IndiaPostOffice): number {
  let score = 0;
  const state = String(po.State ?? "").trim();
  if (indiaStateMatchesPin(postal, state)) score += 100;

  const branchType = String(po.BranchType ?? "").trim().toLowerCase();
  if (branchType.includes("head")) score += 30;
  else if (branchType.includes("sub")) score += 20;
  else if (branchType.includes("branch")) score += 10;

  const district = String(po.District ?? "").trim();
  if (district) score += 5;

  return score;
}

function dominantDistrict(postal: string, offices: IndiaPostOffice[]): string {
  const counts = new Map<string, number>();
  for (const po of offices) {
    if (!indiaStateMatchesPin(postal, String(po.State ?? "").trim())) continue;
    const district = String(po.District ?? "").trim();
    if (!district) continue;
    counts.set(district, (counts.get(district) ?? 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [district, count] of counts) {
    if (count > bestCount) {
      best = district;
      bestCount = count;
    }
  }
  return best;
}

export function pickIndiaPostOffice(
  postal: string,
  offices: IndiaPostOffice[],
): IndiaPostOffice | null {
  if (!offices.length) return null;

  const expected = expectedIndiaStateFromPin(postal);
  const stateMatched = offices.filter((po) =>
    indiaStateMatchesPin(postal, String(po.State ?? "").trim()),
  );
  const pool = stateMatched.length ? stateMatched : offices;
  const district = dominantDistrict(postal, pool);

  const candidates = district
    ? pool.filter((po) => String(po.District ?? "").trim() === district)
    : pool;

  const ranked = [...(candidates.length ? candidates : pool)].sort(
    (a, b) => scorePostOffice(postal, b) - scorePostOffice(postal, a),
  );

  const top = ranked[0] ?? null;
  if (!top) return null;

  if (expected && !indiaStateMatchesPin(postal, String(top.State ?? "").trim())) {
    const fallback = stateMatched.sort(
      (a, b) => scorePostOffice(postal, b) - scorePostOffice(postal, a),
    )[0];
    return fallback ?? top;
  }

  return top;
}

function cityFromPostOffice(postal: string, po: IndiaPostOffice): string {
  const district = sanitizeIndiaLocalityField(po.District);
  const name = sanitizeIndiaLocalityField(po.Name);
  const expected = expectedIndiaStateFromPin(postal);

  if (expected === "Delhi") {
    if (district.toLowerCase().includes("delhi")) return district;
    return district || "New Delhi";
  }

  return district || name;
}

export function normalizeIndiaApiEnvelope(raw: unknown): IndiaPinPayload | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length > 0 && raw[0] != null && typeof raw[0] === "object") {
    return raw[0] as IndiaPinPayload;
  }
  if (typeof raw === "object") {
    return raw as IndiaPinPayload;
  }
  return null;
}

export function parseIndiaPinPostalpincodeResponse(
  postal: string,
  raw: unknown,
): { city: string; state: string } | null {
  const data = normalizeIndiaApiEnvelope(raw);
  const status = String(data?.Status ?? "").trim().toLowerCase();
  if (!data || status !== "success" || !Array.isArray(data.PostOffice) || !data.PostOffice.length) {
    return null;
  }

  const po = pickIndiaPostOffice(postal, data.PostOffice);
  if (!po) return null;

  const state = String(po.State ?? "").trim();
  const city = cityFromPostOffice(postal, po);
  if (!city || !state) return null;

  return reconcileIndiaPinLookup(postal, { city, state });
}
