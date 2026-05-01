import type { SupabaseClient } from "@supabase/supabase-js";

/** Ensures `partyId` belongs to `organizationId`. Returns null when input is null/empty. */
export async function resolvePartyIdForDocument(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string | null | undefined,
): Promise<string | null> {
  if (partyId == null || String(partyId).trim() === "") return null;
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", partyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Party not found");
  return data.id as string;
}
