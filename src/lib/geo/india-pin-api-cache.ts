type PostalLookupResult = {
  city: string;
  state: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;

type CacheEntry = {
  result: PostalLookupResult;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedIndiaPinApi(postal: string): PostalLookupResult | null {
  const entry = cache.get(postal);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(postal);
    return null;
  }
  return entry.result;
}

export function setCachedIndiaPinApi(postal: string, result: PostalLookupResult): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(postal, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}
