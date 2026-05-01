"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { possessiveLabel, validatePasswordStrength } from "@/lib/auth/password-policy";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { logInviteeJoinedOrgActivityAction } from "./actions";

export default function SetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: sessionErr } = await supabase.auth.getUser();
      if (cancelled) return;
      if (sessionErr || !data.user) {
        setLoadError("Your invite link may have expired. Ask your admin to send a new invite, or sign in if you already have a password.");
        return;
      }
      const u = data.user;
      setEmail(u.email ?? null);
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const name = typeof meta?.invite_organization_name === "string" ? meta.invite_organization_name : null;
      setOrgName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const strength = validatePasswordStrength(password);
    if (strength) {
      setError(strength);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: upErr } = await supabase.auth.updateUser({
      password,
      data: { must_set_password: false },
    });
    setLoading(false);

    if (upErr) {
      setError(upErr.message);
      return;
    }

    try {
      await logInviteeJoinedOrgActivityAction();
    } catch {
      /* non-fatal: user can still enter app */
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const inviteLead =
    orgName && orgName.length > 0
      ? `${possessiveLabel(orgName)} admin has invited you to join the eazmybiz platform.`
      : "You’ve been invited to join the eazmybiz platform.";

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <h1 className="mb-2 text-2xl font-semibold">Invite link issue</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">{loadError}</p>
        <button
          type="button"
          className={primaryButtonMd}
          onClick={() => router.replace("/login")}
        >
          Go to sign in
        </button>
      </div>
    );
  }

  if (email === null && !loadError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">Complete your account</h1>
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        {inviteLead} Please sign up by choosing your own new password below.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Email</span>
          <input
            type="email"
            readOnly
            autoComplete="username"
            value={email ?? ""}
            className="cursor-not-allowed rounded-md border border-[var(--border)] bg-[var(--border)]/30 px-3 py-2 text-[var(--foreground)]"
          />
          <span className="text-xs leading-relaxed text-[var(--muted)]">
            Sign-in email cannot be changed. You can update your name and other details under Profile after you continue.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Choose new password</span>
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
          <span className="text-[var(--muted)]">Retype your password</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          />
        </label>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          Use at least 8 characters with at least one letter and one number.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={loading} className={primaryButtonMd}>
          {loading ? "Saving…" : "Continue to app"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        <button
          type="button"
          className="text-sky-600 underline"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          Sign out and use a different account
        </button>
      </p>
    </div>
  );
}
