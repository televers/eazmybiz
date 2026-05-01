import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { EditItemForm } from "@/app/(main)/packing-lists/saved/items/ui";
import { mapRowToSavedItem } from "@/lib/items/map-saved-item-row";
import { DeleteSavedItemForm } from "@/components/items/delete-saved-item-form";
import { canEditOrgMaintainedRecord } from "@/lib/access/org-maintained-record";
import { canEditSavedItemNameAndUnit } from "@/lib/items/can-edit-saved-item-name-unit";
import { resolveActivityActorLabels } from "@/lib/activity-actor-labels";
import { formatDateTimeIst } from "@/lib/packing/date-format";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("saved_item_presets")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();

  if (!row) notFound();

  const item = mapRowToSavedItem(row as Record<string, unknown>);
  const canEditNameAndUnit = canEditSavedItemNameAndUnit(ctx);
  const canDeleteItem = canEditOrgMaintainedRecord(ctx, item.managed_by_user_id);

  const { data: inUse, error: inUseErr } = await supabase.rpc("saved_item_preset_is_in_use", {
    p_organization_id: ctx.organization.id,
    p_preset_id: id,
  });
  const itemInUse = inUse === true;
  const blockDelete = itemInUse || Boolean(inUseErr) || !canDeleteItem;

  const { data: activityRows } = await supabase
    .from("saved_item_edit_activity")
    .select("id, actor_user_id, summary, created_at")
    .eq("preset_id", id)
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
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-5">
      <div>
        <p className="text-xs text-[var(--muted)]">
          <Link href="/items" className="text-sky-600 hover:underline">
            ← Items
          </Link>
        </p>
        <h1 className="mt-1.5 text-xl font-semibold leading-snug sm:text-2xl">{item.description}</h1>
      </div>

      <EditItemForm item={item} canEditNameAndUnit={canEditNameAndUnit} />

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Remove item</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {inUseErr
            ? "Could not check whether this item is in use. Try refreshing the page."
            : !canDeleteItem
              ? "Only the item maintainer, a company admin, or the account owner can remove this saved item."
              : itemInUse
                ? "This item is linked to at least one quotation, packing list, or delivery challan. Change or remove those lines before deleting."
                : "Permanently delete this saved item from your catalog."}
        </p>
        <div className="mt-3">
          <DeleteSavedItemForm itemId={item.id} blocked={blockDelete} />
        </div>
      </div>

      {activity.length > 0 ? (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Activity</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
            HSN/SAC, make, and model updates by team members who are not a company admin or the account owner.
          </p>
          <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
            {activity.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <time className="shrink-0 text-xs text-[var(--muted)] tabular-nums" dateTime={row.created_at}>
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
