"use client";

/**
 * Invite / magic-link / recovery land here after Supabase redirects.
 * We handle auth in the browser because redirects may use:
 * - `?code=` (PKCE) — exchangeCodeForSession
 * - `?token_hash=&type=` — verifyOtp (common for invite / email links)
 * - `#access_token=&refresh_token=` — implicit flow (hash is never sent to a Route Handler)
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "recovery",
  "invite",
  "email_change",
  "email",
  "magiclink",
]);

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function parseOtpType(s: string | null): EmailOtpType | null {
  if (!s) return null;
  const t = s as EmailOtpType;
  return OTP_TYPES.has(t) ? t : null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"));

      const fail = () => {
        if (cancelled) return;
        router.replace("/login?error=auth_callback");
      };

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!error) {
          router.replace(next);
          router.refresh();
          return;
        }
        fail();
        return;
      }

      const token_hash = params.get("token_hash");
      const type = parseOtpType(params.get("type"));
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (cancelled) return;
        if (!error) {
          router.replace(next);
          router.refresh();
          return;
        }
        fail();
        return;
      }

      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hp.get("access_token");
      const refresh_token = hp.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (!error) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          router.replace(next);
          router.refresh();
          return;
        }
      }

      if (params.get("error")) {
        if (!cancelled) fail();
        return;
      }

      if (!cancelled) fail();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-center text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}
