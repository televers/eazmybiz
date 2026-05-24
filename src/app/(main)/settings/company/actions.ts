"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { assertIndiaCommercialEntitlementProfile } from "@/lib/plan/entitlements";
import { requireValidIntlMobileOrNull } from "@/lib/phone/intl-mobile";
import { insertOrganizationActivity } from "@/lib/org-activity";
import { gstinForDatabase } from "@/lib/tax/gstin-india";
import { normalizeOptionalOrgEmail } from "@/lib/validation/email";
import type { Organization } from "@/types/database";
import {
  assertValidAnnualResetDay,
  docSeriesProfilesForDb,
  fingerprintExtraProfile,
  fingerprintSeriesSlot1,
  maxDocumentSeriesSlots,
  normalizeDocNumberFormat,
  normalizeDocSeriesMode,
  normalizeExtraSeriesProfile,
  parseDocSeriesProfilesJson,
  usedDocumentSeriesSlots,
  emptyPrefixOverridesBySlot,
  serializeDocPrefixOverridesForDb,
  validatePaidDocPrefix,
  type DocPrefixOverridesBySlot,
  type DocSeriesExtraProfile,
} from "@/lib/documents/document-numbering";
import { orgToProfileSnapshot, profilePendingDiff } from "./profile-diff";
import type { PendingOrgProfileChange } from "./profile-types";
import type { VisitorPassPrintLayout } from "@/lib/visitors/visitor-pass-print-layout";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function sensitiveFromInput(input: {
  name: string;
  countryCode: string;
  gstin?: string;
  bankAccountHolderName?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}) {
  const countryCode = input.countryCode.trim().toUpperCase() || "IN";
  const gstinNorm =
    countryCode === "IN" ? gstinForDatabase(input.gstin) : input.gstin?.trim() || null;
  return {
    name: norm(input.name),
    gstin: norm(gstinNorm ?? ""),
    bank_account_holder_name: norm(input.bankAccountHolderName),
    bank_name: norm(input.bankName),
    bank_branch: norm(input.bankBranch),
    bank_account_no: norm(input.bankAccountNo),
    bank_ifsc: norm(input.bankIfsc),
  };
}

function sensitiveFromOrg(o: Organization) {
  return {
    name: norm(o.name),
    gstin: norm(o.gstin),
    bank_account_holder_name: norm(o.bank_account_holder_name),
    bank_name: norm(o.bank_name),
    bank_branch: norm(o.bank_branch),
    bank_account_no: norm(o.bank_account_no),
    bank_ifsc: norm(o.bank_ifsc),
  };
}

const GSTIN_BANK_KEYS: { key: keyof Omit<ReturnType<typeof sensitiveFromOrg>, "name">; label: string }[] = [
  { key: "gstin", label: "GSTIN / tax ID" },
  { key: "bank_account_holder_name", label: "Bank account holder" },
  { key: "bank_name", label: "Bank name" },
  { key: "bank_branch", label: "Bank branch" },
  { key: "bank_account_no", label: "Bank account number" },
  { key: "bank_ifsc", label: "Bank IFSC" },
];

function changedGstinBankLabels(
  cur: ReturnType<typeof sensitiveFromOrg>,
  next: ReturnType<typeof sensitiveFromOrg>,
): string[] {
  const out: string[] = [];
  for (const { key, label } of GSTIN_BANK_KEYS) {
    if (cur[key] !== next[key]) out.push(label);
  }
  return out;
}

