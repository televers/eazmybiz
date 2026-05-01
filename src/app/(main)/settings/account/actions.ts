"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { countOrganizationsForEntitlement } from "@/lib/plan/entitlements";

export async function createCompanyAction(name: string) {
  const ctx = await getOrgContext();
  if (!ctx?.isMasterAdmin || !ctx.entitlement) {
    throw new Error("Only the account owner can create companies.");
  }

  const supabase = await createClient();
  const n = await countOrganizationsForEntitlement(supabase, ctx.entitlement.id);
  if (n >= ctx.entitlement.max_companies) {
    throw new Error("You have reached the company limit for your plan.");
  }

  const { data, error } = await supabase.rpc("create_company_for_account", {
    p_name: name.trim() || "New company",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/account");
  revalidatePath("/", "layout");
  return data as string;
}
