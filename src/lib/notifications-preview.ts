import { createClient } from "@/lib/supabase/server";
import type { FullOrgContext } from "@/lib/org";
import { isAccountOwnerForActiveOrg } from "@/lib/org";

export type NotificationPreviewItem = {
  id: string;
  summary: string;
  created_at: string;
  company_name: string;
};

export type NotificationPreview = {
  items: NotificationPreviewItem[];
  pendingApprovalCount: number;
};

export async function fetchNotificationPreview(ctx: FullOrgContext): Promise<NotificationPreview> {
  const orgIds = ctx.accessibleOrganizations.map((o) => o.id);
  const nameById = new Map(ctx.accessibleOrganizations.map((o) => [o.id, o.name] as const));

  if (orgIds.length === 0) {
    return { items: [], pendingApprovalCount: 0 };
  }

  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("organization_settings_activity")
    .select("id, summary, created_at, organization_id")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false })
    .limit(12);

  const items: NotificationPreviewItem[] = (activity ?? []).map((row) => ({
    id: row.id as string,
    summary: row.summary as string,
    created_at: row.created_at as string,
    company_name: nameById.get(row.organization_id as string) ?? "Company",
  }));

  let pendingApprovalCount = 0;
  if (isAccountOwnerForActiveOrg(ctx) && ctx.entitlement) {
    const { count, error } = await supabase
      .from("organization_profile_change_requests")
      .select("id", { count: "exact", head: true })
      .in("organization_id", orgIds)
      .eq("status", "pending");
    if (!error) pendingApprovalCount = count ?? 0;
  }

  return { items, pendingApprovalCount };
}
