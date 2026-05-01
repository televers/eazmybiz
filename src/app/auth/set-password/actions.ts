"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { insertOrganizationActivityAsMember } from "@/lib/org-activity";

/** Call after a new invitee sets their password so admins/owner see "joined" in notifications. */
export async function logInviteeJoinedOrgActivityAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const orgId = typeof meta?.invite_organization_id === "string" ? meta.invite_organization_id : null;
  if (!orgId) return;

  const email = user.email ?? "New member";
  await insertOrganizationActivityAsMember(
    orgId,
    user.id,
    `Team & access: ${email} finished setting a password and joined the company.`,
  );

  revalidatePath("/dashboard");
  revalidatePath("/settings/notifications");
  revalidatePath("/", "layout");
}