function normCell(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function changedAddressApprovalLabels(
  org: Organization,
  input: {
    region?: string;
    orgAddressLine1?: string;
    orgAddressLine2?: string;
    orgCity?: string;
    orgState?: string;
    orgPin?: string;
    orgCountry?: string;
  },
): string[] {
  const labels: string[] = [];
  if (normCell(org.region) !== normCell(input.region?.trim() || null)) labels.push("Region / state");
  if (normCell(org.org_address_line1) !== normCell(input.orgAddressLine1?.trim() || null)) {
    labels.push("Address line 1");
  }
  if (normCell(org.org_address_line2) !== normCell(input.orgAddressLine2?.trim() || null)) {
    labels.push("Address line 2");
  }
  if (normCell(org.org_city) !== normCell(input.orgCity?.trim() || null)) labels.push("City");
  if (normCell(org.org_state) !== normCell(input.orgState?.trim() || null)) labels.push("State");
  if (normCell(org.org_pin) !== normCell(input.orgPin?.trim() || null)) labels.push("PIN / ZIP");
  if (normCell(org.org_country) !== normCell(input.orgCountry?.trim() || null)) {
    labels.push("Country (address)");
  }
  return labels;
}

type OrgRestPatch = {
  country_code: string;
  region: string | null;
  org_address_line1: string | null;
  org_address_line2: string | null;
  org_city: string | null;
  org_state: string | null;
  org_pin: string | null;
  org_country: string | null;
  org_email: string | null;
  org_mobile: string | null;
  default_currency: string;
};

type InstantOrgPatch = Pick<
  OrgRestPatch,
  "country_code" | "org_email" | "org_mobile" | "default_currency"
>;

function listInstantFieldChanges(org: Organization, patch: InstantOrgPatch): string[] {
  const labels: string[] = [];
  if (normCell(org.country_code).toUpperCase() !== normCell(patch.country_code).toUpperCase()) {
    labels.push("Country code");
  }
  if (normCell(org.org_email) !== normCell(patch.org_email)) labels.push("Email");
  if (normCell(org.org_mobile ?? "") !== normCell(patch.org_mobile)) labels.push("Mobile");
  if (normCell(org.default_currency).toUpperCase() !== normCell(patch.default_currency).toUpperCase()) {
    labels.push("Default currency");
  }
  return labels;
}

function listNonLegalFieldChanges(org: Organization, patch: OrgRestPatch): string[] {
  const labels: string[] = [];
  if (normCell(org.country_code).toUpperCase() !== normCell(patch.country_code).toUpperCase()) {
    labels.push("Country code");
  }
  if (normCell(org.region) !== normCell(patch.region)) labels.push("Region / state");
  if (normCell(org.org_address_line1) !== normCell(patch.org_address_line1)) labels.push("Address line 1");
  if (normCell(org.org_address_line2) !== normCell(patch.org_address_line2)) labels.push("Address line 2");
  if (normCell(org.org_city) !== normCell(patch.org_city)) labels.push("City");
  if (normCell(org.org_state) !== normCell(patch.org_state)) labels.push("State");
  if (normCell(org.org_pin) !== normCell(patch.org_pin)) labels.push("PIN / ZIP");
  if (normCell(org.org_country) !== normCell(patch.org_country)) labels.push("Country (address)");
  if (normCell(org.org_email) !== normCell(patch.org_email)) labels.push("Email");
  if (normCell(org.org_mobile ?? "") !== normCell(patch.org_mobile)) labels.push("Mobile");
  if (normCell(org.default_currency).toUpperCase() !== normCell(patch.default_currency).toUpperCase()) {
    labels.push("Default currency");
  }
  return labels;
}

function joinOxford(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** One line for notifications detail (full page); bell uses summary only. */
function settingsChangeLine(
  label: string,
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const f = normCell(from ?? "");
  const t = normCell(to ?? "");
  return `${label}: ${f || "—"} → ${t || "—"}`;
}

function approvalSubmissionDetailLines(
  org: Organization,
  input: {
    region?: string;
    orgAddressLine1?: string;
    orgAddressLine2?: string;
    orgCity?: string;
    orgState?: string;
    orgPin?: string;
    orgCountry?: string;
  },
  curSensitive: ReturnType<typeof sensitiveFromOrg>,
  nextSensitive: ReturnType<typeof sensitiveFromOrg>,
): string[] {
  const lines: string[] = [];
  for (const { key, label } of GSTIN_BANK_KEYS) {
    if (curSensitive[key] !== nextSensitive[key]) {
      lines.push(settingsChangeLine(label, curSensitive[key], nextSensitive[key]));
    }
  }
  if (normCell(org.region) !== normCell(input.region?.trim() || null)) {
    lines.push(settingsChangeLine("Region / state", org.region, input.region?.trim() ?? null));
  }
  if (normCell(org.org_address_line1) !== normCell(input.orgAddressLine1?.trim() || null)) {
    lines.push(settingsChangeLine("Address line 1", org.org_address_line1, input.orgAddressLine1?.trim() ?? null));
  }
  if (normCell(org.org_address_line2) !== normCell(input.orgAddressLine2?.trim() || null)) {
    lines.push(settingsChangeLine("Address line 2", org.org_address_line2, input.orgAddressLine2?.trim() ?? null));
  }
  if (normCell(org.org_city) !== normCell(input.orgCity?.trim() || null)) {
    lines.push(settingsChangeLine("City", org.org_city, input.orgCity?.trim() ?? null));
  }
  if (normCell(org.org_state) !== normCell(input.orgState?.trim() || null)) {
    lines.push(settingsChangeLine("State", org.org_state, input.orgState?.trim() ?? null));
  }
  if (normCell(org.org_pin) !== normCell(input.orgPin?.trim() || null)) {
    lines.push(settingsChangeLine("PIN / ZIP", org.org_pin, input.orgPin?.trim() ?? null));
  }
  if (normCell(org.org_country) !== normCell(input.orgCountry?.trim() || null)) {
    lines.push(settingsChangeLine("Country (address)", org.org_country, input.orgCountry?.trim() ?? null));
  }
  return lines;
}

function instantFieldDetailLines(org: Organization, patch: InstantOrgPatch): string[] {
  const lines: string[] = [];
  if (normCell(org.country_code).toUpperCase() !== normCell(patch.country_code).toUpperCase()) {
    lines.push(settingsChangeLine("Country code", org.country_code, patch.country_code));
  }
  if (normCell(org.org_email) !== normCell(patch.org_email)) {
    lines.push(settingsChangeLine("Email", org.org_email, patch.org_email));
  }
  if (normCell(org.org_mobile ?? "") !== normCell(patch.org_mobile)) {
    lines.push(settingsChangeLine("Mobile", org.org_mobile, patch.org_mobile));
  }
  if (normCell(org.default_currency).toUpperCase() !== normCell(patch.default_currency).toUpperCase()) {
    lines.push(settingsChangeLine("Default currency", org.default_currency, patch.default_currency));
  }
  return lines;
}

function adminSaveInfoMessage(
  approvalLabels: string[],
  instantLabels: string[],
): string | undefined {
  if (approvalLabels.length === 0 && instantLabels.length === 0) return undefined;
  const parts: string[] = [];
  if (approvalLabels.length > 0) {
    parts.push(
      `Submitted for account owner approval: ${joinOxford(approvalLabels)}. It will apply after approval.`,
    );
  }
  if (instantLabels.length > 0) {
    parts.push(`Saved: ${joinOxford(instantLabels)}.`);
  }
  return parts.join(" ");
}

async function assertProfileRequestInEntitlement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entitlementId: string,
  requestId: string,
): Promise<string> {
  const { data: row, error: rErr } = await supabase
    .from("organization_profile_change_requests")
    .select("organization_id, status")
    .eq("id", requestId)
    .single();
  if (rErr || !row) throw new Error("Request not found.");
  const r = row as { organization_id: string; status: string };
  if (r.status !== "pending") throw new Error("This request is no longer pending.");

  const { data: org, error: oErr } = await supabase
    .from("organizations")
    .select("entitlement_id")
    .eq("id", r.organization_id)
    .single();
  if (oErr || !org) throw new Error("Company not found.");
  if ((org as { entitlement_id: string }).entitlement_id !== entitlementId) {
    throw new Error("You cannot act on this request.");
  }
  return r.organization_id;
}

export async function updateCompany(input: {
  name: string;
  countryCode: string;
  region?: string;
  gstin?: string;
  orgAddressLine1?: string;
  orgAddressLine2?: string;
  orgCity?: string;
  orgState?: string;
  orgPin?: string;
  orgCountry?: string;
  orgEmail?: string;
  orgMobile?: string;
  defaultCurrency?: string;
  bankAccountHolderName?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}): Promise<{ pendingLegalSubmitted?: boolean; infoMessage?: string }> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!ctx.canManageMemberships) throw new Error("Only company admins or the account owner can edit company settings.");

  const countryCode = input.countryCode.trim().toUpperCase() || "IN";
  const gstin =
    countryCode === "IN" ? gstinForDatabase(input.gstin) : input.gstin?.trim() || null;
  const orgMobileNorm = input.orgMobile?.trim() ? requireValidIntlMobileOrNull(input.orgMobile) : null;
  const orgCountry = input.orgCountry?.trim() || null;
  const defaultCurrency = input.defaultCurrency?.trim().toUpperCase().slice(0, 3) || "INR";

  assertIndiaCommercialEntitlementProfile({
    commercial_region: ctx.organization.commercial_region,
    country_code: countryCode,
    org_country: orgCountry,
    gstin,
    default_currency: defaultCurrency,
  });

  const supabase = await createClient();
  const ownerHere = isAccountOwnerForActiveOrg(ctx);

  if (!ownerHere && norm(input.name) !== norm(ctx.organization.name)) {
    throw new Error("Only the account owner can change the company name.");
  }

  const nextSensitive = sensitiveFromInput({
    name: input.name,
    countryCode,
    gstin: input.gstin,
    bankAccountHolderName: input.bankAccountHolderName,
    bankName: input.bankName,
    bankBranch: input.bankBranch,
    bankAccountNo: input.bankAccountNo,
    bankIfsc: input.bankIfsc,
  });
  const curSensitive = sensitiveFromOrg(ctx.organization);

  const restPatch: OrgRestPatch = {
    country_code: countryCode,
    region: input.region?.trim() || null,
    org_address_line1: input.orgAddressLine1?.trim() || null,
    org_address_line2: input.orgAddressLine2?.trim() || null,
    org_city: input.orgCity?.trim() || null,
    org_state: input.orgState?.trim() || null,
    org_pin: input.orgPin?.trim() || null,
    org_country: orgCountry,
    org_email: normalizeOptionalOrgEmail(input.orgEmail),
    org_mobile: orgMobileNorm,
    default_currency: defaultCurrency,
  };

  const instantPatch: InstantOrgPatch = {
    country_code: restPatch.country_code,
    org_email: restPatch.org_email,
    org_mobile: restPatch.org_mobile,
    default_currency: restPatch.default_currency,
  };

  const gstinBankLabels = changedGstinBankLabels(curSensitive, nextSensitive);
  const addressLabels = changedAddressApprovalLabels(ctx.organization, input);
  const approvalLabels = [...gstinBankLabels, ...addressLabels];
  const approvalNeeded = approvalLabels.length > 0;

  const instantLabels = listInstantFieldChanges(ctx.organization, instantPatch);

  if (!ownerHere && !approvalNeeded && instantLabels.length === 0) {
    return {};
  }

  let pendingLegalSubmitted = false;
  let infoMessage: string | undefined;

  if (ownerHere) {
    const otherLabels = listNonLegalFieldChanges(ctx.organization, restPatch);
    const nameOrTaxOrBankChanged =
      curSensitive.name !== nextSensitive.name || gstinBankLabels.length > 0;
    if (!nameOrTaxOrBankChanged && otherLabels.length === 0) {
      return {};
    }
    const { error } = await supabase
      .from("organizations")
      .update({
        ...restPatch,
        name: nextSensitive.name,
        gstin: gstin,
        bank_account_holder_name: nextSensitive.bank_account_holder_name || null,
        bank_name: nextSensitive.bank_name || null,
        bank_branch: nextSensitive.bank_branch || null,
        bank_account_no: nextSensitive.bank_account_no || null,
        bank_ifsc: nextSensitive.bank_ifsc || null,
      })
      .eq("id", ctx.organization.id);
    if (error) throw error;

    const summaryParts: string[] = [];
    if (curSensitive.name !== nextSensitive.name) summaryParts.push("Company name");
    summaryParts.push(...gstinBankLabels);
    summaryParts.push(...addressLabels);
    summaryParts.push(...instantLabels);

    const ownerDetailLines: string[] = [];
    if (curSensitive.name !== nextSensitive.name) {
      ownerDetailLines.push(settingsChangeLine("Company name", curSensitive.name, nextSensitive.name));
    }
    ownerDetailLines.push(
      ...approvalSubmissionDetailLines(ctx.organization, input, curSensitive, nextSensitive),
    );
    ownerDetailLines.push(...instantFieldDetailLines(ctx.organization, instantPatch));

    await insertOrganizationActivity(
      supabase,
      ctx.organization.id,
      ctx.userId,
      `Company profile updated: ${joinOxford(summaryParts)}.`,
      ownerDetailLines.length > 0 ? ownerDetailLines : null,
    );
  } else {
    const { error } = await supabase.from("organizations").update(instantPatch).eq("id", ctx.organization.id);
    if (error) throw error;

    if (approvalNeeded) {
      const approvalDetailLines = approvalSubmissionDetailLines(
        ctx.organization,
        input,
        curSensitive,
        nextSensitive,
      );
      const { error: rpcErr } = await supabase.rpc("submit_org_profile_change_request", {
        p_org_id: ctx.organization.id,
        p_proposed_name: norm(ctx.organization.name),
        p_proposed_gstin: nextSensitive.gstin || "",
        p_proposed_bank_account_holder_name: nextSensitive.bank_account_holder_name,
        p_proposed_bank_name: nextSensitive.bank_name,
        p_proposed_bank_branch: nextSensitive.bank_branch,
        p_proposed_bank_account_no: nextSensitive.bank_account_no,
        p_proposed_bank_ifsc: nextSensitive.bank_ifsc,
        p_proposed_region: input.region?.trim() ?? "",
        p_proposed_org_address_line1: input.orgAddressLine1?.trim() ?? "",
        p_proposed_org_address_line2: input.orgAddressLine2?.trim() ?? "",
        p_proposed_org_city: input.orgCity?.trim() ?? "",
        p_proposed_org_state: input.orgState?.trim() ?? "",
        p_proposed_org_pin: input.orgPin?.trim() ?? "",
        p_proposed_org_country: input.orgCountry?.trim() ?? "",
      });
      if (rpcErr) throw new Error(rpcErr.message);
      pendingLegalSubmitted = true;
      await insertOrganizationActivity(
        supabase,
        ctx.organization.id,
        ctx.userId,
        `Submitted for account owner approval: ${joinOxford(approvalLabels)}.`,
        approvalDetailLines.length > 0 ? approvalDetailLines : null,
      );
    }

    if (instantLabels.length > 0) {
      const instantDetailLines = instantFieldDetailLines(ctx.organization, instantPatch);
      await insertOrganizationActivity(
        supabase,
        ctx.organization.id,
        ctx.userId,
        `Company settings updated: ${joinOxford(instantLabels)}.`,
        instantDetailLines.length > 0 ? instantDetailLines : null,
      );
    }

    infoMessage = adminSaveInfoMessage(approvalLabels, instantLabels);
  }

  revalidatePath("/settings/company");
  revalidatePath("/settings/pricing");
  revalidatePath("/settings/account");
  revalidatePath("/settings/notifications");
  revalidatePath("/quotations");
  revalidatePath("/delivery-challans");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { pendingLegalSubmitted, infoMessage };
}

