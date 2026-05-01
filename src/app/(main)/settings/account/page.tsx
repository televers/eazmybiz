import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import {
  commercialRegionLabel,
  countOrganizationsForEntitlement,
  maxUsersForPlan,
} from "@/lib/plan/entitlements";
import type { Organization } from "@/types/database";
import { AccountPanel } from "./account-panel";
import { ProfileApprovalsPanel } from "./profile-approvals-panel";
import { orgToProfileSnapshot, profilePendingDiff } from "../company/profile-diff";
import type { PendingOrgProfileChange } from "../company/profile-types";

export default async function AccountSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  if (!ctx.isMasterAdmin || !ctx.entitlement) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const companyCount = await countOrganizationsForEntitlement(supabase, ctx.entitlement.id);

  const { data: orgRows } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("entitlement_id", ctx.entitlement.id)
    .order("name", { ascending: true });

  const companies = (orgRows ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) || "Company",
  }));

  const companyNameById = new Map(companies.map((c) => [c.id, c.name] as const));
  const orgIds = companies.map((c) => c.id);

  const { data: orgSnapRows } =
    orgIds.length > 0
      ? await supabase
          .from("organizations")
          .select(
            "id, name, gstin, region, org_address_line1, org_address_line2, org_city, org_state, org_pin, org_country, bank_account_holder_name, bank_name, bank_branch, bank_account_no, bank_ifsc",
          )
          .in("id", orgIds)
      : { data: [] as unknown[] };

  const snapById = new Map(
    (orgSnapRows ?? []).map((row) => {
      const r = row as { id: string };
      return [r.id, orgToProfileSnapshot(row as unknown as Organization)] as const;
    }),
  );

  const { data: pendingRows } =
    orgIds.length > 0
      ? await supabase
          .from("organization_profile_change_requests")
          .select(
            "id, organization_id, requested_by_user_id, proposed_name, proposed_gstin, proposed_bank_account_holder_name, proposed_bank_name, proposed_bank_branch, proposed_bank_account_no, proposed_bank_ifsc, proposed_region, proposed_org_address_line1, proposed_org_address_line2, proposed_org_city, proposed_org_state, proposed_org_pin, proposed_org_country, created_at",
          )
          .in("organization_id", orgIds)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
      : { data: [] as unknown[] };

  const pendingForAccount = ((pendingRows ?? []) as PendingOrgProfileChange[]).map((p) => {
    const live = snapById.get(p.organization_id);
    const diffRows = live ? profilePendingDiff(live, p) : [];
    return {
      ...p,
      company_name: companyNameById.get(p.organization_id) ?? "Company",
      diffRows,
    };
  });

  const ent = ctx.entitlement;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage all companies under your subscription.           Full activity history is under{" "}
          <Link href="/settings/notifications" className="font-medium text-sky-700 underline dark:text-sky-300">
            Notifications
          </Link>
          .
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <h2 className="font-medium text-[var(--foreground)]">Plan &amp; billing region</h2>
        <dl className="mt-2 grid gap-2 text-[var(--muted)]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Commercial region</dt>
            <dd className="text-right font-medium text-[var(--foreground)]">
              {commercialRegionLabel(ent.commercial_region)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Plan tier</dt>
            <dd className="text-right font-medium capitalize text-[var(--foreground)]">{ent.plan}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Companies / users (limit)</dt>
            <dd className="text-right font-medium text-[var(--foreground)]">
              {ent.max_companies} companies · up to {maxUsersForPlan(ent.plan)} users
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Changing commercial region or paid tier will use checkout when billing is connected. India-priced accounts
          must keep an India commercial profile on each company you use for documents.
        </p>
      </div>

      <ProfileApprovalsPanel pending={pendingForAccount} />

      <AccountPanel
        companies={companies}
        companyCount={companyCount}
        companyLimit={ctx.entitlement.max_companies}
      />
    </div>
  );
}
