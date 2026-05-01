"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { getOrgCheckpointFlags, canRecordVisitorCheckpoint } from "@/lib/access/checkpoints";
import {
  assertVisitorVisitDateForSave,
  isVisitorVisitDateOrgToday,
  isVisitorVisitDateStrictlyFuture,
} from "@/lib/visitors/visit-date-policy";
import { VISITOR_CHECKOUT_WINDOW_MS } from "@/lib/visitors/check-in-overdue";
import { orgCalendarTodayYmd } from "@/lib/dates/org-calendar";
import { referenceYmdForDocNumber } from "@/lib/documents/document-numbering";
import type { FullOrgContext } from "@/lib/org-context-types";
import { isValidVisitorMobile } from "@/lib/visitors/mobile";
import { requireValidIntlMobile } from "@/lib/phone/intl-mobile";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseVisitDate(visitDate: string | undefined): string {
  const raw = (visitDate ?? "").trim();
  const ymd = raw.slice(0, 10);
  if (!ISO_DATE.test(ymd)) {
    throw new Error("Visit date must be YYYY-MM-DD");
  }
  return ymd;
}

function validateDraftPayload(
  input: {
    visitDate?: string;
    visitorName: string;
    visitorCompany?: string;
    purpose?: string;
    hostName: string;
    visitorMobile: string;
    vehicleReg?: string;
    driverName?: string;
  },
  mode: "create" | "update",
  ctx: FullOrgContext,
) {
  const host = input.hostName.trim();
  const name = input.visitorName.trim();
  if (!name) throw new Error("Visitor name is required");
  if (!host) throw new Error("Host is required");
  const visitor_mobile = requireValidIntlMobile(input.visitorMobile);
  const visitRaw = input.visitDate != null ? String(input.visitDate).trim() : "";
  const visit_date =
    visitRaw !== ""
      ? parseVisitDate(visitRaw)
      : mode === "create"
        ? orgCalendarTodayYmd(ctx.organization)
        : (() => {
            throw new Error("Visit date is required");
          })();
  assertVisitorVisitDateForSave(visit_date, ctx);

  return {
    visit_date,
    visitor_name: name,
    visitor_company: input.visitorCompany?.trim() || null,
    purpose: input.purpose?.trim() || null,
    host_name: host,
    visitor_mobile,
    vehicle_reg: input.vehicleReg?.trim() || null,
    driver_name: input.driverName?.trim() || null,
  };
}

export async function createVisitorVisit(input: {
  visitDate?: string;
  visitorName: string;
  visitorCompany?: string;
  purpose?: string;
  hostName: string;
  visitorMobile: string;
  vehicleReg?: string;
  driverName?: string;
}) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const row = validateDraftPayload(input, "create", ctx);

  const supabase = await createClient();
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "vs",
    p_reference_ymd: referenceYmdForDocNumber(String(row.visit_date).slice(0, 10), ctx.organization),
  });
  if (nErr) throw nErr;

  const { data, error } = await supabase
    .from("visitor_visits")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      ...row,
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/visitors");
  return data.id as string;
}

