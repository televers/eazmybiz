"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";
import type { PartySnapshot } from "@/lib/packing/types";
import { normalizeDcLineForSave } from "@/lib/delivery-challan/compute";
import { appendPartyShipAddressToNextSlot, upsertPartyFromDocument } from "@/app/(main)/parties/actions";
import type { SavePartyFlags } from "@/lib/parties/save-flags";
import { resolvePartyIdForDocument } from "@/lib/parties/validate-party-id";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { materializeDcLinesForSave } from "@/lib/items/materialize-document-lines";
import { partySnapshotWithGstinNormalized } from "@/lib/tax/gstin-india";
import { normalizePackingListTemplateForSave } from "@/lib/packing/packing-list-templates";
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

export type DeliveryChallanAdditionalChargeInput = {
  label: string;
  amount: number;
  tax_percent: number;
};

function normalizeAdditionalChargesForDb(charges: DeliveryChallanAdditionalChargeInput[]) {
  return charges
    .slice(0, 2)
    .map((c) => ({
      label: String(c.label ?? "").trim().slice(0, 120),
      amount: Math.round(Number(c.amount) * 100) / 100,
      tax_percent: Number.isFinite(Number(c.tax_percent)) ? Number(c.tax_percent) : 0,
    }))
    .filter((c) => c.label.length > 0 || c.amount > 0);
}

function validateLines(lines: DeliveryChallanLine[]) {
  if (!lines.length) throw new Error("Add at least one line item");
  if (lines.some((l) => !l.description.trim())) {
    throw new Error("Each line needs a product description");
  }
  if (lines.some((l) => !(l.qty > 0) || !Number.isFinite(l.qty))) {
    throw new Error("Each line needs a quantity greater than zero");
  }
  if (lines.some((l) => l.unit_price < 0 || !Number.isFinite(l.unit_price))) {
    throw new Error("Each line needs a valid unit rate (0 or greater)");
  }
  if (lines.some((l) => !String(l.unit ?? "").trim())) {
    throw new Error("Each line needs a unit");
  }
}

function validateChallanParties(bill_to: PartySnapshot, ship_to: PartySnapshot) {
  if (!bill_to.name.trim()) throw new Error("Billing address name is required");
  if (!ship_to.name.trim()) throw new Error("Shipping address name is required");
}

export async function createDeliveryChallan(input: {
  document_date: string | null;
  currency: string;
  bill_to: PartySnapshot;
  ship_to: PartySnapshot;
  lines: DeliveryChallanLine[];
  additional_charges?: DeliveryChallanAdditionalChargeInput[];
  po_no?: string | null;
  po_date?: string | null;
  lr_docket_no?: string | null;
  eway_bill_no?: string | null;
  transport_name?: string | null;
  transporter_id?: string | null;
  vehicle_no?: string | null;
  notes?: string | null;
  template?: string;
  party_save?: SavePartyFlags;
  party_id?: string | null;
  append_ship_address_to_linked_party?: boolean;
  series_slot?: number | null;
}) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  validateChallanParties(input.bill_to, input.ship_to);
  assertOptionalDocumentDateWithinBackdatePolicy(input.document_date, ctx);
  const bill_to = partySnapshotWithGstinNormalized(input.bill_to);
  const ship_to = partySnapshotWithGstinNormalized(input.ship_to);

  const supabase = await createClient();
  const withPresets = await materializeDcLinesForSave(supabase, ctx.organization.id, input.lines);
  const lines = withPresets.map((l) => normalizeDcLineForSave(l)).filter((l) => l.description.trim().length > 0);
  validateLines(lines);

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
  const resolvedSlot = resolvedSeriesSlotForDocCreate(ctx.organization, "dc", input.series_slot);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "dc",
    p_reference_ymd: refYmd,
    p_series_slot: resolvedSlot,
  });
  if (nErr) throw nErr;

  const currency = (input.currency || ctx.organization.default_currency || "INR")
    .toString()
    .toUpperCase()
    .slice(0, 3);

  const { data, error } = await supabase
    .from("delivery_challans")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      numbering_series_slot: resolvedSlot,
      document_date: input.document_date || null,
      currency,
      bill_to,
      ship_to,
      line_items: lines,
      additional_charges: normalizeAdditionalChargesForDb(input.additional_charges ?? []),
      po_no: input.po_no?.trim() || null,
      po_date: input.po_date || null,
      lr_docket_no: input.lr_docket_no?.trim() || null,
      eway_bill_no: input.eway_bill_no?.trim() || null,
      transport_name: input.transport_name?.trim() || null,
      transporter_id: input.transporter_id?.trim() || null,
      vehicle_no: input.vehicle_no?.trim() || null,
      notes: input.notes?.trim() || null,
      template: normalizePackingListTemplateForSave(ctx.organization.plan, input.template ?? "basic"),
      party_id: partyId,
    })
    .select("id")
    .single();

  if (error) throw error;

  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: undefined,
    nextDocumentDate: input.document_date,
    docKind: "delivery_challan",
    docNumber: docNo as string,
    isCreate: true,
  });

  revalidatePath("/delivery-challans");
  revalidatePath("/items");
  return { id: data.id as string, party_id: partyId };
}

