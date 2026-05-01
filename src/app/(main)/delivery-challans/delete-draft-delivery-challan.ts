"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";

export async function deleteDraftDeliveryChallan(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_delivery_challan", { p_id: id });
  if (error) throw error;
  revalidatePath("/delivery-challans");
  revalidatePath("/items");
  revalidatePath("/", "layout");
}
