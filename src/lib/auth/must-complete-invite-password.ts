import type { User } from "@supabase/supabase-js";

/** True after admin invite — user must set password on `/auth/set-password` before dashboard. */
export function userMustCompleteInvitePassword(user: User | null | undefined): boolean {
  if (!user?.user_metadata || typeof user.user_metadata !== "object") return false;
  return (user.user_metadata as Record<string, unknown>).must_set_password === true;
}
