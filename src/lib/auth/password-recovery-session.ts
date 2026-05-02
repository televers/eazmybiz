import type { Session } from "@supabase/supabase-js";

/** Decode JWT payload (client-side routing only; token already issued by Supabase). */
function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * True when this session was created via password recovery (reset link).
 * Needed because @supabase/ssr runs PKCE from the URL on client init and drops `redirectType` for that path.
 * See: https://supabase.com/docs/guides/auth/jwt-fields (`amr.method` includes `"recovery"`).
 */
export function isPasswordRecoverySession(session: Session | null | undefined): boolean {
  if (!session?.access_token) return false;
  const payload = decodeJwtPayload(session.access_token);
  if (!payload) return false;
  const amr = payload.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: unknown) => {
    if (entry && typeof entry === "object" && "method" in entry) {
      return (entry as { method?: string }).method === "recovery";
    }
    return false;
  });
}

export function redirectTypeIsPasswordRecovery(redirectType: string | null | undefined): boolean {
  return redirectType === "PASSWORD_RECOVERY" || redirectType === "recovery";
}
