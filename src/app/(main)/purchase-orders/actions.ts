"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { upsertPartyBillOnly } from "@/app/(main)/parties/actions";
import { appendOrgShipAddressFromDocument } from "@/lib/org-ship-addresses/actions";
import type { SavePartyFlags } from "@/lib/parties/save-flags";
import { resolvePartyIdForDocument } from "@/lib/parties/validate-party-id";
import type { PartySnapshot } from "@/lib/packing/types";
import type { QuotationLine } from "@/lib/quotation/types";
import { partySnapshotWithGstinNormalized } from "@/lib/tax/gstin-india";
import { materializePurchaseOrderLinesForSave } from "@/lib/items/materialize-document-lines";
import { partyFromJson } from "@/lib/packing/parse";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { matchPartyIdFromBillSnapshot } from "@/lib/parties/match-party-from-bill";
import { normalizePackingListTemplateForSave } from "@/lib/packing/packing-list-templates";
import { defaultQuotationValidUntilYmd } from "@/lib/quotation/dates";
import { orgCalendarTodayYmd } from "@/lib/dates/org-calendar";
import { canEditIssuedDocument, ISSUED_EDIT_CLOSED_MESSAGE } from "@/lib/documents/issued-edit-window";
import {
  insertIssuedDocumentEditLog,
  profileDisplayNameForUser,
} from "@/lib/documents/issued-edit-log";
import {
  assertOptionalDocumentDateWithinBackdatePolicy,
  assertOptionalDocumentYmdNotFuture,
  notifyDocumentBackdateIfNeeded,
} from "@/lib/documents/document-date-backdate-policy";
import {
  maxDocumentSeriesSlots,
  parseAllocatedDocumentSerial,
  referenceYmdForDocNumber,
  resolvedSeriesSlotForDocCreate,
  clampSeriesSlotValue,
  effectiveSeriesSlotForDocKind,
} from "@/lib/documents/document-numbering";

export type PurchaseOrderAdditionalChargeInput = {
  label: string;
  amount: number;
  tax_percent: number;
};

function normalizeAdditionalChargesForDb(charges: PurchaseOrderAdditionalChargeInput[]) {
  return charges
    .slice(0, 2)
    .map((c) => ({
      label: String(c.label ?? "").trim().slice(0, 120),
      amount: Math.round(Number(c.amount) * 100) / 100,
      tax_percent: Number.isFinite(Number(c.tax_percent)) ? Number(c.tax_percent) : 0,
    }))
    .filter((c) => c.label.length > 0 || c.amount > 0);
}

function validateLines(lines: QuotationLine[]) {
  if (!lines.length) throw new Error("Add at least one line item");
  if (lines.some((l) => !l.description.trim())) {
    throw new Error("Each line needs a product or service name");
  }
  if (lines.some((l) => !(l.qty > 0) || !Number.isFinite(l.qty))) {
    throw new Error("Each line needs a quantity greater than zero");
  }
  if (lines.some((l) => l.unit_price < 0 || !Number.isFinite(l.unit_price))) {
    throw new Error("Each line needs a valid unit price (0 or greater)");
  }
  if (lines.some((l) => !String(l.unit ?? "").trim())) {
    throw new Error("Each line needs a unit");
  }
}

function normalizePartySnapshots(input: {
  vendor_to: PartySnapshot;
  bill_to: PartySnapshot;
  ship_to: PartySnapshot;
}) {
  return {
    vendor_to: partySnapshotWithGstinNormalized(input.vendor_to),
    bill_to: partySnapshotWithGstinNormalized(input.bill_to),
    ship_to: partySnapshotWithGstinNormalized(input.ship_to),
  };
}

function validatePartyNames(vendor_to: PartySnapshot, bill_to: PartySnapshot, ship_to: PartySnapshot) {
  if (!vendor_to.name.trim()) throw new Error("Vendor name is required");
  if (!bill_to.name.trim()) throw new Error("Bill to name is required");
  if (!ship_to.name.trim()) throw new Error("Ship to name is required");
}

