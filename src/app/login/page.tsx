"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { AuthTurnstile } from "@/components/auth/auth-turnstile";
import { EazmybizLockupLogo } from "@/components/brand/eazmybiz-lockup-logo";
import { LegalFooter } from "@/components/legal/legal-footer";
import { isTurnstileConfigured } from "@/lib/captcha/turnstile-site-key";
import { primaryButtonMd } from "@/lib/ui/primary-button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authCallbackError = searchParams.get("error") === "auth_callback";
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const captchaRequired = isTurnstileConfigured();

  const onCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      setError(signError.message);
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
        {authCallbackError ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            That invite, sign-in, or password reset link is invalid, expired, or already used. Ask for a new team invite
            or try password reset from this page.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Email</span>
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
          <AuthTurnstile turnstileRef={turnstileRef} onTokenChange={onCaptchaToken} className="flex justify-center py-1" />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || (captchaRequired && !captchaToken)}
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
