"use client";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createStorageFromOptions } from "@supabase/ssr/dist/module/cookies";
import { isBrowser } from "@supabase/ssr/dist/module/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | undefined;

/**
 * Cookie-backed browser client (same storage model as `createBrowserClient` from `@supabase/ssr`).
 *
 * `detectSessionInUrl` must stay **false**: the SSR helper forces it to `true`, which exchanges
 * `?code=` on startup, drops password-recovery `redirectType`, and routes users to `/dashboard`.
 * PKCE is handled explicitly on `/auth/callback` and `/reset-password` via `consumeEmailAuthRedirect`.
 */
export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (isBrowser() && browserClient) return browserClient;

  const { storage } = createStorageFromOptions({ cookieEncoding: "base64url" }, false);

  const client = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: isBrowser(),
      detectSessionInUrl: false,
      persistSession: true,
      storage,
    },
  });

  if (isBrowser()) browserClient = client;
  return client;
}