export async function createPurchaseOrder(input: {
  document_date: string | null;
  currency: string;
  vendor_to: PartySnapshot;
  bill_to: PartySnapshot;
  ship_to: PartySnapshot;
  lines: QuotationLine[];
  additional_charges?: PurchaseOrderAdditionalChargeInput[];
  payment_term: string;
  delivery_inco_term: string;
  delivery_period: string;
  valid_until: string;
  terms_notes?: string;
  notes?: string;
  template?: string;
  party_save?: Pick<SavePartyFlags, "party_display_name" | "save_bill">;
  party_id?: string | null;
  series_slot?: number | null;
  append_org_ship_address?: boolean;
}) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const parties = normalizePartySnapshots(input);
  validatePartyNames(parties.vendor_to, parties.bill_to, parties.ship_to);
  validateLines(input.lines);
  if (!input.delivery_period.trim()) throw new Error("Delivery period is required");
  if (!input.valid_until?.trim()) throw new Error("Delivery by date is required.");
  assertOptionalDocumentDateWithinBackdatePolicy(input.document_date, ctx);

  const supabase = await createClient();
  const linesForDb = await materializePurchaseOrderLinesForSave(supabase, ctx.organization.id, input.lines);
  let partyId: string | null = await resolvePartyIdForDocument(
    supabase,
    ctx.organization.id,
    input.party_id,
  );
  if (
    input.party_save?.save_bill &&
    input.party_save.party_display_name.trim() &&
    parties.vendor_to.name.trim()
  ) {
    partyId = await upsertPartyBillOnly({
      party_display_name: input.party_save.party_display_name,
      bill_to: parties.vendor_to,
    });
  }

  const refYmd = referenceYmdForDocNumber(input.document_date, ctx.organization);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "po",
    p_reference_ymd: refYmd,
    p_series_slot: input.series_slot ?? null,
  });
  if (nErr) throw new Error(nErr.message);

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      document_date: input.document_date || null,
      currency: (input.currency || ctx.organization.default_currency || "INR").toString().toUpperCase().slice(0, 3),
      vendor_to: parties.vendor_to,
      bill_to: parties.bill_to,
      ship_to: parties.ship_to,
      lines: linesForDb,
      payment_term: input.payment_term?.trim() || "",
      delivery_inco_term: input.delivery_inco_term?.trim() || "",
      delivery_period: input.delivery_period.trim(),
      valid_until: input.valid_until.trim(),
      terms_notes: input.terms_notes?.trim() || null,
      notes: input.notes?.trim() || null,
      template: normalizePackingListTemplateForSave(ctx.organization.plan, input.template ?? "basic"),
      additional_charges: normalizeAdditionalChargesForDb(input.additional_charges ?? []),
      party_id: partyId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.append_org_ship_address) {
    await appendOrgShipAddressFromDocument(parties.ship_to);
  }

  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: undefined,
    nextDocumentDate: input.document_date,
    docKind: "purchase_order",
    docNumber: docNo as string,
    isCreate: true,
  });

  revalidatePath("/purchase-orders");
  revalidatePath("/items");
  return { id: data.id as string, party_id: partyId };
}

export async function updatePurchaseOrder(
  id: string,
  input: {
    document_date: string | null;
    currency: string;
    vendor_to: PartySnapshot;
    bill_to: PartySnapshot;
    ship_to: PartySnapshot;
    lines: QuotationLine[];
    additional_charges?: PurchaseOrderAdditionalChargeInput[];
    payment_term: string;
    delivery_inco_term: string;
    delivery_period: string;
    valid_until: string;
    terms_notes?: string;
    notes?: string;
    template?: string;
    party_save?: Pick<SavePartyFlags, "party_display_name" | "save_bill">;
    party_id?: string | null;
    series_slot?: number | null;
    append_org_ship_address?: boolean;
  },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const parties = normalizePartySnapshots(input);
  validatePartyNames(parties.vendor_to, parties.bill_to, parties.ship_to);
  validateLines(input.lines);
  if (!input.delivery_period.trim()) throw new Error("Delivery period is required");
  if (!input.valid_until?.trim()) throw new Error("Delivery by date is required.");

  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from("purchase_orders")
    .select("status, issued_at, document_date, doc_number, numbering_series_slot")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
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

  const linesForDb = await materializePurchaseOrderLinesForSave(supabase, ctx.organization.id, input.lines);
  let partyId: string | null = await resolvePartyIdForDocument(
    supabase,
    ctx.organization.id,
    input.party_id,
  );
  if (
    input.party_save?.save_bill &&
    input.party_save.party_display_name.trim() &&
    parties.vendor_to.name.trim()
  ) {
    partyId = await upsertPartyBillOnly({
      party_display_name: input.party_save.party_display_name,
      bill_to: parties.vendor_to,
    });
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
      : effectiveSeriesSlotForDocKind(ctx.organization, "po");
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
      p_doc_type: "po",
      p_reference_ymd: releaseRef,
      p_row_series_slot: prevSlot,
      p_allocated_serial: serial,
    });
    if (relErr) throw new Error(relErr.message);

    const newRef = referenceYmdForDocNumber(input.document_date, ctx.organization);
    const { data: newNo, error: nErr } = await supabase.rpc("next_document_number", {
      p_org_id: ctx.organization.id,
      p_doc_type: "po",
      p_reference_ymd: newRef,
      p_series_slot: newSlotRequested,
    });
    if (nErr) throw new Error(nErr.message);
    docNumberPatch = newNo as string;
    seriesSlotPatch = newSlotRequested;
  }

  const patch: Record<string, unknown> = {
    document_date: input.document_date || null,
    currency: (input.currency || "INR").toUpperCase().slice(0, 3),
    vendor_to: parties.vendor_to,
    bill_to: parties.bill_to,
    ship_to: parties.ship_to,
    lines: linesForDb,
    payment_term: input.payment_term?.trim() || "",
    delivery_inco_term: input.delivery_inco_term?.trim() || "",
    delivery_period: input.delivery_period.trim(),
    valid_until: input.valid_until.trim(),
    terms_notes: input.terms_notes?.trim() || null,
    notes: input.notes?.trim() || null,
    template: normalizePackingListTemplateForSave(ctx.organization.plan, input.template ?? "basic"),
    additional_charges: normalizeAdditionalChargesForDb(input.additional_charges ?? []),
    party_id: partyId,
    updated_at: new Date().toISOString(),
  };
  if (docNumberPatch != null) {
    patch.doc_number = docNumberPatch;
    patch.numbering_series_slot = seriesSlotPatch;
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .in("status", ["draft", "issued"]);

  if (error) throw new Error(error.message);

  if (input.append_org_ship_address) {
    await appendOrgShipAddressFromDocument(parties.ship_to);
  }

  const ex = existing as { document_date?: string | null; doc_number?: string };
  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: ex.document_date,
    nextDocumentDate: input.document_date,
    docKind: "purchase_order",
    docNumber: docNumberPatch ?? String(ex.doc_number ?? ""),
    isCreate: false,
  });

  if (existing.status === "issued") {
    const displayName =
      (await profileDisplayNameForUser(supabase, ctx.userId)) ?? ctx.userEmail?.trim() ?? null;
    await insertIssuedDocumentEditLog(supabase, {
      organizationId: ctx.organization.id,
      docKind: "purchase_order",
      documentId: id,
      editedByUserId: ctx.userId,
      editedByDisplayName: displayName,
    });
  }

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath(`/purchase-orders/${id}/edit`);
  revalidatePath(`/purchase-orders/${id}/print`);
  revalidatePath("/items");
  return { party_id: partyId };
}

