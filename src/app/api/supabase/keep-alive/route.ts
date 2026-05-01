import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Wakes the Supabase project (DB + API) on a schedule so free-tier / inactive projects are less likely to pause.
 *
 * Setup:
 * - Set `CRON_SECRET` to a long random string (hosting + local if you run the script).
 * - Call on a schedule (e.g. every 1–3 days): `GET` or `POST` with header `Authorization: Bearer <CRON_SECRET>`
 *   or query `?secret=<CRON_SECRET>` (prefer the header — query strings can appear in logs).
 * - Requires `SUPABASE_SERVICE_ROLE_KEY` on the server (same as other admin flows).
 *
 * Vercel Cron: add a cron pointing at this path and define `CRON_SECRET` in project env; Vercel can send it as Bearer.
 * GitHub Actions / others: use `scripts/supabase-keep-alive.mjs` or `curl` with the same header.
 */
function handleKeepAlive(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return Promise.resolve(
      NextResponse.json(
        {
          ok: false,
          error:
            "Set CRON_SECRET (at least 16 characters) in the server environment before using this endpoint.",
        },
        { status: 503 },
      ),
    );
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? null;
  if (bearer !== secret && querySecret !== secret) {
    return Promise.resolve(NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }));
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return Promise.resolve(
      NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured on this host." },
        { status: 503 },
      ),
    );
  }

  return (async () => {
    const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  })();
}

export function GET(req: Request) {
  return handleKeepAlive(req);
}

export function POST(req: Request) {
  return handleKeepAlive(req);
}