export type DocumentTermsKind = "quotation" | "purchase_order" | "delivery_challan" | "packing_list";

const DOCUMENT_TERMS_FIELD: Record<DocumentTermsKind, keyof Organization> = {
  quotation: "quotation_terms",
  purchase_order: "purchase_order_terms",
  delivery_challan: "delivery_challan_terms",
  packing_list: "packing_terms",
};

const DOCUMENT_TERMS_LABEL: Record<DocumentTermsKind, string> = {
  quotation: "Quotation terms",
  purchase_order: "Purchase order terms",
  delivery_challan: "Delivery challan terms",
  packing_list: "Packing list terms",
};

export async function saveDocumentTerms(kind: DocumentTermsKind, terms: string) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!ctx.canManageMemberships) {
    throw new Error("Only company admins or the account owner can edit company settings.");
  }

  const field = DOCUMENT_TERMS_FIELD[kind];
  const label = DOCUMENT_TERMS_LABEL[kind];
  const next = terms.trim() || null;
  const prev = normCell(ctx.organization[field] as string | null | undefined);

  if (prev === normCell(next)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ [field]: next })
    .eq("id", ctx.organization.id);
  if (error) throw error;

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    `${label} updated.`,
    [settingsChangeLine(label, prev || null, next)],
  );

  revalidatePath("/settings/company");
  revalidatePath("/quotations");
  revalidatePath("/purchase-orders");
  revalidatePath("/delivery-challans");
  revalidatePath("/packing-lists");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function approveOrgProfileChangeRequest(requestId: string) {
  const ctx = await getOrgContext();
  if (!ctx?.entitlement || !isAccountOwnerForActiveOrg(ctx)) {
    throw new Error("Only the account owner can approve these changes.");
  }
  const supabase = await createClient();
  const orgId = await assertProfileRequestInEntitlement(supabase, ctx.entitlement.id, requestId);

  const { data: pendingRow } = await supabase
    .from("organization_profile_change_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select(
      "id, name, gstin, region, org_address_line1, org_address_line2, org_city, org_state, org_pin, org_country, bank_account_holder_name, bank_name, bank_branch, bank_account_no, bank_ifsc",
    )
    .eq("id", orgId)
    .single();

  const diffRows =
    pendingRow && orgRow
      ? profilePendingDiff(
          orgToProfileSnapshot(orgRow as Organization),
          pendingRow as PendingOrgProfileChange,
        )
      : [];

  const { error } = await supabase.rpc("master_approve_org_profile_change_request", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);

  if (diffRows.length > 0) {
    const detailLines = diffRows.map((d) => `${d.label}: ${d.current} → ${d.proposed}`);
    await insertOrganizationActivity(
      supabase,
      orgId,
      ctx.userId,
      diffRows.length === 1
        ? `Profile change approved: ${diffRows[0].label}.`
        : `Profile change approved (${diffRows.length} fields).`,
      detailLines,
    );
  } else {
    await insertOrganizationActivity(
      supabase,
      orgId,
      ctx.userId,
      "Profile change request approved.",
    );
  }

  revalidatePath("/settings/company");
  revalidatePath("/settings/account");
  revalidatePath("/settings/notifications");
  revalidatePath("/quotations");
  revalidatePath("/delivery-challans");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function rejectOrgProfileChangeRequest(requestId: string, note?: string) {
  const ctx = await getOrgContext();
  if (!ctx?.entitlement || !isAccountOwnerForActiveOrg(ctx)) {
    throw new Error("Only the account owner can reject these changes.");
  }
  const supabase = await createClient();
  const orgId = await assertProfileRequestInEntitlement(supabase, ctx.entitlement.id, requestId);
  const trimmedNote = note?.trim() ?? "";
  const { error } = await supabase.rpc("master_reject_org_profile_change_request", {
    p_request_id: requestId,
    p_note: trimmedNote,
  });
  if (error) throw new Error(error.message);

  await insertOrganizationActivity(
    supabase,
    orgId,
    ctx.userId,
    trimmedNote
      ? `Profile change request rejected. Note: ${trimmedNote}`
      : "Profile change request rejected.",
  );

  revalidatePath("/settings/company");
  revalidatePath("/settings/account");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function uploadOrgLogo(formData: FormData) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("Unauthorized");
  if (!isAccountOwnerForActiveOrg(ctx)) {
    throw new Error("Only the account owner can change the company logo.");
  }

  const file = formData.get("logo");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "No file selected" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const safeExt = ext && ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";
  const path = `${ctx.organization.id}/logo.${safeExt}`;

  const supabase = await createClient();
  const { error: upErr } = await supabase.storage.from("org-logos").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from("organizations")
    .update({ logo_storage_path: path })
    .eq("id", ctx.organization.id);

  if (dbErr) throw dbErr;

  await insertOrganizationActivity(supabase, ctx.organization.id, ctx.userId, "Company logo updated.");

  revalidatePath("/settings/company");
  revalidatePath("/settings/account");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeOrgLogo() {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("Unauthorized");
  if (!isAccountOwnerForActiveOrg(ctx)) {
    throw new Error("Only the account owner can change the company logo.");
  }
  if (!ctx.organization.logo_storage_path) return { ok: true as const };

  const supabase = await createClient();
  await supabase.storage.from("org-logos").remove([ctx.organization.logo_storage_path]);
  const { error } = await supabase
    .from("organizations")
    .update({ logo_storage_path: null })
    .eq("id", ctx.organization.id);

  if (error) throw error;

  await insertOrganizationActivity(supabase, ctx.organization.id, ctx.userId, "Company logo removed.");

  revalidatePath("/settings/company");
  revalidatePath("/settings/account");
  revalidatePath("/settings/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

function clampSeriesSlot(n: number, maxSlots: number): number {
  if (!Number.isFinite(n)) return 1;
  const x = Math.floor(n);
  if (x < 1) return 1;
  if (x > maxSlots) return maxSlots;
  return x;
}

export async function saveDocumentNumberingSettings(input: {
  docSeriesMode: string;
  docNumberFormat: string;
  docSeriesCustomMonth?: number | null;
  docSeriesCustomDay?: number | null;
  docPrefixQuotation: string;
  docPrefixPurchaseOrder: string;
  docPrefixPackingList: string;
  docPrefixDeliveryChallan: string;
  docPrefixGatePass: string;
  docPrefixVisitor: string;
  docMultiSeriesEnabled?: boolean;
  docSeriesExtras?: Array<{ mode: string; month?: number | null; day?: number | null }>;
  docSeriesSlotQuotation?: number;
  docSeriesSlotPurchaseOrder?: number;
  docSeriesSlotPackingList?: number;
  docSeriesSlotDeliveryChallan?: number;
  docSeriesSlotGatePass?: number;
  docSeriesSlotVisitor?: number;
  docPrefixOverridesBySlot?: DocPrefixOverridesBySlot;
}) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) throw new Error("Unauthorized");

  const plan = ctx.organization.plan;
  const canAdv =
    isAccountOwnerForActiveOrg(ctx) || Boolean(ctx.membership.is_company_admin);
  const maxSlots = maxDocumentSeriesSlots(plan);

  let multiEnabled: boolean;
  if (plan === "free") {
    multiEnabled = false;
  } else if (canAdv) {
    multiEnabled = Boolean(input.docMultiSeriesEnabled);
  } else {
    multiEnabled = Boolean(ctx.organization.doc_multi_series_enabled);
  }

  if (plan !== "free" && input.docMultiSeriesEnabled === true && !canAdv) {
    throw new Error("Only a company admin or account owner can turn on multiple numbering series.");
  }

  const mode = normalizeDocSeriesMode(input.docSeriesMode, plan);
  const fmt = plan === "free" ? "dash" : normalizeDocNumberFormat(input.docNumberFormat);

  const supabase = await createClient();
  const { data: seqRows } = await supabase
    .from("document_sequences")
    .select("series_key")
    .eq("organization_id", ctx.organization.id)
    .gt("last_number", 0);

  const usedSlots = usedDocumentSeriesSlots(seqRows as { series_key: string }[] | null);

  const fp1Old = fingerprintSeriesSlot1(ctx.organization);
  let fp1New: string;
  if (mode === "year_custom") {
    const mo = input.docSeriesCustomMonth;
    const dy = input.docSeriesCustomDay;
    if (mo == null || dy == null) {
      throw new Error("Choose a month and day for the annual reset.");
    }
    assertValidAnnualResetDay(mo, dy);
    fp1New = fingerprintSeriesSlot1({
      doc_series_mode: mode,
      doc_series_custom_month: mo,
      doc_series_custom_day: dy,
    });
  } else {
    fp1New = fingerprintSeriesSlot1({
      doc_series_mode: mode,
      doc_series_custom_month: null,
      doc_series_custom_day: null,
    });
  }

  if (fp1Old !== fp1New && usedSlots.has(1)) {
    throw new Error(
      "Series 1 reset schedule cannot be changed — documents have already been issued using this series.",
    );
  }

  const extrasCount = multiEnabled ? maxSlots - 1 : 0;
  const oldExtras = parseDocSeriesProfilesJson(
    ctx.organization.doc_series_profiles,
    Math.max(0, extrasCount),
  );

  const extrasNormalized: DocSeriesExtraProfile[] = [];
  if (plan !== "free" && multiEnabled && extrasCount > 0 && canAdv) {
    const raw = input.docSeriesExtras ?? [];
    for (let i = 0; i < extrasCount; i++) {
      const row = raw[i];
      const base: DocSeriesExtraProfile = {
        mode: normalizeDocSeriesMode(String(row?.mode ?? "year_april"), plan),
        month: typeof row?.month === "number" ? row.month : null,
        day: typeof row?.day === "number" ? row.day : null,
      };
      extrasNormalized.push(normalizeExtraSeriesProfile(base, plan));
    }
    for (let i = 0; i < extrasNormalized.length; i++) {
      const slotNum = i + 2;
      if (
        fingerprintExtraProfile(oldExtras[i]!) !== fingerprintExtraProfile(extrasNormalized[i]!) &&
        usedSlots.has(slotNum)
      ) {
        throw new Error(
          `Series ${slotNum} reset schedule cannot be changed — documents have already been issued using this series.`,
        );
      }
    }
  }

  const patch: Record<string, unknown> = {
    doc_series_mode: mode,
    doc_number_format: fmt,
  };

  if (mode === "year_custom") {
    const mo = input.docSeriesCustomMonth;
    const dy = input.docSeriesCustomDay;
    if (mo == null || dy == null) {
      throw new Error("Choose a month and day for the annual reset.");
    }
    assertValidAnnualResetDay(mo, dy);
    patch.doc_series_custom_month = mo;
    patch.doc_series_custom_day = dy;
  } else {
    patch.doc_series_custom_month = null;
    patch.doc_series_custom_day = null;
  }

  if (plan === "free") {
    patch.doc_multi_series_enabled = false;
    patch.doc_series_profiles = [];
    patch.doc_series_default_slot = 1;
    patch.doc_series_slot_quotation = null;
    patch.doc_series_slot_purchase_order = null;
    patch.doc_series_slot_packing_list = null;
    patch.doc_series_slot_delivery_challan = null;
    patch.doc_series_slot_gate_pass = null;
    patch.doc_series_slot_visitor = null;
    patch.doc_prefix_overrides = {};
  } else if (canAdv) {
    patch.doc_multi_series_enabled = multiEnabled;
    patch.doc_series_profiles = multiEnabled ? docSeriesProfilesForDb(extrasNormalized) : [];

    if (multiEnabled) {
      const qSlot = clampSeriesSlot(
        Number(input.docSeriesSlotQuotation ?? 1),
        maxSlots,
      );
      patch.doc_series_default_slot = qSlot;
      patch.doc_series_slot_quotation = qSlot;
      patch.doc_series_slot_purchase_order = clampSeriesSlot(
        Number(input.docSeriesSlotPurchaseOrder ?? 1),
        maxSlots,
      );
      patch.doc_series_slot_packing_list = clampSeriesSlot(
        Number(input.docSeriesSlotPackingList ?? 1),
        maxSlots,
      );
      patch.doc_series_slot_delivery_challan = clampSeriesSlot(
        Number(input.docSeriesSlotDeliveryChallan ?? 1),
        maxSlots,
      );
      patch.doc_series_slot_gate_pass = clampSeriesSlot(
        Number(input.docSeriesSlotGatePass ?? 1),
        maxSlots,
      );
      patch.doc_series_slot_visitor = clampSeriesSlot(
        Number(input.docSeriesSlotVisitor ?? 1),
        maxSlots,
      );
      patch.doc_prefix_overrides = serializeDocPrefixOverridesForDb(
        input.docPrefixOverridesBySlot ?? emptyPrefixOverridesBySlot(maxSlots),
        maxSlots,
      );
    } else {
      patch.doc_series_default_slot = 1;
      patch.doc_series_slot_quotation = null;
      patch.doc_series_slot_purchase_order = null;
      patch.doc_series_slot_packing_list = null;
      patch.doc_series_slot_delivery_challan = null;
      patch.doc_series_slot_gate_pass = null;
      patch.doc_series_slot_visitor = null;
      patch.doc_prefix_overrides = {};
    }
  }

  if (plan !== "free") {
    patch.doc_prefix_quotation = validatePaidDocPrefix("Quotation prefix", input.docPrefixQuotation);
    patch.doc_prefix_purchase_order = validatePaidDocPrefix(
      "Purchase order prefix",
      input.docPrefixPurchaseOrder,
    );
    patch.doc_prefix_packing_list = validatePaidDocPrefix(
      "Packing list prefix",
      input.docPrefixPackingList,
    );
    patch.doc_prefix_delivery_challan = validatePaidDocPrefix(
      "Delivery challan prefix",
      input.docPrefixDeliveryChallan,
    );
    patch.doc_prefix_gate_pass = validatePaidDocPrefix("Gate pass prefix", input.docPrefixGatePass);
    patch.doc_prefix_visitor = validatePaidDocPrefix("Visitor pass prefix", input.docPrefixVisitor);
  }

  const { error } = await supabase.from("organizations").update(patch).eq("id", ctx.organization.id);
  if (error) throw error;

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    "Document numbering settings updated.",
    null,
  );

  revalidatePath("/settings/company");
  revalidatePath("/", "layout");
}

export async function updateVisitorPassPrintLayout(layout: VisitorPassPrintLayout) {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("Unauthorized");
  if (!ctx.canManageMemberships) {
    throw new Error("Only company admins or the account owner can edit company settings.");
  }

  const normalized: VisitorPassPrintLayout = layout === "a5_foldable" ? "a5_foldable" : "id_card";

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ visitor_pass_print_layout: normalized })
    .eq("id", ctx.organization.id);
  if (error) throw error;

  await insertOrganizationActivity(
    supabase,
    ctx.organization.id,
    ctx.userId,
    `Visitor pass print layout set to ${normalized === "a5_foldable" ? "A5 foldable" : "ID-1 card"}.`,
    null,
  );

  revalidatePath("/settings/company");
  revalidatePath("/", "layout");
}