export async function deleteDraftPurchaseOrder(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_purchase_order", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/purchase-orders");
  revalidatePath("/items");
  revalidatePath("/", "layout");
}

export async function duplicatePurchaseOrder(
  sourceId: string,
  input?: { series_slot?: number | null },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: src, error: sErr } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", sourceId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (sErr || !src) throw new Error("Not found");

  const documentDateToday = orgCalendarTodayYmd(ctx.organization);
  const srcSlot = (src as { numbering_series_slot?: number | null }).numbering_series_slot;
  const dupSlot =
    input?.series_slot != null
      ? resolvedSeriesSlotForDocCreate(ctx.organization, "po", input.series_slot)
      : resolvedSeriesSlotForDocCreate(ctx.organization, "po", srcSlot ?? undefined);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "po",
    p_reference_ymd: referenceYmdForDocNumber(documentDateToday, ctx.organization),
    p_series_slot: dupSlot,
  });
  if (nErr) throw new Error(nErr.message);

  const row = src as Record<string, unknown>;
  const template = normalizePackingListTemplateForSave(ctx.organization.plan, String(row.template ?? "basic"));
  const validUntil = defaultQuotationValidUntilYmd(documentDateToday, documentDateToday);

  let partyId = (row.party_id as string | null) ?? null;
  if (!partyId) {
    const docVendor = partyFromJson(row.vendor_to);
    if (docVendor.name.trim()) {
      const parties = await loadPartiesWithAddresses(ctx.organization.id);
      partyId = matchPartyIdFromBillSnapshot(docVendor, parties);
    }
  }

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      numbering_series_slot: dupSlot,
      status: "draft",
      issued_at: null,
      document_date: documentDateToday,
      currency: String(row.currency ?? "INR")
        .toUpperCase()
        .slice(0, 3) || "INR",
      vendor_to: row.vendor_to,
      bill_to: row.bill_to,
      ship_to: row.ship_to,
      lines: row.lines,
      payment_term: String(row.payment_term ?? ""),
      delivery_inco_term: String(row.delivery_inco_term ?? ""),
      delivery_period: String(row.delivery_period ?? ""),
      valid_until: validUntil,
      terms_notes: (row.terms_notes as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      template,
      additional_charges: row.additional_charges ?? [],
      party_id: partyId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const newId = data.id as string;
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${newId}`);
  revalidatePath(`/purchase-orders/${newId}/edit`);
  revalidatePath(`/purchase-orders/${newId}/print`);
  revalidatePath("/items");
  revalidatePath("/parties", "layout");
  return { id: newId };
}

export async function issuePurchaseOrder(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const supabase = await createClient();
  const { data: qRow, error: qErr } = await supabase
    .from("purchase_orders")
    .select("document_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!qRow) return { ok: false as const, error: "Not found" };
  try {
    assertOptionalDocumentDateWithinBackdatePolicy(
      (qRow as { document_date?: string | null }).document_date,
      ctx,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid document date";
    return { ok: false as const, error: msg };
  }

  const { data, error } = await supabase.rpc("issue_purchase_order", { p_id: id });
  if (error) throw new Error(error.message);
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Could not issue" };
  }
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true as const };
}
