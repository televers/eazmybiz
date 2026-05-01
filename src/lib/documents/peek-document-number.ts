"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import type { DocumentNumberingDocKind } from "@/lib/documents/document-numbering";

export async function peekDocumentNumber(input: {
  docType: DocumentNumberingDocKind;
  referenceYmd: string;
  /** When multi-series is off, pass null so the RPC uses org defaults. */
  seriesSlot: number | null;
}): Promise<string> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: input.docType,
    p_reference_ymd: input.referenceYmd,
    p_series_slot: input.seriesSlot,
  });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}
