import { z } from "zod";

const inviteEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .transform((s) => s.toLowerCase());

/** Normalize and validate email for invites and auth-style inputs (lowercased). */
export function normalizeInviteEmail(raw: string): string {
  const r = inviteEmailSchema.safeParse(raw);
  if (!r.success) {
    const msg = r.error.flatten().formErrors[0] ?? "Enter a valid email address.";
    throw new Error(msg);
  }
  return r.data;
}

/** Company / org contact email: empty → null, otherwise must be valid format. */
export function normalizeOptionalOrgEmail(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const r = z.string().email("Enter a valid email address.").safeParse(t);
  if (!r.success) {
    const msg = r.error.flatten().formErrors[0] ?? "Enter a valid email address.";
    throw new Error(msg);
  }
  return r.data;
}
