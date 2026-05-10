"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { AuthTurnstile } from "@/components/auth/auth-turnstile";
import { EazmybizLockupLogo } from "@/components/brand/eazmybiz-lockup-logo";
import { LegalFooter } from "@/components/legal/legal-footer";
import { isTurnstileConfigured } from "@/lib/captcha/turnstile-site-key";
import { authCaptchaRequiredButMissing } from "@/lib/captcha/auth-captcha-required";
import { primaryButtonMd } from "@/lib/ui/primary-button";

function userFacingSignInError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("that invite") ||
    m.includes("invite, sign-in, or password reset") ||
    m.includes("ask for a new team invite") ||
    m.includes("password reset link is invalid") ||
    m.includes("email link is invalid or has expired")
  ) {
    return "That email link could not be used again. It may have expired, been used already, or opened by your email app. Sign in with your email and password, or use Forgot password if you need a fresh link.";
  }
  return message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const notice = searchParams.get("notice");
  const rawOauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");
  /** `replaceState` does not sync `useSearchParams`; set when we strip Supabase OAuth noise. */
  const [thanksAfterUrlCleanup, setThanksAfterUrlCleanup] = useState(false);
  /** After email confirmation (includes reused / scanned links): thank user and sign in — never raw Supabase errors. */
  const thanksVerifyNotice =
    notice !== "confirm_email" &&
    (thanksAfterUrlCleanup ||
      notice === "email_verified" ||
      notice === "stale_auth_link" ||
      rawOauthError === "auth_callback" ||
      Boolean(oauthErrorDescription));
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const captchaRequired = isTurnstileConfigured();
  const captchaBlockedDeployment = authCaptchaRequiredButMissing();

  const onCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams;
    const hadOAuthNoise =
      p.has("error_description") || p.has("error_code") || p.has("error");
    if (!hadOAuthNoise) return;
    if (!p.get("notice")) {
      p.set("notice", "email_verified");
    }
    p.delete("error_description");
    p.delete("error_code");
    p.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setThanksAfterUrlCleanup(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (captchaBlockedDeployment) {
      setError("Human verification is not configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY on the server.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError("Please complete the human verification step.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaRequired && captchaToken ? { options: { captchaToken } } : {}),
    });
    setLoading(false);
    if (signError) {
      setError(userFacingSignInError(signError.message));
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <div className="flex flex-1 flex-col justify-center py-8">
        <EazmybizLockupLogo className="mb-8" />
        <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
        {notice === "confirm_email" ? (
          <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
            <span className="font-medium">Confirm your email to start using eazmybiz.</span> We sent a link to your inbox.
            Open it to verify, then sign in below with the same email and password you chose.
          </p>
        ) : null}
        {thanksVerifyNotice ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            <span className="font-medium">Thanks for confirming your email.</span> Sign in now with your email and password
            to start using eazmybiz.
          </p>
        ) : null}
        {captchaBlockedDeployment ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            Turnstile is required in production. Add <span className="font-mono text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</span> in
            your hosting environment (and enable CAPTCHA in Supabase Auth).
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Email (sign-in ID)</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between gap-2 text-[var(--muted)]">
              <span>Password</span>
              <Link href="/forgot-password" className="text-xs font-normal text-sky-600 hover:underline">
                Forgot password?
              </Link>
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            />
          </label>
          {captchaRequired ? (
            <>
              <p className="text-xs font-medium text-[var(--foreground)]">Human verification</p>
              <AuthTurnstile turnstileRef={turnstileRef} onTokenChange={onCaptchaToken} className="flex justify-center py-1" />
            </>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || captchaBlockedDeployment || (captchaRequired && !captchaToken)}
            className={primaryButtonMd}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[var(--muted)]">
          No account?{" "}
          <Link href="/signup" className="text-sky-600 underline">
            Create one
          </Link>
        </p>
      </div>
      <LegalFooter showOperator={false} showPwaBanner className="-mx-4 shrink-0" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
