"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { AuthTurnstile } from "@/components/auth/auth-turnstile";
import { EazmybizLockupLogo } from "@/components/brand/eazmybiz-lockup-logo";
import { LegalFooter } from "@/components/legal/legal-footer";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import { isTurnstileConfigured } from "@/lib/captcha/turnstile-site-key";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export default function SignupPage() {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    const strength = validatePasswordStrength(password);
    if (strength) {
      setError(strength);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError("Please complete the human verification step.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signUp({
      email: email.trim(),
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
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <div className="flex flex-1 flex-col justify-center py-8">
        <EazmybizLockupLogo className="mb-8" />
        <h1 className="mb-2 text-2xl font-semibold">Create account</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Create your eazmybiz account, then set up your company on the next step.
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
            <span className="text-xs leading-relaxed text-[var(--muted)]">
              This email is your sign-in ID and cannot be changed later.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Choose password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Retype password</span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            />
          </label>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Use at least 8 characters with at least one letter and one number.
          </p>
          <AuthTurnstile turnstileRef={turnstileRef} onTokenChange={onCaptchaToken} className="flex justify-center py-1" />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || (captchaRequired && !captchaToken)}
            className={primaryButtonMd}
          >
            {loading ? "Creating…" : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-600 underline">
            Sign in
          </Link>
        </p>
      </div>
      <LegalFooter showOperator={false} showPwaBanner className="-mx-4 shrink-0" />
    </div>
  );
}
