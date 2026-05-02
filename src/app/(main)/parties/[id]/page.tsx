import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { PartyTransactions } from "@/components/parties/party-transactions";
import { PartyDetailHeader } from "@/components/parties/party-detail-header";
import { buildPartyListRow, type PartyAddressRow } from "@/lib/parties/load-parties";
import { partyHasRelatedDocuments } from "@/lib/parties/party-documents";
import { canEditOrgMaintainedRecord } from "@/lib/access/org-maintained-record";
import { resolveActivityActorLabels } from "@/lib/activity-actor-labels";
import { formatDateTimeIst } from "@/lib/packing/date-format";

function PartyTransactionsFallback() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading related documents">
      <div className="h-5 w-48 animate-pulse rounded bg-[var(--muted)]/15" />
      <div className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/10" />
      <div className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/10" />
    </div>
  );
}

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: party } = await supabase
    .from("parties")
    .select("id, display_name, updated_at, managed_by_user_id")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!party) notFound();

  const { data: addrs } = await supabase
    .from("party_addresses")
    .select("*")
    .eq("party_id", id)
    .eq("organization_id", ctx.organization.id);

  const partyRow = buildPartyListRow(
    {
      id: party.id as string,
      display_name: party.display_name as string,
      updated_at: (party.updated_at as string) ?? new Date().toISOString(),
      managed_by_user_id: (party as { managed_by_user_id?: string | null }).managed_by_user_id ?? null,
    },
    (addrs ?? []) as PartyAddressRow[],
  );

  const hasDocuments = await partyHasRelatedDocuments(ctx.organization.id, id);
  const canEditBilling = canEditOrgMaintainedRecord(ctx, partyRow.managed_by_user_id);

  const { data: activityRows } = await supabase
    .from("party_edit_activity")
    .select("id, actor_user_id, summary, created_at")
    .eq("party_id", id)
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const activity = (activityRows ?? []) as {
    id: string;
    actor_user_id: string;
    summary: string;
    created_at: string;
  }[];
  const actorLabels = await resolveActivityActorLabels(activity.map((r) => r.actor_user_id));

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PartyDetailHeader
        partyRow={partyRow}
        hasDocuments={hasDocuments}
        canEditBilling={canEditBilling}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
      />

      <Suspense fallback={<PartyTransactionsFallback />}>
        <PartyTransactions organizationId={ctx.organization.id} partyId={party.id as string} />
      </Suspense>

      {activity.length > 0 ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Activity</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
            Shipping-related updates by team members who are not the party maintainer, a company admin, or the account
            owner.
          </p>
          <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
            {activity.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
                <time
                  className="shrink-0 text-xs text-[var(--muted)] tabular-nums"
                  dateTime={row.created_at}
                >
                  {formatDateTimeIst(row.created_at)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--foreground)]">
                    {actorLabels.get(row.actor_user_id) ?? "Member"}
                  </p>
                  <p className="mt-0.5 text-[var(--muted)]">{row.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
