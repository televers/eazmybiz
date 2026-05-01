"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { normalizePackingListTemplateForSave } from "@/lib/packing/packing-list-templates";
import type { PackingListTemplateId, PackingPackage, PartySnapshot } from "@/lib/packing/types";
import { appendPartyShipAddressToNextSlot, upsertPartyFromDocument } from "@/app/(main)/parties/actions";
import type { SavePartyFlags } from "@/lib/parties/save-flags";
import { resolvePartyIdForDocument } from "@/lib/parties/validate-party-id";
import { materializePackingPackagesForSave } from "@/lib/items/materialize-document-lines";
import { partySnapshotWithGstinNormalized } from "@/lib/tax/gstin-india";
import { orgCalendarTodayYmd } from "@/lib/dates/org-calendar";
import {
  assertOptionalDocumentDateWithinBackdatePolicy,
  assertOptionalDocumentYmdNotFuture,
  notifyDocumentBackdateIfNeeded,
} from "@/lib/documents/document-date-backdate-policy";
import {
  clampSeriesSlotValue,
  effectiveSeriesSlotForDocKind,
  maxDocumentSeriesSlots,
  parseAllocatedDocumentSerial,
  referenceYmdForDocNumber,
  resolvedSeriesSlotForDocCreate,
} from "@/lib/documents/document-numbering";
import { partyFromJson } from "@/lib/packing/parse";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { matchPartyIdFromBillSnapshot } from "@/lib/parties/match-party-from-bill";
import { canEditIssuedDocument, ISSUED_EDIT_CLOSED_MESSAGE } from "@/lib/documents/issued-edit-window";
import {
  insertIssuedDocumentEditLog,
  profileDisplayNameForUser,
} from "@/lib/documents/issued-edit-log";

function normalizePackages(packages: PackingPackage[]): PackingPackage[] {
  return packages.map((p, i) => ({ ...p, package_no: i + 1 }));
}

function validatePayload(packages: PackingPackage[]) {
  if (!packages.length) throw new Error("Add at least one package");
  for (const pkg of packages) {
    if (!pkg.lines?.length) throw new Error("Each package needs at least one line");
    for (const line of pkg.lines) {
      if (!line.description?.trim()) throw new Error("Each line needs an item / product / service name");
      if (!line.unit?.trim()) throw new Error("Each line needs a unit");
    }
  }
}

export async function createPackingList(input: {
  template: PackingListTemplateId;
  invoice_no?: string;
  document_date: string | null;
  bill_to: PartySnapshot;
  ship_to: PartySnapshot;
  packages: PackingPackage[];
  notes?: string;
  /** Resolved server-side; must belong to org when set. */
  party_id?: string | null;
  party_save?: SavePartyFlags;
  /** When true, append `ship_to` to the linked party’s next free shipping slot (draft only; client-guarded). */
  append_ship_address_to_linked_party?: boolean;
  series_slot?: number | null;
}) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  assertOptionalDocumentDateWithinBackdatePolicy(input.document_date, ctx);

  validatePayload(input.packages);
  const bill_to = partySnapshotWithGstinNormalized(input.bill_to);
  const ship_to = partySnapshotWithGstinNormalized(input.ship_to);
  const supabase = await createClient();
  const pkgs = await materializePackingPackagesForSave(
    supabase,
    ctx.organization.id,
    normalizePackages(input.packages),
  );

  const template = normalizePackingListTemplateForSave(ctx.organization.plan, input.template);

  let partyId: string | null = await resolvePartyIdForDocument(
    supabase,
    ctx.organization.id,
    input.party_id,
  );
  if (
    input.party_save &&
    (input.party_save.save_bill || input.party_save.save_ship || input.party_save.bill_and_ship_same)
  ) {
    partyId = await upsertPartyFromDocument({
      party_display_name: input.party_save.party_display_name,
      bill_to,
      ship_to,
      save_bill: input.party_save.save_bill,
      save_ship: input.party_save.save_ship,
      bill_and_ship_same: input.party_save.bill_and_ship_same,
    });
  }

  if (input.append_ship_address_to_linked_party && partyId) {
    await appendPartyShipAddressToNextSlot(partyId, ship_to);
  }

  const refYmd = referenceYmdForDocNumber(input.document_date, ctx.organization);
  const resolvedSlot = resolvedSeriesSlotForDocCreate(ctx.organization, "pl", input.series_slot);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "pl",
    p_reference_ymd: refYmd,
    p_series_slot: resolvedSlot,
  });
  if (nErr) throw nErr;

  const { data, error } = await supabase
    .from("packing_lists")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      numbering_series_slot: resolvedSlot,
      template,
      invoice_no: input.invoice_no?.trim() || null,
      document_date: input.document_date || null,
      bill_to,
      ship_to,
      packages: pkgs,
      notes: input.notes?.trim() || null,
      party_id: partyId,
    })
    .select("id")
    .single();

  if (error) throw error;

  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: undefined,
    nextDocumentDate: input.document_date,
    docKind: "packing_list",
    docNumber: docNo as string,
    isCreate: true,
  });

  revalidatePath("/packing-lists");
  revalidatePath("/items");
  return { id: data.id as string, party_id: partyId };
}

