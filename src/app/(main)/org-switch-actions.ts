"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/org";

async function userCanAccessOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const { data: m } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (m) return true;

  const { data: o } = await supabase.from("organizations").select("entitlement_id").eq("id", orgId).maybeSingle();
  const entId = o?.entitlement_id as string | undefined;
  if (!entId) return false;

  const { data: e } = await supabase
    .from("account_entitlements")
    .select("id")
    .eq("id", entId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  return !!e;
}

export async function setActiveOrganizationAction(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ok = await userCanAccessOrganization(supabase, user.id, orgId);
  if (!ok) {
    throw new Error("You cannot switch to that company.");
  }

  const jar = await cookies();
  jar.set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
  });

  revalidatePath("/", "layout");
}
