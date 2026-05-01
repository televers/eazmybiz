import { createClient } from "@/lib/supabase/server";
import { currentPeriodYmIst } from "@/lib/ist";
import { monthlyIssuedQuotaForPlan } from "@/lib/plan/entitlements";
import type { PlanTier } from "@/types/database";

export type UsageSummary = {
  periodYm: string;
  documentsUsed: number;
  /** `null` = unlimited (Max plan). */
  documentsLimit: number | null;
  gatePassesUsed: number;
  gatePassesLimit: number;
  visitorPassesUsed: number;
  visitorPassesLimit: number;
};

export async function getUsageSummary(
  organizationId: string,
  plan: PlanTier,
): Promise<UsageSummary> {
  const supabase = await createClient();
  const periodYm = currentPeriodYmIst();

  const { data: rows } = await supabase
    .from("usage_counters")
    .select("metric, count")
    .eq("organization_id", organizationId)
    .eq("period_ym", periodYm);

  const byMetric = new Map<string, number>();
  for (const r of rows ?? []) {
    byMetric.set(r.metric as string, r.count ?? 0);
  }

  return {
    periodYm,
    documentsUsed: byMetric.get("documents_combined") ?? 0,
    documentsLimit: monthlyIssuedQuotaForPlan(plan, "documents_combined"),
    gatePassesUsed: byMetric.get("gate_passes") ?? 0,
    gatePassesLimit: monthlyIssuedQuotaForPlan(plan, "gate_passes") ?? 0,
    visitorPassesUsed: byMetric.get("visitor_passes") ?? 0,
    visitorPassesLimit: monthlyIssuedQuotaForPlan(plan, "visitor_passes") ?? 0,
  };
}
