import { loadMemberIdentities, memberListLabel } from "@/lib/team/resolve-member-labels";

/** Labels for notification / activity rows: display name, else email (or local part), else short user id. */
export async function resolveActivityActorLabels(actorUserIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(actorUserIds.filter(Boolean))];
  const identities = await loadMemberIdentities(unique);
  const map = new Map<string, string>();
  for (const id of unique) {
    const row = identities.get(id);
    map.set(
      id,
      memberListLabel(row?.displayName ?? null, row?.email ?? null, id),
    );
  }
  return map;
}
