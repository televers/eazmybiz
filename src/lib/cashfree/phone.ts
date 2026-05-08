/** Normalize Indian mobile for Cashfree customer_phone (10 digits, no country code). */
export function normalizeIndianPhoneForCashfree(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  return null;
}
