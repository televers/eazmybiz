"use client";

import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";
import { isPasswordRecoverySession, redirectTypeIsPasswordRecovery } from "@/lib/auth/password-recovery-session";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "recovery",
  "invite",
  "email_change",
  "email",
  "magiclink",
]);

function parseOtpType(s: string | null): EmailOtpType | null {
  if (!s) return null;
  const t = s as EmailOtpType;
  return OTP_TYPES.has(t) ? t : null;
}

export type ConsumeEmailAuthRedirectResult =
  | { ok: true; passwordRecovery?: boolean }
  | { ok: false; kind: "no_tokens" }
  | { ok: false; kind: "error" };

/**
 * Consumes `?code=`, `?token_hash` + `type`, or `#access_token` + `#refresh_token` from the
 * current URL and establishes a session. On success, strips auth params from the address bar
 * (keeps path only — read `next` etc. from the URL before calling).
 */
export async function consumeEmailAuthRedirect(supabase: SupabaseClient): Promise<ConsumeEmailAuthRedirectResult> {
  const params = new URLSearchParams(window.location.search);

  const code = params.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, kind: "error" };
    const redirectType =
      data && typeof data === "object" && "redirectType" in data
        ? (data as { redirectType?: string | null }).redirectType
        : null;
    const session = (data as { session?: Session | null }).session ?? null;
    const passwordRecovery =
      redirectTypeIsPasswordRecovery(redirectType) || isPasswordRecoverySession(session);
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery };
  }

  const token_hash = params.get("token_hash");
  const type = parseOtpType(params.get("type"));
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return { ok: false, kind: "error" };
    const passwordRecovery =
      type === "recovery" || isPasswordRecoverySession(data.session ?? null);
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery };
  }

  const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const access_token = hp.get("access_token");
  const refresh_token = hp.get("refresh_token");
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) return { ok: false, kind: "error" };
    const passwordRecovery = isPasswordRecoverySession(data.session ?? null);
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery };
  }

  if (params.get("error")) {
    return { ok: false, kind: "error" };
  }

  return { ok: false, kind: "no_tokens" };
}
