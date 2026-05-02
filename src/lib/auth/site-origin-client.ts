/**
 * Base URL for auth email links on the client (e.g. password recovery).
 * Prefer NEXT_PUBLIC_SITE_URL so the redirect matches Supabase’s allowlist even if
 * the user opened the app on www vs apex or another host.
 */
export function getClientAuthOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