export async function updateDeliveryChallan(
  id: string,
  input: {
    document_date: string | null;
    currency: string;
    bill_to: PartySnapshot;
    ship_to: PartySnapshot;
    lines: DeliveryChallanLine[];
    additional_charges?: DeliveryChallanAdditionalChargeInput[];
    po_no?: string | null;
    po_date?: string | null;
    lr_docket_no?: string | null;
    eway_bill_no?: string | null;
    transport_name?: string | null;
    transporter_id?: string | null;
    vehicle_no?: string | null;
    notes?: string | null;
    template?: string;
    party_save?: SavePartyFlags;
    party_id?: string | null;
    append_ship_address_to_linked_party?: boolean;
    series_slot?: number | null;
  },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  validateChallanParties(input.bill_to, input.ship_to);
  const bill_to = partySnapshotWithGstinNormalized(input.bill_to);
  const ship_to = partySnapshotWithGstinNormalized(input.ship_to);

  const currency = (input.currency || ctx.organization.default_currency || "INR")
    .toString()
    .toUpperCase()
    .slice(0, 3);

  const supabase = await createClient();

  const { data: existingDc, error: stErr } = await supabase
    .from("delivery_challans")
    .select("status, document_date, doc_number, numbering_series_slot")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (stErr) throw stErr;
  if (!existingDc) throw new Error("Not found");

  if (existingDc.status === "draft") {
    assertOptionalDocumentDateWithinBackdatePolicy(input.document_date, ctx);
  } else {
    assertOptionalDocumentYmdNotFuture(input.document_date, ctx);
  }

  const withPresets = await materializeDcLinesForSave(supabase, ctx.organization.id, input.lines);
  const lines = withPresets.map((l) => normalizeDcLineForSave(l)).filter((l) => l.description.trim().length > 0);
  validateLines(lines);

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
  const exRow = existingDc as {
    numbering_series_slot?: number | null;
    doc_number?: string;
    document_date?: string | null;
  };
  const prevSlot =
    exRow.numbering_series_slot != null
      ? clampSeriesSlotValue(Number(exRow.numbering_series_slot), maxSlots)
      : effectiveSeriesSlotForDocKind(ctx.organization, "dc");
  const newSlotRequested =
    input.series_slot != null && plan !== "free" && ctx.organization.doc_multi_series_enabled
      ? clampSeriesSlotValue(input.series_slot, maxSlots)
      : prevSlot;

  let docNumberPatch: string | undefined;
  let seriesSlotPatch: number | undefined;

  if (
    existingDc.status === "draft" &&
    plan !== "free" &&
    ctx.organization.doc_multi_series_enabled &&
    newSlotRequested !== prevSlot
  ) {
    const serial = parseAllocatedDocumentSerial(String(exRow.doc_number ?? ""));
    if (serial == null) throw new Error("Could not read this draft’s document number.");
    const releaseRef = referenceYmdForDocNumber(exRow.document_date, ctx.organization);
    const { error: relErr } = await supabase.rpc("release_document_sequence_if_last", {
      p_org_id: ctx.organization.id,
      p_doc_type: "dc",
      p_reference_ymd: releaseRef,
      p_row_series_slot: prevSlot,
      p_allocated_serial: serial,
    });
    if (relErr) throw relErr;

    const newRef = referenceYmdForDocNumber(input.document_date, ctx.organization);
    const { data: newNo, error: nErr } = await supabase.rpc("next_document_number", {
      p_org_id: ctx.organization.id,
      p_doc_type: "dc",
      p_reference_ymd: newRef,
      p_series_slot: newSlotRequested,
    });
    if (nErr) throw nErr;
    docNumberPatch = newNo as string;
    seriesSlotPatch = newSlotRequested;
  }

  const patch: Record<string, unknown> = {
    document_date: input.document_date || null,
    currency,
    bill_to,
    ship_to,
    line_items: lines,
    additional_charges: normalizeAdditionalChargesForDb(input.additional_charges ?? []),
    po_no: input.po_no?.trim() || null,
    po_date: input.po_date || null,
    lr_docket_no: input.lr_docket_no?.trim() || null,
    eway_bill_no: input.eway_bill_no?.trim() || null,
    transport_name: input.transport_name?.trim() || null,
    transporter_id: input.transporter_id?.trim() || null,
    vehicle_no: input.vehicle_no?.trim() || null,
    notes: input.notes?.trim() || null,
    template: normalizePackingListTemplateForSave(ctx.organization.plan, input.template ?? "basic"),
    party_id: partyId,
    updated_at: new Date().toISOString(),
  };
  if (docNumberPatch != null) {
    patch.doc_number = docNumberPatch;
    patch.numbering_series_slot = seriesSlotPatch;
  }

  const { error } = await supabase
    .from("delivery_challans")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .in("status", ["draft", "issued"]);

  if (error) throw error;

  const ex = existingDc as { document_date?: string | null; doc_number?: string };
  await notifyDocumentBackdateIfNeeded({
    ctx,
    prevDocumentDate: ex.document_date,
    nextDocumentDate: input.document_date,
    docKind: "delivery_challan",
    docNumber: docNumberPatch ?? String(ex.doc_number ?? ""),
    isCreate: false,
  });

  revalidatePath("/delivery-challans");
  revalidatePath(`/delivery-challans/${id}`);
  revalidatePath(`/delivery-challans/${id}/edit`);
  revalidatePath(`/delivery-challans/${id}/print`);
  revalidatePath("/items");
  return { party_id: partyId };
}

