import { resolveActivityActorLabels } from "@/lib/activity-actor-labels";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import type { Organization } from "@/types/database";
import {
  OrgSettingsActivityFeed,
  ProfileApprovalsPanel,
  type AccountPendingRow,
} from "../account/profile-approvals-panel";
import { orgToProfileSnapshot, profilePendingDiff } from "../company/profile-diff";
import type { PendingOrgProfileChange } from "../company/profile-types";

const ACTIVITY_LIMIT = 100;

export default async function NotificationsPage() {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) return null;

  const supabase = await createClient();
  const isOwner = isAccountOwnerForActiveOrg(ctx);

  const orgIds = ctx.accessibleOrganizations.map((o) => o.id);
  const companyNameById = new Map(ctx.accessibleOrganizations.map((o) => [o.id, o.name] as const));

  let pendingForAccount: AccountPendingRow[] = [];

  if (isOwner && ctx.entitlement) {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("entitlement_id", ctx.entitlement.id)
      .order("name", { ascending: true });

    const companies = (orgRows ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) || "Company",
    }));

    const pendingNameById = new Map(companies.map((c) => [c.id, c.name] as const));
    const pendingOrgIds = companies.map((c) => c.id);

    const { data: orgSnapRows } =
      pendingOrgIds.length > 0
        ? await supabase
            .from("organizations")
            .select(
              "id, name, gstin, region, org_address_line1, org_address_line2, org_city, org_state, org_pin, org_country, bank_account_holder_name, bank_name, bank_branch, bank_account_no, bank_ifsc",
            )
            .in("id", pendingOrgIds)
        : { data: [] as unknown[] };

    const snapById = new Map(
      (orgSnapRows ?? []).map((row) => {
        const r = row as { id: string };
        return [r.id, orgToProfileSnapshot(row as unknown as Organization)] as const;
      }),
    );

    const { data: pendingRows } =
      pendingOrgIds.length > 0
        ? await supabase
            .from("organization_profile_change_requests")
            .select(
              "id, organization_id, requested_by_user_id, proposed_name, proposed_gstin, proposed_bank_account_holder_name, proposed_bank_name, proposed_bank_branch, proposed_bank_account_no, proposed_bank_ifsc, proposed_region, proposed_org_address_line1, proposed_org_address_line2, proposed_org_city, proposed_org_state, proposed_org_pin, proposed_org_country, created_at",
            )
            .in("organization_id", pendingOrgIds)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
        : { data: [] as unknown[] };

    pendingForAccount = ((pendingRows ?? []) as PendingOrgProfileChange[]).map((p) => {
      const live = snapById.get(p.organization_id);
      const diffRows = live ? profilePendingDiff(live, p) : [];
      return {
        ...p,
        company_name: pendingNameById.get(p.organization_id) ?? "Company",
        diffRows,
      };
    });
  }

  const { data: activityRows } =
    orgIds.length > 0
      ? await supabase
          .from("organization_settings_activity")
          .select("id, organization_id, actor_user_id, summary, detail, created_at")
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_LIMIT)
      : { data: [] as unknown[] };

  function activityDetailLines(raw: unknown): string[] | null {
    if (!raw || !Array.isArray(raw)) return null;
    const lines = raw.filter((x): x is string => typeof x === "string");
    return lines.length > 0 ? lines : null;
  }

  const activityRaw = (activityRows ?? []) as {
    id: string;
    organization_id: string;
    actor_user_id: string;
    summary: string;
    detail: unknown;
    created_at: string;
  }[];

  const actorIds = [...new Set(activityRaw.map((a) => a.actor_user_id))];
  const actorLabelById =
    actorIds.length > 0 ? await resolveActivityActorLabels(actorIds) : new Map<string, string>();

  const activityEntries = activityRaw.map((a) => ({
    id: a.id,
    organization_id: a.organization_id,
    company_name: companyNameById.get(a.organization_id) ?? "Company",
    summary: a.summary,
    detail_lines: activityDetailLines(a.detail),
    created_at: a.created_at,
    actor_label:
      actorLabelById.get(a.actor_user_id) ?? `User (${a.actor_user_id.slice(0, 8)}…)`,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Company profile activity, approvals, and team &amp; access changes for organizations you manage.
        </p>
      </div>

      {isOwner ? <ProfileApprovalsPanel pending={pendingForAccount} /> : null}

      <OrgSettingsActivityFeed entries={activityEntries} />
    </div>
  );
}
