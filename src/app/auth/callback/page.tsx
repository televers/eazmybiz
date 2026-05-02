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
import { consumeEmailAuthRedirect } from "@/lib/auth/consume-email-auth-redirect";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
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

      const result = await consumeEmailAuthRedirect(supabase);
      if (cancelled) return;

      if (result.ok) {
        const dest = result.passwordRecovery ? "/reset-password" : next;
        router.replace(dest);
        router.refresh();
        return;
      }

      if (result.kind === "no_tokens") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace(next);
          router.refresh();
          return;
        }
      }

      fail();
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
