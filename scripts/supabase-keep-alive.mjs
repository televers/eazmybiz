#!/usr/bin/env node
/**
 * Ping the deployed keep-alive API (use in GitHub Actions, system cron, etc.).
 *
 * Env:
 *   KEEPALIVE_URL — full URL, e.g. https://your-app.vercel.app/api/supabase/keep-alive
 *   CRON_SECRET   — must match the server CRON_SECRET
 */

const url = process.env.KEEPALIVE_URL?.trim();
const secret = process.env.CRON_SECRET?.trim();

if (!url || !secret) {
  console.error("Set KEEPALIVE_URL and CRON_SECRET.");
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
console.log(res.status, text);
process.exit(res.ok ? 0 : 1);
