import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function trimmedDisplayName(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

/** Single line for team lists: display name, else email local part, else short id token. */
export function memberListLabel(displayName: string | null, email: string | null, userId: string): string {
  const d = trimmedDisplayName(displayName);
  if (d) return d;
  const e = email?.trim();
  if (e) return e.split("@")[0] || e;
  return `User (${userId.slice(0, 8)}…)`;
}

export type MemberIdentity = Map<string, { displayName: string | null; email: string | null }>;

/**
 * Load display names and emails for org members. Uses the service role when available so
 * managers can see peers’ profiles (RLS otherwise limits `profiles` to self-only).
 */
export async function loadMemberIdentities(userIds: string[]): Promise<MemberIdentity> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out: MemberIdentity = new Map();

  if (unique.length === 0) return out;

  let profiles: { id: string; display_name: string | null }[] = [];
  let usedServiceProfiles = false;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.from("profiles").select("id, display_name").in("id", unique);
    if (!error && data) {
      profiles = data as { id: string; display_name: string | null }[];
      usedServiceProfiles = true;
    }
  } catch {
    /* SUPABASE_SERVICE_ROLE_KEY not set or network */
  }

  if (!usedServiceProfiles) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
    profiles = (data ?? []) as { id: string; display_name: string | null }[];
  }

  const displayById = new Map(profiles.map((p) => [p.id, (p.display_name as string | null) ?? null]));

  const needEmail: string[] = [];
  for (const id of unique) {
    const dn = displayById.get(id);
    if (!trimmedDisplayName(dn ?? undefined)) needEmail.push(id);
  }

  const emailById = new Map<string, string>();

  if (needEmail.length > 0) {
    try {
      const admin = createServiceRoleClient();
      await Promise.all(
        needEmail.map(async (id) => {
          const { data, error } = await admin.auth.admin.getUserById(id);
          if (!error && data.user?.email) emailById.set(id, data.user.email);
        }),
      );
    } catch {
      /* no service role — labels fall back without email */
    }
  }

  for (const id of unique) {
    out.set(id, {
      displayName: displayById.get(id) ?? null,
      email: emailById.get(id) ?? null,
    });
  }

  return out;
}
