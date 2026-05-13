import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError, type User } from "@supabase/supabase-js";

const publicPaths = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/set-password",
  "/terms",
  "/refund-policy",
  "/privacy",
  "/pricing",
]);

function mustSetPasswordFromInvite(user: User | null): boolean {
  if (!user?.user_metadata || typeof user.user_metadata !== "object") return false;
  return (user.user_metadata as Record<string, unknown>).must_set_password === true;
}

function isProtectedPath(pathname: string) {
  if (publicPaths.has(pathname)) return false;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  /**
   * Secured by CRON_SECRET + service role on the handler; no session cookie.
   * Skipping auth here avoids redirect-to-/login (and POST→405 on /login) for cron and CLI pings.
   * Match with or without trailing slash so we never send this path through session checks.
   */
  const keepAlivePath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;
  if (keepAlivePath === "/api/supabase/keep-alive") {
    return NextResponse.next();
  }
  if (keepAlivePath === "/api/webhooks/cashfree") {
    return NextResponse.next();
  }
  if (keepAlivePath === "/api/webhooks/razorpay") {
    return NextResponse.next();
  }
  /**
   * Supabase often redirects PKCE links to **Site URL** only (e.g. /?code=...).
   * Forward to /auth/callback so the client can exchange the code (recovery, invite, OAuth).
   */
  if (
    pathname === "/" &&
    (request.nextUrl.searchParams.has("code") ||
      request.nextUrl.searchParams.has("token_hash") ||
      request.nextUrl.searchParams.has("error"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && !isAuthSessionMissingError(error)) {
      console.error("[middleware] Supabase auth getUser error:", error.message);
    }
    user = data.user ?? null;
  } catch (e) {
    console.error("[middleware] Supabase auth getUser failed (network or Edge fetch):", e);
  }

  if (user && mustSetPasswordFromInvite(user)) {
    const allowed =
      pathname === "/auth/set-password" ||
      pathname === "/auth/callback" ||
      pathname.startsWith("/auth/callback");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/set-password";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")) {
    const url = request.nextUrl.clone();
    url.pathname = mustSetPasswordFromInvite(user) ? "/auth/set-password" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip all Next internals under /_next/ (static chunks, HMR, image optimizer, etc.).
     * A broad `_next/` prefix also skips odd paths like /_next//_next/static/... from bad
     * chunk URLs so middleware never runs on those requests (avoids wrong responses / redirects).
     */
    "/((?!_next/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
