import type { PlanTier } from "@/types/database";

export function poweredByLine(plan: PlanTier | null | undefined): string | null {
  if (!plan || plan === "free") {
    return "Powered by eazmybiz";
  }
  return null;
}
