import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { usedDocumentSeriesSlots } from "@/lib/documents/document-numbering";
import {
  defaultDeliveryChallanTerms,
  defaultPackingTerms,
  defaultQuotationTerms,
} from "@/lib/packing/types";
import { orgToProfileSnapshot, profilePendingDiff } from "./profile-diff";
import { CompanyForm } from "./ui";
import { DocumentNumberingSection } from "./document-numbering-section";
import { LogoBlock } from "./logo-block";
import { VisitorPassPrintLayoutSection } from "./visitor-pass-print-layout-section";
import type { PendingOrgProfileChange } from "./profile-types";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { normalizeVisitorPassPrintLayout } from "@/lib/visitors/visitor-pass-print-layout";

export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ onboarding?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const rawOnboarding = sp.onboarding;
  const onboarding =
    rawOnboarding === "1" ||
    rawOnboarding === "true" ||
    (Array.isArray(rawOnboarding) &&
      (rawOnboarding[0] === "1" || rawOnboarding[0] === "true"));

  const ctx = await getOrgContext();
  if (!ctx) return null;
  if (!ctx.canManageMemberships) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: pendingRows } = await supabase
    .from("organization_profile_change_requests")
    .select(
      "id, organization_id, requested_by_user_id, proposed_name, proposed_gstin, proposed_bank_account_holder_name, proposed_bank_name, proposed_bank_branch, proposed_bank_account_no, proposed_bank_ifsc, proposed_region, proposed_org_address_line1, proposed_org_address_line2, proposed_org_city, proposed_org_state, proposed_org_pin, proposed_org_country, created_at",
    )
    .eq("organization_id", ctx.organization.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const isAccountOwnerForOrg = isAccountOwnerForActiveOrg(ctx);
  const canConfigureAdvancedNumbering =
    isAccountOwnerForOrg || Boolean(ctx.membership.is_company_admin);

  const o = ctx.organization;

  const { data: seqRows } = await supabase
    .from("document_sequences")
    .select("series_key")
    .eq("organization_id", o.id)
    .gt("last_number", 0);

  const usedSlots = Array.from(usedDocumentSeriesSlots(seqRows as { series_key: string }[] | null)).sort(
    (a, b) => a - b,
  );
  const liveSnapshot = orgToProfileSnapshot(o);
  const pendingQueue = ((pendingRows ?? []) as PendingOrgProfileChange[]).map((row) => ({
    ...row,
    diffRows: profilePendingDiff(liveSnapshot, row),
  }));

  const docNumberingKey = [
    o.id,
    o.doc_series_mode ?? "",
    String(o.doc_multi_series_enabled ?? false),
    JSON.stringify(o.doc_series_profiles ?? []),
    JSON.stringify(o.doc_prefix_overrides ?? {}),
    String(o.doc_series_default_slot ?? 1),
    String(o.doc_series_slot_quotation ?? ""),
    String(o.doc_series_slot_packing_list ?? ""),
    String(o.doc_series_slot_delivery_challan ?? ""),
    String(o.doc_series_slot_gate_pass ?? ""),
    String(o.doc_series_slot_visitor ?? ""),
  ].join("|");

  const formResetKey = [
    o.name,
    o.gstin ?? "",
    o.bank_account_holder_name ?? "",
    o.bank_name ?? "",
    o.bank_branch ?? "",
    o.bank_account_no ?? "",
    o.bank_ifsc ?? "",
    o.region ?? "",
    o.org_address_line1 ?? "",
    o.org_city ?? "",
    pendingQueue.map((p) => p.id).join(","),
  ].join("|");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-semibold leading-tight">Company profile</h1>
        <p className="text-sm text-[var(--muted)]">
          Keep your company profile updated, so your documents look professional.
        </p>
      </div>

      {onboarding ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
          Complete your organization profile below. When you save, you’ll go to the dashboard.
        </p>
      ) : null}

      <LogoBlock logoPath={o.logo_storage_path} canEditLogo={isAccountOwnerForOrg} />

      <CompanyForm
        key={formResetKey}
        isAccountOwnerForOrg={isAccountOwnerForOrg}
        pendingQueue={pendingQueue}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
        afterSaveRedirect={onboarding ? "/dashboard" : null}
        initial={{
          name: o.name,
          countryCode: coerceToLibphonenumberCountry(o.country_code),
          region: o.region ?? "",
          gstin: o.gstin ?? "",
          orgAddressLine1: o.org_address_line1 ?? "",
          orgAddressLine2: o.org_address_line2 ?? "",
          orgCity: o.org_city ?? "",
          orgState: o.org_state ?? "",
          orgPin: o.org_pin ?? "",
          orgCountry: o.org_country ?? "India",
          orgEmail: o.org_email ?? "",
          orgMobile: o.org_mobile ?? "",
          packingTerms: o.packing_terms?.trim() ? o.packing_terms : defaultPackingTerms(),
          deliveryChallanTerms: o.delivery_challan_terms?.trim()
            ? o.delivery_challan_terms
            : defaultDeliveryChallanTerms(),
          defaultCurrency: o.default_currency || "INR",
          bankAccountHolderName: o.bank_account_holder_name ?? "",
          bankName: o.bank_name ?? "",
          bankBranch: o.bank_branch ?? "",
          bankAccountNo: o.bank_account_no ?? "",
          bankIfsc: o.bank_ifsc ?? "",
          quotationTerms: o.quotation_terms?.trim() ? o.quotation_terms : defaultQuotationTerms(),
        }}
      />

      <DocumentNumberingSection
        key={docNumberingKey}
        organization={o}
        canManage
        usedSlots={usedSlots}
        canConfigureAdvancedNumbering={canConfigureAdvancedNumbering}
      />

      <VisitorPassPrintLayoutSection
        initialLayout={normalizeVisitorPassPrintLayout(o.visitor_pass_print_layout)}
      />
    </div>
  );
}
