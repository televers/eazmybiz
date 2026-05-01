"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { getOrgCheckpointFlags, canRecordMaterialMovement } from "@/lib/access/checkpoints";
import type { GatePassSavePayload } from "@/lib/gate-pass/save-payload";
import { validateMaterialGatePass } from "@/lib/gate-pass/validate";
import type { FullOrgContext } from "@/lib/org-context-types";
import {
  assertGatePassIssueAllowedOnPassDate,
  assertGatePassMaterialMovementAllowedOnPassDate,
  assertGatePassPassDateForSave,
} from "@/lib/gate-pass/gate-pass-date-policy";
import { canRecordMaterialMovementWithinIssueWindow } from "@/lib/gate-pass/material-movement-windows";

async function assertPartyInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  partyId: string | null,
) {
  if (!partyId) return;
  const { data, error } = await supabase
    .from("parties")
    .select("id")
    .eq("id", partyId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Party not found");
}

function parseGatePassDocumentDateYmd(input: GatePassSavePayload, ctx: FullOrgContext): string {
  const ymd = String(input.documentDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Pass date must be YYYY-MM-DD");
  }
  assertGatePassPassDateForSave(ymd, ctx);
  return ymd;
}

function rowFromPayload(input: GatePassSavePayload, ctx: FullOrgContext) {
  return {
    direction: input.direction,
    document_date: parseGatePassDocumentDateYmd(input, ctx),
    invoice_no: input.invoiceNo,
    party_id: input.partyId,
    party_name: input.partyName,
    transport_name: input.transportName,
    lr_docket_no: input.lrDocketNo,
    hand_carried_name: input.handCarriedName,
    hand_carried_mobile: input.handCarriedMobile,
    vehicle_no: input.vehicleNo,
    package_count: input.packageCount,
    material_description: input.mainItem,
    notes: input.notes,
  };
}

type GatePassRowPayload = {
  direction: string;
  document_date: string;
  invoice_no: string | null;
  party_id: string | null;
  party_name: string | null;
  transport_name: string | null;
  lr_docket_no: string | null;
  hand_carried_name: string | null;
  hand_carried_mobile: string | null;
  vehicle_no: string | null;
  package_count: number | null;
  material_description: string | null;
  notes: string | null;
};

function nullTrimStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function payloadFromGatePassRow(row: GatePassRowPayload): GatePassSavePayload {
  const pk = row.package_count;
  const packageCount =
    pk == null || typeof pk !== "number" || !Number.isFinite(pk)
      ? null
      : Math.floor(pk);
  return {
    direction: row.direction === "in" ? "in" : "out",
    documentDate: String(row.document_date ?? "").trim().slice(0, 10),
    invoiceNo: nullTrimStr(row.invoice_no),
    partyId: row.party_id ?? null,
    partyName: nullTrimStr(row.party_name),
    transportName: nullTrimStr(row.transport_name),
    lrDocketNo: nullTrimStr(row.lr_docket_no),
    handCarriedName: nullTrimStr(row.hand_carried_name),
    handCarriedMobile: nullTrimStr(row.hand_carried_mobile),
    vehicleNo: nullTrimStr(row.vehicle_no),
    packageCount,
    mainItem: nullTrimStr(row.material_description),
    notes: nullTrimStr(row.notes),
  };
}

export async function createGatePass(input: GatePassSavePayload) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const v = validateMaterialGatePass(input);
  if (v) throw new Error(v);

  const supabase = await createClient();
  await assertPartyInOrg(supabase, ctx.organization.id, input.partyId);

  const refGp = parseGatePassDocumentDateYmd(input, ctx);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "gp",
    p_reference_ymd: refGp,
  });
  if (nErr) throw nErr;

  const { data, error } = await supabase
    .from("gate_passes")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      ...rowFromPayload(input, ctx),
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/gate-passes");
  return data.id as string;
}

export async function updateGatePass(id: string, input: GatePassSavePayload) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const v = validateMaterialGatePass(input);
  if (v) throw new Error(v);

  const supabase = await createClient();
  await assertPartyInOrg(supabase, ctx.organization.id, input.partyId);

  const { data: existing, error: selErr } = await supabase
    .from("gate_passes")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!existing) throw new Error("Not found");
  if (existing.status !== "draft") throw new Error("Only drafts can be edited");

  const { error } = await supabase
    .from("gate_passes")
    .update({
      ...rowFromPayload(input, ctx),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("status", "draft");

  if (error) throw error;
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${id}`);
}

export async function issueGatePass(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const supabase = await createClient();
  const { data: row, error: selErr } = await supabase
    .from("gate_passes")
    .select(
      "direction, document_date, invoice_no, party_id, party_name, transport_name, lr_docket_no, hand_carried_name, hand_carried_mobile, vehicle_no, package_count, material_description, notes, status, organization_id",
    )
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return { ok: false as const, error: "Not found" };
  if (row.status !== "draft") return { ok: false as const, error: "already issued" };

  const payload = payloadFromGatePassRow(row as GatePassRowPayload);
  const v = validateMaterialGatePass(payload);
  if (v) return { ok: false as const, error: v };

  const docDate = (row as { document_date?: string }).document_date;
  try {
    assertGatePassPassDateForSave(docDate, ctx);
    assertGatePassIssueAllowedOnPassDate(docDate, ctx);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid pass date";
    return { ok: false as const, error: msg };
  }

  const { data, error } = await supabase.rpc("issue_gate_pass", { p_id: id });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Could not issue" };
  }
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${id}`);
  return { ok: true as const };
}

export async function recordGatePassMaterialMovement(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  if (!canRecordMaterialMovement(ctx, flags)) {
    return { ok: false as const, error: "Only gate staff can record material movement" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: existing, error: sErr } = await supabase
    .from("gate_passes")
    .select("id, status, document_date, issued_at, material_moved_at")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!existing) return { ok: false as const, error: "Not found" };
  if (existing.status !== "issued") {
    return { ok: false as const, error: "Issue the pass before recording movement" };
  }
  if (existing.material_moved_at) {
    return { ok: false as const, error: "Movement already recorded" };
  }
  try {
    assertGatePassMaterialMovementAllowedOnPassDate(
      (existing as { document_date?: string }).document_date,
      ctx,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Pass date not reached";
    return { ok: false as const, error: msg };
  }
  if (!canRecordMaterialMovementWithinIssueWindow(existing.issued_at)) {
    return {
      ok: false as const,
      error: "Material movement can only be recorded within 48 hours of issue",
    };
  }

  const { error } = await supabase
    .from("gate_passes")
    .update({
      material_moved_at: now,
      material_moved_by_user_id: ctx.userId,
      updated_at: now,
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("status", "issued")
    .is("material_moved_at", null);

  if (error) throw error;
  revalidatePath("/gate-passes");
  revalidatePath(`/gate-passes/${id}`);
  return { ok: true as const };
}
