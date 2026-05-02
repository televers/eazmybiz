"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { consumeEmailAuthRedirect } from "@/lib/auth/consume-email-auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const result = await consumeEmailAuthRedirect(supabase);
      if (cancelled) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setReady(true);
      setHasSession(!!session);
      if (!session) {
        setError(
          !result.ok && result.kind === "error"
            ? "This reset link is invalid, expired, or already used. Request a new one from the sign-in page."
            : "This link is invalid or has expired. Request a new reset from the sign-in page.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <p className="text-sm text-[var(--muted)]">Opening your reset link…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">Choose a strong password for your account.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !hasSession}
          className={primaryButtonMd}
        >
          {loading ? "Saving…" : "Update password"}
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
