"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { getClientAuthOrigin } from "@/lib/auth/site-origin-client";
import { createClient } from "@/lib/supabase/client";
import { AuthTurnstile } from "@/components/auth/auth-turnstile";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { isTurnstileConfigured } from "@/lib/captcha/turnstile-site-key";

export default function ForgotPasswordPage() {
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
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
    const origin = getClientAuthOrigin();
    /** Single-path redirect_to — nested `?next=` on `/auth/callback` is often stripped by email providers / Supabase. */
    const redirectTo = `${origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
      ...(captchaRequired && captchaToken ? { captchaToken } : {}),
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-[var(--muted)]">
          If an account exists for <span className="font-medium text-[var(--foreground)]">{email}</span>, we sent a link
          to reset your password. The link expires after a short time.
        </p>
        <p className="mt-4 text-sm text-[var(--muted)]">
          <Link href="/login" className="text-sky-600 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Forgot password</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>
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
        <AuthTurnstile turnstileRef={turnstileRef} onTokenChange={onCaptchaToken} className="flex justify-center py-1" />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || (captchaRequired && !captchaToken)}
          className={primaryButtonMd}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/login" className="text-sky-600 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