export async function updatePackingList(
  id: string,
  input: {
    template: PackingListTemplateId;
    invoice_no?: string;
    document_date: string | null;
    bill_to: PartySnapshot;
    ship_to: PartySnapshot;
    packages: PackingPackage[];
    notes?: string;
    party_id?: string | null;
    party_save?: SavePartyFlags;
    append_ship_address_to_linked_party?: boolean;
    series_slot?: number | null;
  },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  validatePayload(input.packages);
  const bill_to = partySnapshotWithGstinNormalized(input.bill_to);
  const ship_to = partySnapshotWithGstinNormalized(input.ship_to);
  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from("packing_lists")
    .select("status, issued_at, document_date, doc_number, numbering_series_slot")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (exErr) throw exErr;
  if (!existing) throw new Error("Not found");
  if (
    existing.status === "issued" &&
    existing.issued_at &&
    !canEditIssuedDocument(existing.issued_at as string)
  ) {
    throw new Error(ISSUED_EDIT_CLOSED_MESSAGE);
  }

  if (existing.status === "draft") {
    assertOptionalDocumentDateWithinBackdatePolicy(input.document_date, ctx);
  } else {
    assertOptionalDocumentYmdNotFuture(input.document_date, ctx);
  }

  const pkgs = await materializePackingPackagesForSave(
    supabase,
    ctx.organization.id,
    normalizePackages(input.packages),
  );

  const template = normalizePackingListTemplateForSave(ctx.organization.plan, input.template);

  let partyId: string | null = await resolvePartyIdForDocument(
    supabase,
    ctx.organization.id,
    input.party_id,
  );
  if (
    input.party_save &&
    (input.party_save.save_bill || input.party_save.save_ship || input.party_save.bill_and_ship_same)
  ) {
    partyId = await upsertPartyFromDocument({
      party_display_name: input.party_save.party_display_name,
      bill_to,
      ship_to,
      save_bill: input.party_save.save_bill,
      save_ship: input.party_save.save_ship,
      bill_and_ship_same: input.party_save.bill_and_ship_same,
    });
  }

  if (input.append_ship_address_to_linked_party && partyId) {
    await appendPartyShipAddressToNextSlot(partyId, ship_to);
  }

  const plan = ctx.organization.plan;
  const maxSlots = maxDocumentSeriesSlots(plan);
  const exRow = existing as {
    numbering_series_slot?: number | null;
    doc_number?: string;
    document_date?: string | null;
  };
  const prevSlot =
    exRow.numbering_series_slot != null
      ? clampSeriesSlotValue(Number(exRow.numbering_series_slot), maxSlots)
      : effectiveSeriesSlotForDocKind(ctx.organization, "pl");
  const newSlotRequested =
    input.series_slot != null && plan !== "free" && ctx.organization.doc_multi_series_enabled
      ? clampSeriesSlotValue(input.series_slot, maxSlots)
      : prevSlot;

  let docNumberPatch: string | undefined;
  let seriesSlotPatch: number | undefined;

  if (
    existing.status === "draft" &&
    plan !== "free" &&
    ctx.organization.doc_multi_series_enabled &&
    newSlotRequested !== prevSlot
  ) {
    const serial = parseAllocatedDocumentSerial(String(exRow.doc_number ?? ""));
    if (serial == null) throw new Error("Could not read this draft’s document number.");
    const releaseRef = referenceYmdForDocNumber(exRow.document_date, ctx.organization);
    const { error: relErr } = await supabase.rpc("release_document_sequence_if_last", {
      p_org_id: ctx.organization.id,
      p_doc_type: "pl",
      p_reference_ymd: releaseRef,
      p_row_series_slot: prevSlot,
      p_allocated_serial: serial,
    });
    if (relErr) throw relErr;

    const newRef = referenceYmdForDocNumber(input.document_date, ctx.organization);
    const { data: newNo, error: nErr } = await supabase.rpc("next_document_number", {
      p_org_id: ctx.organization.id,
      p_doc_type: "pl",
      p_reference_ymd: newRef,
      p_series_slot: newSlotRequested,
    });
    if (nErr) throw nErr;
    docNumberPatch = newNo as string;
    seriesSlotPatch = newSlotRequested;
  }

  const patch: Record<string, unknown> = {
    template,
    invoice_no: input.invoice_no?.trim() || null,
    document_date: input.document_date || null,
    bill_to,
    ship_to,
    packages: pkgs,
    notes: input.notes?.trim() || null,
    party_id: partyId,
    updated_at: new Date().toISOString(),
  };
  if (docNumberPatch != null) {
    patch.doc_number = docNumberPatch;
    patch.numbering_series_slot = seriesSlotPatch;
  }

  const { error } = await supabase
    .from("packing_lists")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .in("status", ["draft", "issued"]);

  if (error) throw error;

  const ex = existing as { document_date?: string | null; doc_number?: string };
  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: ex.document_date,
    nextDocumentDate: input.document_date,
    docKind: "packing_list",
    docNumber: docNumberPatch ?? String(ex.doc_number ?? ""),
    isCreate: false,
  });

  if (existing.status === "issued") {
    const displayName =
      (await profileDisplayNameForUser(supabase, ctx.userId)) ?? ctx.userEmail?.trim() ?? null;
    await insertIssuedDocumentEditLog(supabase, {
      organizationId: ctx.organization.id,
      docKind: "packing_list",
      documentId: id,
      editedByUserId: ctx.userId,
      editedByDisplayName: displayName,
    });
  }

  revalidatePath("/packing-lists");
  revalidatePath(`/packing-lists/${id}`);
  revalidatePath(`/packing-lists/${id}/edit`);
  revalidatePath(`/packing-lists/${id}/print`);
  revalidatePath("/items");
  return { party_id: partyId };
}

