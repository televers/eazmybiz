#!/usr/bin/env node
/**
 * Ping the deployed keep-alive API (use in GitHub Actions, system cron, etc.).
 *
 * Env:
 *   KEEPALIVE_URL — full URL, e.g. https://your-app.vercel.app/api/supabase/keep-alive
 *   CRON_SECRET   — must match the server CRON_SECRET
 *
 * If unset in the shell, loads `.env.local` from the repo root (same as Next.js), so
 * `npm run cron:keepalive` works locally. CI should set these in the workflow env.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.KEEPALIVE_URL?.trim();
const secret = process.env.CRON_SECRET?.trim();

if (!url || !secret) {
  console.error("Set KEEPALIVE_URL and CRON_SECRET.");
  process.exit(1);
}

/** Normalize trailing slash so the first hop isn’t a 307 to `/api/.../keep-alive` (fetch would stop with redirect: "manual"). */
let requestUrl = url;
try {
  const u = new URL(url);
  if (u.pathname.endsWith("/") && u.pathname !== "/") {
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    requestUrl = u.toString();
  }
} catch {
  /* use url as-is */
}

let res;
try {
  res = await fetch(requestUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
    redirect: "follow",
  });
} catch (err) {
  const c = err?.cause;
  const refused =
    c?.code === "ECONNREFUSED" ||
    err?.code === "ECONNREFUSED" ||
    (Array.isArray(c?.errors) && c.errors.some((e) => e?.code === "ECONNREFUSED"));
  if (refused) {
    console.error(
      "Nothing is listening on that host/port (ECONNREFUSED). For a localhost KEEPALIVE_URL, run `npm run dev` in another terminal first, then run this script again.",
    );
  } else {
    console.error(err?.message ?? err);
  }
  process.exit(1);
}

const text = await res.text();
console.log(res.status, text);

let success = res.ok;
if (success) {
  try {
    const body = JSON.parse(text);
    success = body?.ok === true;
  } catch {
    success = false;
  }
}
if (!success) {
  console.error(
    "Expected JSON { ok: true }. Start `npm run dev` if KEEPALIVE_URL is localhost, deploy middleware if production.",
  );
}
process.exit(success ? 0 : 1);
