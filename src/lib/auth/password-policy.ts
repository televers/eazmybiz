/** Basic strength rules — not overly strict; blocks trivial passwords. */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Include at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Include at least one number.";
  }
  return null;
}

/** "Acme Corp" → "Acme Corp's" for invite copy (avoid awkward "s's"). */
export function possessiveLabel(name: string): string {
  const t = name.trim() || "Your company";
  if (t.endsWith("s") || t.endsWith("S")) {
    return `${t}'`;
  }
  return `${t}'s`;
}
