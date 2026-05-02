"use client";

import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";

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
  | { ok: true }
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, kind: "error" };
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true };
  }

  const token_hash = params.get("token_hash");
  const type = parseOtpType(params.get("type"));
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return { ok: false, kind: "error" };
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true };
  }

  const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const access_token = hp.get("access_token");
  const refresh_token = hp.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) return { ok: false, kind: "error" };
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true };
  }

  if (params.get("error")) {
    return { ok: false, kind: "error" };
  }

  return { ok: false, kind: "no_tokens" };
}
