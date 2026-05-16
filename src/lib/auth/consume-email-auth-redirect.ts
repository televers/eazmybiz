"use client";

import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";
import { userMustCompleteInvitePassword } from "@/lib/auth/must-complete-invite-password";
import { isPasswordRecoverySession, redirectTypeIsPasswordRecovery } from "@/lib/auth/password-recovery-session";

function hasNonEmailAuthProvider(session: Session | null): boolean {
  return Boolean(session?.user.identities?.some((i) => i.provider !== "email"));
}

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

/** Read signup / flow hints from query or hash before the URL is cleared. */
function readAuthCallbackIntent(): { flow: string | null; otpType: EmailOtpType | null } {
  const search = new URLSearchParams(window.location.search);
  const flow = search.get("flow");
  let otpType = parseOtpType(search.get("type"));
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash) {
    const hp = new URLSearchParams(rawHash);
    if (!otpType) otpType = parseOtpType(hp.get("type"));
  }
  return { flow, otpType };
}

function shouldForcePasswordLoginAfterVerify(
  intent: { flow: string | null; otpType: EmailOtpType | null },
  passwordRecovery: boolean,
): boolean {
  if (passwordRecovery) return false;
  if (intent.flow === "email_verify") return true;
  // Signup confirmation and some email templates use `signup` or `email`; require password sign-in after verify.
  if (intent.otpType === "signup" || intent.otpType === "email") return true;
  return false;
}

/** PKCE email confirmation often omits `type=`; keep OAuth/magic-link/invite sessions when we can tell. */
function extendForceLoginAfterVerify(
  intent: { flow: string | null; otpType: EmailOtpType | null },
  passwordRecovery: boolean,
  session: Session | null,
  base: boolean,
): boolean {
  if (passwordRecovery) return false;
  /** Invite (`must_set_password`): PKCE often omits `type=`; must not sign out to /login — go to set-password. */
  if (userMustCompleteInvitePassword(session?.user ?? null)) return false;
  if (base) return true;
  if (hasNonEmailAuthProvider(session)) return false;
  if (
    intent.otpType === "invite" ||
    intent.otpType === "magiclink" ||
    intent.otpType === "email_change"
  ) {
    return false;
  }
  // Email-only account + no explicit “stay signed in” intent → require password (signup confirm, Android/PWA, etc.).
  return true;
}

export type ConsumeEmailAuthRedirectResult =
  | { ok: true; passwordRecovery?: boolean; forceLoginAfterVerify?: boolean }
  | { ok: false; kind: "no_tokens" }
  | { ok: false; kind: "error" };

/**
 * Consumes `?code=`, `?token_hash` + `type`, or `#access_token` + `#refresh_token` from the
 * current URL and establishes a session. On success, strips auth params from the address bar
 * (keeps path only — read `next` etc. from the URL before calling).
 *
 * If email confirmation does not include `type=signup` in the URL, set Supabase redirect to
 * `.../auth/callback?flow=email_verify` so we can sign the user out and require password sign-in.
 */
export async function consumeEmailAuthRedirect(supabase: SupabaseClient): Promise<ConsumeEmailAuthRedirectResult> {
  const params = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.replace(/^#/, "");
  const hashParams = rawHash ? new URLSearchParams(rawHash) : new URLSearchParams();

  const hashHasSessionTokens = Boolean(hashParams.get("access_token") && hashParams.get("refresh_token"));
  const hashError = hashParams.get("error");
  if (hashError && !hashHasSessionTokens) {
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: false, kind: "error" };
  }

  const code = params.get("code");
  const searchError = params.get("error");
  if (searchError && !code) {
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: false, kind: "error" };
  }

  const intent = readAuthCallbackIntent();
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
    const forceLoginAfterVerify = extendForceLoginAfterVerify(
      intent,
      passwordRecovery,
      session,
      shouldForcePasswordLoginAfterVerify(intent, passwordRecovery),
    );
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery, forceLoginAfterVerify };
  }

  const token_hash = params.get("token_hash");
  const type = parseOtpType(params.get("type"));
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return { ok: false, kind: "error" };
    const passwordRecovery =
      type === "recovery" || isPasswordRecoverySession(data.session ?? null);
    const mergedIntent = { flow: intent.flow, otpType: type };
    const forceLoginAfterVerify = extendForceLoginAfterVerify(
      mergedIntent,
      passwordRecovery,
      data.session ?? null,
      shouldForcePasswordLoginAfterVerify(mergedIntent, passwordRecovery),
    );
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery, forceLoginAfterVerify };
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
    const hashType = parseOtpType(hp.get("type"));
    const mergedIntent = { flow: intent.flow, otpType: hashType ?? intent.otpType };
    const forceLoginAfterVerify = extendForceLoginAfterVerify(
      mergedIntent,
      passwordRecovery,
      data.session ?? null,
      shouldForcePasswordLoginAfterVerify(mergedIntent, passwordRecovery),
    );
    window.history.replaceState(null, "", window.location.pathname);
    return { ok: true, passwordRecovery, forceLoginAfterVerify };
  }

  return { ok: false, kind: "no_tokens" };
}
