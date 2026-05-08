import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTier } from "@/types/database";

function tierRank(p: PlanTier): number {
  if (p === "free") return 0;
  if (p === "pro") return 1;
  return 2;
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** Inclusive IST calendar-day span for one payment is 365 days (day 1 … day 365). */
const NEW_PAID_TERM_UTC_DAY_OFFSET = 364;

/** Stack another 365 inclusive days after `existingEnd` (last day of prior term). */
const EXTEND_SAME_TIER_UTC_DAY_OFFSET = 365;

function maxCompaniesForPaidTier(plan: "pro" | "max"): number {
  return plan === "pro" ? 2 : 5;
}

/**
 * After Cashfree marks a subscription `paid`, align entitlement + all linked orgs with `target_plan`
 * and billing period (365-day rules; Pro to Max upgrade starts a new 365-day Max period from payment).
 */
export async function fulfillPaidInrSubscription(
  admin: SupabaseClient,
  input: { entitlementId: string; targetPlan: "pro" | "max" },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: ent, error: entErr } = await admin
    .from("account_entitlements")
    .select("id, plan, plan_period_start, plan_period_end")
    .eq("id", input.entitlementId)
    .maybeSingle();

  if (entErr) return { ok: false, message: entErr.message };
  if (!ent) return { ok: false, message: "entitlement not found" };

  const current = ent.plan as PlanTier;
  const target = input.targetPlan;
  const now = new Date();
  const existingStart = ent.plan_period_start ? new Date(ent.plan_period_start as string) : null;
  const existingEnd = ent.plan_period_end ? new Date(ent.plan_period_end as string) : null;
  const hasFutureEnd = !!existingEnd && existingEnd > now;
  const onPaidTier = tierRank(current) > 0;

  let planStart: Date;
  let planEnd: Date;

  if (current === "pro" && target === "max" && hasFutureEnd) {
    planStart = now;
    planEnd = addUtcDays(now, NEW_PAID_TERM_UTC_DAY_OFFSET);
  } else if (tierRank(target) > tierRank(current) && onPaidTier && hasFutureEnd) {
    planStart = existingStart ?? now;
    planEnd = existingEnd;
  } else if (tierRank(target) === tierRank(current) && hasFutureEnd) {
    planStart = existingStart ?? now;
    planEnd = addUtcDays(existingEnd, EXTEND_SAME_TIER_UTC_DAY_OFFSET);
  } else {
    planStart = now;
    planEnd = addUtcDays(now, NEW_PAID_TERM_UTC_DAY_OFFSET);
  }

  const maxCompanies = maxCompaniesForPaidTier(target);
  const isoStart = planStart.toISOString();
  const isoEnd = planEnd.toISOString();
  const touchedAt = new Date().toISOString();

  const { error: aeErr } = await admin
    .from("account_entitlements")
    .update({
      plan: target,
      max_companies: maxCompanies,
      plan_period_start: isoStart,
      plan_period_end: isoEnd,
      updated_at: touchedAt,
    })
    .eq("id", input.entitlementId);

  if (aeErr) return { ok: false, message: aeErr.message };

  const { error: orgErr } = await admin
    .from("organizations")
    .update({
      plan: target,
      plan_period_start: isoStart,
      plan_period_end: isoEnd,
    })
    .eq("entitlement_id", input.entitlementId);

  if (orgErr) return { ok: false, message: orgErr.message };

  return { ok: true };
}