export async function deleteDraftPackingList(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_packing_list", { p_id: id });
  if (error) throw error;
  revalidatePath("/packing-lists");
  revalidatePath("/items");
  revalidatePath("/", "layout");
}

export async function duplicatePackingList(
  sourceId: string,
  input?: { series_slot?: number | null },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: src, error: sErr } = await supabase
    .from("packing_lists")
    .select("*")
    .eq("id", sourceId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (sErr || !src) throw new Error("Not found");

  const dupDate = orgCalendarTodayYmd(ctx.organization);
  const srcSlot = (src as { numbering_series_slot?: number | null }).numbering_series_slot;
  const dupSlot =
    input?.series_slot != null
      ? resolvedSeriesSlotForDocCreate(ctx.organization, "pl", input.series_slot)
      : resolvedSeriesSlotForDocCreate(ctx.organization, "pl", srcSlot ?? undefined);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "pl",
    p_reference_ymd: referenceYmdForDocNumber(dupDate, ctx.organization),
    p_series_slot: dupSlot,
  });
  if (nErr) throw nErr;

  const row = src as Record<string, unknown>;
  const template = normalizePackingListTemplateForSave(ctx.organization.plan, String(row.template ?? "basic"));

  let partyId = (row.party_id as string | null) ?? null;
  if (!partyId) {
    const docBill = partyFromJson(row.bill_to);
    if (docBill.name.trim()) {
      const parties = await loadPartiesWithAddresses(ctx.organization.id);
      partyId = matchPartyIdFromBillSnapshot(docBill, parties);
    }
  }

  const { data, error } = await supabase
    .from("packing_lists")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      numbering_series_slot: dupSlot,
      status: "draft",
      issued_at: null,
      template,
      invoice_no: (row.invoice_no as string | null) ?? null,
      document_date: dupDate,
      bill_to: row.bill_to,
      ship_to: row.ship_to,
      packages: row.packages,
      notes: (row.notes as string | null) ?? null,
      party_id: partyId,
    })
    .select("id")
    .single();

  if (error) throw error;
  const newId = data.id as string;
  revalidatePath("/packing-lists");
  revalidatePath(`/packing-lists/${newId}`);
  revalidatePath(`/packing-lists/${newId}/edit`);
  revalidatePath(`/packing-lists/${newId}/print`);
  revalidatePath("/items");
  revalidatePath("/parties", "layout");
  return { id: newId };
}

export async function issuePackingList(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const supabase = await createClient();
  const { data: plRow, error: plErr } = await supabase
    .from("packing_lists")
    .select("document_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (plErr) throw plErr;
  if (!plRow) return { ok: false as const, error: "Not found" };
  try {
    assertOptionalDocumentDateWithinBackdatePolicy(
      (plRow as { document_date?: string | null }).document_date,
      ctx,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid document date";
    return { ok: false as const, error: msg };
  }

  const { data, error } = await supabase.rpc("issue_packing_list", { p_id: id });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Could not issue" };
  }
  revalidatePath("/packing-lists");
  revalidatePath(`/packing-lists/${id}`);
  return { ok: true as const };
}
