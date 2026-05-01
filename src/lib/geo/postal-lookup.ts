/**
 * Postal / PIN lookups for address autofill. Called from Route Handlers only (not bundled to client).
 * India: api.postalpincode.in (public). Others: Zippopotam (free, no key).
 */

export type PostalLookupResult = {
  city: string;
  state: string;
};

const FETCH_TIMEOUT_MS = 8000;

function normalizeIndiaPin(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  return d.length === 6 ? d : null;
}

/** Zippopotam uses lowercase ISO2 in path. */
function normalizeZippopotamPostal(country: string, raw: string): string | null {
  const cc = country.trim().toUpperCase();
  const s = raw.trim();
  if (!s) return null;
  if (cc === "US") {
    const digits = s.replace(/\D/g, "");
    if (digits.length === 5 || digits.length === 9) {
      return digits.length === 9 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    }
    return null;
  }
  return s.toUpperCase();
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
  headers?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

type IndiaPinPayload = {
  Status?: string;
  PostOffice?: Array<{ District?: string; Name?: string; State?: string }>;
};

function normalizeIndiaApiEnvelope(raw: unknown): IndiaPinPayload | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length > 0 && raw[0] != null && typeof raw[0] === "object") {
    return raw[0] as IndiaPinPayload;
  }
  if (typeof raw === "object") {
    return raw as IndiaPinPayload;
  }
  return null;
}

async function lookupIndiaPin(postal: string, signal: AbortSignal): Promise<PostalLookupResult | null> {
  const url = `https://api.postalpincode.in/pincode/${encodeURIComponent(postal)}`;
  const raw = await fetchJson(url, signal, {
    "User-Agent": "eazmybiz/1.0 (server; postal-lookup)",
  });
  const data = normalizeIndiaApiEnvelope(raw);
  const status = String(data?.Status ?? "").trim().toLowerCase();
  if (!data || status !== "success" || !Array.isArray(data.PostOffice) || !data.PostOffice.length) {
    return null;
  }
  const po = data.PostOffice[0];
  const district = String(po.District ?? "").trim();
  const name = String(po.Name ?? "").trim();
  const state = String(po.State ?? "").trim();
  const city = district || name;
  if (!city || !state) return null;
  return { city, state };
}

async function lookupZippopotam(
  countryLower: string,
  postalEncoded: string,
  signal: AbortSignal,
): Promise<PostalLookupResult | null> {
  const url = `https://api.zippopotam.us/${countryLower}/${postalEncoded}`;
  const data = (await fetchJson(url, signal)) as {
    places?: Array<{ "place name"?: string; state?: string }>;
  } | null;
  if (!data || !Array.isArray(data.places) || !data.places.length) return null;
  const pl = data.places[0];
  const city = String(pl["place name"] ?? "").trim();
  const state = String(pl.state ?? "").trim();
  if (!city || !state) return null;
  return { city, state };
}

/** Countries with reliable Zippopotam coverage (subset). */
const ZIPPOTAM_COUNTRIES = new Set([
  "us",
  "gb",
  "ca",
  "au",
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "be",
  "at",
  "ch",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "cz",
  "pt",
  "ie",
  "nz",
  "mx",
  "br",
  "jp",
  "sg",
  "hk",
  "tw",
  "kr",
  "ae",
  "sa",
  "za",
  "tr",
  "ru",
  "ua",
  "il",
  "my",
  "th",
  "id",
  "ph",
  "vn",
  "pk",
  "bd",
  "lk",
  "np",
  "eg",
  "ng",
  "ke",
]);

/**
 * Resolve city + state from postal code for supported countries.
 */
export async function resolvePostalLookup(
  countryIso: string,
  postalRaw: string,
  parentSignal?: AbortSignal,
): Promise<PostalLookupResult | null> {
  const cc = countryIso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const onParentAbort = () => {
    clearTimeout(tid);
    ctrl.abort();
  };
  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(tid);
      return null;
    }
    parentSignal.addEventListener("abort", onParentAbort);
  }

  try {
    if (cc === "IN") {
      const pin = normalizeIndiaPin(postalRaw);
      if (!pin) return null;
      return await lookupIndiaPin(pin, ctrl.signal);
    }

    const lower = cc.toLowerCase();
    if (!ZIPPOTAM_COUNTRIES.has(lower)) return null;
    const normalized = normalizeZippopotamPostal(cc, postalRaw);
    if (!normalized) return null;
    const encoded = encodeURIComponent(normalized);
    return await lookupZippopotam(lower, encoded, ctrl.signal);
  } finally {
    clearTimeout(tid);
    if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
  }
}