export async function updateDraftVisitor(
  id: string,
  input: {
    visitDate?: string;
    visitorName: string;
    visitorCompany?: string;
    purpose?: string;
    hostName: string;
    visitorMobile: string;
    vehicleReg?: string;
    driverName?: string;
  },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const row = validateDraftPayload(input, "update", ctx);

  const supabase = await createClient();
  const { data: existing, error: gErr } = await supabase
    .from("visitor_visits")
    .select("id,status,visit_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (gErr) throw gErr;
  if (!existing) {
    throw new Error("Not found");
  }

  const status = String((existing as { status?: string }).status ?? "");
  const allowIssuedFutureEdit =
    status === "issued" && isVisitorVisitDateStrictlyFuture((existing as { visit_date?: string }).visit_date, ctx);

  if (status !== "draft" && !allowIssuedFutureEdit) {
    throw new Error(
      status === "issued"
        ? "This issued pass can only be edited until the visit day starts in your organization calendar."
        : "Only draft visits can be edited",
    );
  }

  const statusEq = status === "draft" ? "draft" : "issued";

  const { error } = await supabase
    .from("visitor_visits")
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("status", statusEq);

  if (error) throw error;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
}

/** Visitor desk: on the visit day before check-in, update vehicle and driver only (photo uses uploadVisitorPhoto). */
export async function updateVisitorCheckInSupplement(
  id: string,
  input: { vehicleReg?: string; driverName?: string },
) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  if (!canRecordVisitorCheckpoint(ctx, flags)) {
    throw new Error("Only visitor desk staff can add gate details at check-in");
  }

  const supabase = await createClient();
  const { data: existing, error: gErr } = await supabase
    .from("visitor_visits")
    .select("id,status,visit_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (gErr) throw gErr;
  if (!existing) throw new Error("Not found");
  if (String(existing.status) !== "issued") {
    throw new Error("Gate details can only be set on an issued pass before check-in");
  }
  if (!isVisitorVisitDateOrgToday((existing as { visit_date?: string }).visit_date, ctx)) {
    throw new Error("Gate details can only be set on the visit day (organization calendar), before check-in");
  }

  const vehicle_reg = input.vehicleReg != null && String(input.vehicleReg).trim() !== ""
    ? String(input.vehicleReg).trim()
    : null;
  const driver_name = input.driverName != null && String(input.driverName).trim() !== ""
    ? String(input.driverName).trim()
    : null;

  const { error } = await supabase
    .from("visitor_visits")
    .update({
      vehicle_reg,
      driver_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("status", "issued");

  if (error) throw error;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
}

export async function uploadVisitorPhoto(visitorId: string, formData: FormData) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const file = formData.get("photo");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "No photo selected" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false as const, error: "Photo must be 2MB or smaller" };
  }

  const supabase = await createClient();
  const { data: existing, error: gErr } = await supabase
    .from("visitor_visits")
    .select("id,status,visit_date,photo_storage_path")
    .eq("id", visitorId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (gErr) throw gErr;
  const st = String((existing as { status?: string })?.status ?? "");
  const visitDate = (existing as { visit_date?: string }).visit_date;
  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canDesk = canRecordVisitorCheckpoint(ctx, flags);
  const issuedCheckInDay =
    st === "issued" && isVisitorVisitDateOrgToday(visitDate, ctx) && canDesk;
  const canPhoto =
    existing &&
    (st === "draft" ||
      (st === "issued" && isVisitorVisitDateStrictlyFuture(visitDate, ctx)) ||
      issuedCheckInDay);
  if (!canPhoto) {
    return {
      ok: false as const,
      error:
        st === "issued"
          ? canDesk
            ? "Photo can be changed only before the visit day or at check-in on the visit day."
            : "Photo can be changed only before the visit day (organization calendar), or by visitor desk staff on check-in."
          : "Photo can only be set while the visit is a draft",
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const safeExt = ext && ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
  const path = `${ctx.organization.id}/${visitorId}.${safeExt}`;

  if (existing.photo_storage_path && existing.photo_storage_path !== path) {
    await supabase.storage.from("visitor-photos").remove([existing.photo_storage_path]);
  }

  const { error: upErr } = await supabase.storage.from("visitor-photos").upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
  });

  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from("visitor_visits")
    .update({
      photo_storage_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitorId)
    .eq("organization_id", ctx.organization.id);

  if (dbErr) throw dbErr;

  revalidatePath("/visitors");
  revalidatePath(`/visitors/${visitorId}`);
  return { ok: true as const };
}

export async function removeVisitorPhoto(visitorId: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: existing, error: gErr } = await supabase
    .from("visitor_visits")
    .select("id,status,visit_date,photo_storage_path")
    .eq("id", visitorId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (gErr) throw gErr;
  const st = String((existing as { status?: string })?.status ?? "");
  const visitDate = (existing as { visit_date?: string }).visit_date;
  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  const canDesk = canRecordVisitorCheckpoint(ctx, flags);
  const issuedCheckInDay =
    st === "issued" && isVisitorVisitDateOrgToday(visitDate, ctx) && canDesk;
  const canPhoto =
    existing &&
    (st === "draft" ||
      (st === "issued" && isVisitorVisitDateStrictlyFuture(visitDate, ctx)) ||
      issuedCheckInDay);
  if (!canPhoto || !existing.photo_storage_path) {
    return { ok: true as const };
  }

  await supabase.storage.from("visitor-photos").remove([existing.photo_storage_path]);
  const { error } = await supabase
    .from("visitor_visits")
    .update({
      photo_storage_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitorId)
    .eq("organization_id", ctx.organization.id);

  if (error) throw error;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${visitorId}`);
  return { ok: true as const };
}

export async function issueVisitorPass(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: row, error: qErr } = await supabase
    .from("visitor_visits")
    .select("host_name,visitor_mobile,visit_date,organization_id")
    .eq("id", id)
    .maybeSingle();
  if (qErr) throw qErr;
  const hostOk = row?.host_name && String(row.host_name).trim().length > 0;
  const mobOk =
    row?.visitor_mobile &&
    isValidVisitorMobile(String(row.visitor_mobile));
  if (!hostOk || !mobOk) {
    return {
      ok: false as const,
      error: "Host and a valid visitor mobile (with country code) are required to issue",
    };
  }
  if ((row as { organization_id?: string }).organization_id !== ctx.organization.id) {
    return { ok: false as const, error: "Not found" };
  }
  try {
    assertVisitorVisitDateForSave((row as { visit_date?: string }).visit_date, ctx);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid visit date";
    return { ok: false as const, error: msg };
  }

  const { data, error } = await supabase.rpc("issue_visitor_pass", { p_id: id });
  if (error) throw error;
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    return { ok: false as const, error: result?.error ?? "Could not issue" };
  }
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
  return { ok: true as const };
}

export async function visitorCheckIn(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  if (!canRecordVisitorCheckpoint(ctx, flags)) {
    return { ok: false as const, error: "Only visitor-desk staff can check visitors in" };
  }

  const supabase = await createClient();
  const { data: row, error: gErr } = await supabase
    .from("visitor_visits")
    .select("status, visit_date")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (gErr) throw gErr;
  if (!row) return { ok: false as const, error: "Not found" };
  if (row.status !== "issued") {
    return { ok: false as const, error: "Pass must be issued before check-in" };
  }

  const visitYmd = String((row as { visit_date?: string }).visit_date ?? "").slice(0, 10);
  const todayYmd = orgCalendarTodayYmd(ctx.organization);
  if (/^\d{4}-\d{2}-\d{2}$/.test(visitYmd)) {
    if (visitYmd > todayYmd) {
      return {
        ok: false as const,
        error: "Check-in is only available on the visit day (organization calendar).",
      };
    }
    if (visitYmd < todayYmd) {
      return {
        ok: false as const,
        error: "Check-in is only available on the visit day; this visit date has already passed.",
      };
    }
  }

  const { error } = await supabase
    .from("visitor_visits")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);

  if (error) throw error;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
  return { ok: true as const };
}

export async function visitorCheckOut(id: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const flags = await getOrgCheckpointFlags(ctx.organization.id, ctx.entitlement?.owner_user_id ?? null);
  if (!canRecordVisitorCheckpoint(ctx, flags)) {
    return { ok: false as const, error: "Only visitor-desk staff can check visitors out" };
  }

  const supabase = await createClient();
  const { data: row, error: gErr } = await supabase
    .from("visitor_visits")
    .select("status, checked_in_at")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (gErr) throw gErr;
  if (!row) return { ok: false as const, error: "Not found" };
  if (row.status !== "checked_in") {
    return { ok: false as const, error: "Visitor must be checked in first" };
  }

  const checkedInRaw = (row as { checked_in_at?: string | null }).checked_in_at;
  if (checkedInRaw == null || String(checkedInRaw).trim() === "") {
    return { ok: false as const, error: "Missing check-in time" };
  }
  const checkedInMs = new Date(String(checkedInRaw)).getTime();
  if (Number.isNaN(checkedInMs)) {
    return { ok: false as const, error: "Invalid check-in time" };
  }
  if (Date.now() - checkedInMs > VISITOR_CHECKOUT_WINDOW_MS) {
    return {
      ok: false as const,
      error:
        "Check-out is only allowed within 24 hours of check-in. Contact an administrator if the visitor is still on site.",
    };
  }

  const { error } = await supabase
    .from("visitor_visits")
    .update({
      status: "checked_out",
      checked_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);

  if (error) throw error;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${id}`);
  return { ok: true as const };
}

export async function duplicateVisitorVisit(sourceId: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data: src, error: sErr } = await supabase
    .from("visitor_visits")
    .select("*")
    .eq("id", sourceId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (sErr || !src) throw new Error("Not found");

  const dupVisitYmd = orgCalendarTodayYmd(ctx.organization);
  const { data: docNo, error: nErr } = await supabase.rpc("next_document_number", {
    p_org_id: ctx.organization.id,
    p_doc_type: "vs",
    p_reference_ymd: referenceYmdForDocNumber(dupVisitYmd, ctx.organization),
  });
  if (nErr) throw nErr;

  const r = src as Record<string, unknown>;
  const { data, error } = await supabase
    .from("visitor_visits")
    .insert({
      organization_id: ctx.organization.id,
      doc_number: docNo as string,
      status: "draft",
      issued_at: null,
      checked_in_at: null,
      checked_out_at: null,
      visit_date: dupVisitYmd,
      visitor_name: String(r.visitor_name ?? ""),
      visitor_company: (r.visitor_company as string | null) ?? null,
      purpose: (r.purpose as string | null) ?? null,
      host_name: String(r.host_name ?? ""),
      visitor_mobile: String(r.visitor_mobile ?? ""),
      vehicle_reg: (r.vehicle_reg as string | null) ?? null,
      driver_name: (r.driver_name as string | null) ?? null,
      photo_storage_path: (r.photo_storage_path as string | null) ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  const newId = data.id as string;
  revalidatePath("/visitors");
  revalidatePath(`/visitors/${newId}`);
  revalidatePath("/parties", "layout");
  return { id: newId };
}
