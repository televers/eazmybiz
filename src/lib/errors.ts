/** Human-readable hint when the browser could not complete the request (often dev/Turbopack or network). */
const FETCH_FAILED_HINT =
  "Could not reach the app server (network or dev server). If you use `npm run dev:turbo`, try `npm run dev` instead. " +
  "Confirm `npm run dev` is running, then hard-refresh. On Vercel, check deployment logs and that NEXT_PUBLIC_SUPABASE_* env vars are set.";

/** Normalizes server-action, Supabase, and unknown errors for UI display. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string" && err.trim()) {
    if (/failed to fetch|load failed|networkerror|fetch failed/i.test(err)) return FETCH_FAILED_HINT;
    return err;
  }
  if (err instanceof Error && err.message.trim()) {
    const m = err.message.trim();
    if (/failed to fetch|load failed|networkerror|fetch failed/i.test(m)) return FETCH_FAILED_HINT;
    return m;
  }
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) {
      if (/failed to fetch|load failed|networkerror|fetch failed/i.test(m)) return FETCH_FAILED_HINT;
      return m;
    }
  }
  return fallback;
}