export async function duplicateDeliveryChallan(
  sourceId: string,
  input?: { series_slot?: number | null },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: src, error: sErr } = await supabase
    .from("delivery_challans")
    .select("*")
    .eq("id", sourceId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (sErr || !src) throw new Error("Not found");

  const dupDcDate = orgCalendarTodayYmd(ctx.organization);
  const srcSlot = (src as { numbering_series_slot?: number | null }).numbering_series_slot;
  const dupSlot =
    input?.series_slot != null
      ? resolvedSeriesSlotForDocCreate(ctx.organization, "dc", input.series_slot)
      : resolvedSeriesSlotForDocCreate(ctx.organization, "dc", srcSlot ?? undefined);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "dc",
    p_reference_ymd: referenceYmdForDocNumber(dupDcDate, ctx.organization),
    p_series_slot: dupSlot,
  });
  if (nErr) throw nErr;

  const row = src as Record<string, unknown>;
  const template = normalizePackingListTemplateForSave(ctx.organization.plan, String(row.template ?? "basic"));
  const currency = String(row.currency ?? ctx.organization.default_currency ?? "INR")
    .toUpperCase()
    .slice(0, 3) || "INR";

  const { data, error } = await supabase
    .from("delivery_challans")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      numbering_series_slot: dupSlot,
      status: "draft",
      issued_at: null,
      document_date: dupDcDate,
      currency,
      bill_to: row.bill_to,
      ship_to: row.ship_to,
      line_items: row.line_items,
      additional_charges: row.additional_charges ?? [],
      po_no: (row.po_no as string | null) ?? null,
      po_date: (row.po_date as string | null) ?? null,
      lr_docket_no: (row.lr_docket_no as string | null) ?? null,
      eway_bill_no: (row.eway_bill_no as string | null) ?? null,
      transport_name: (row.transport_name as string | null) ?? null,
      transporter_id: (row.transporter_id as string | null) ?? null,
      vehicle_no: (row.vehicle_no as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      template,
      party_id: (row.party_id as string | null) ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const newId = data.id as string;
  revalidatePath("/delivery-challans");
  revalidatePath(`/delivery-challans/${newId}`);
  revalidatePath(`/delivery-challans/${newId}/edit`);
  revalidatePath(`/delivery-challans/${newId}/print`);
  revalidatePath("/items");
  revalidatePath("/parties", "layout");
  return { id: newId };
}

export async function issueDeliveryChallan(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const supabase = await createClient();
  const { data: row, error: qErr } = await supabase
    .from("delivery_challans")
    .select("bill_to, ship_to, line_items, document_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (qErr) throw qErr;
  if (!row) return { ok: false as const, error: "Not found" };

  try {
    assertOptionalDocumentDateWithinBackdatePolicy(
      (row as { document_date?: string | null }).document_date,
      ctx,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid document date";
    return { ok: false as const, error: msg };
  }

  const bill = row.bill_to as { name?: string } | null;
  const ship = row.ship_to as { name?: string } | null;
  if (!bill?.name?.trim()) {
    return { ok: false as const, error: "Billing address is required before issue" };
  }
  if (!ship?.name?.trim()) {
    return { ok: false as const, error: "Shipping address is required before issue" };
  }

  const lines = dcLinesFromJson(row.line_items).filter((l) => l.description.trim().length > 0);
  if (!lines.length) {
    return { ok: false as const, error: "Add at least one line item before issue" };
  }
  for (const l of lines) {
    if (!(l.qty > 0) || l.unit_price < 0 || !Number.isFinite(l.unit_price)) {
      return { ok: false as const, error: "Each line must have valid quantity and unit rate before issue" };
    }
  }

  const { data, error } = await supabase.rpc("issue_delivery_challan", { p_id: id });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Could not issue" };
  }
  revalidatePath("/delivery-challans");
  revalidatePath(`/delivery-challans/${id}`);
  revalidatePath(`/delivery-challans/${id}/edit`);
  revalidatePath(`/delivery-challans/${id}/print`);
  return { ok: true as const };
}
