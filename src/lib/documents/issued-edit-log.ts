import type { createClient } from "@/lib/supabase/server";

export type IssuedDocKind = "packing_list" | "quotation";

export async function insertIssuedDocumentEditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    organizationId: string;
    docKind: IssuedDocKind;
    documentId: string;
    editedByUserId: string;
    editedByDisplayName: string | null;
  },
) {
  const { error } = await supabase.from("issued_document_edit_log").insert({
    organization_id: input.organizationId,
    doc_kind: input.docKind,
    document_id: input.documentId,
    edited_by_user_id: input.editedByUserId,
    edited_by_display_name: input.editedByDisplayName,
  });
  if (error) throw error;
}

export async function fetchIssuedDocumentEditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  docKind: IssuedDocKind,
  documentId: string,
): Promise<
  { edited_at: string; edited_by_display_name: string | null; edited_by_user_id: string }[]
> {
  const { data, error } = await supabase
    .from("issued_document_edit_log")
    .select("edited_at, edited_by_display_name, edited_by_user_id")
    .eq("organization_id", organizationId)
    .eq("doc_kind", docKind)
    .eq("document_id", documentId)
    .order("edited_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as {
    edited_at: string;
    edited_by_display_name: string | null;
    edited_by_user_id: string;
  }[];
}

export async function profileDisplayNameForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const n = (data as { display_name?: string | null } | null)?.display_name?.trim();
  return n || null;
}
