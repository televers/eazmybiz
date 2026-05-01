/**
 * Indian GSTIN: 15 alphanumeric characters after normalization (no spaces, A–Z).
 * Structure: state (2 digits) + PAN (5 letters + 4 digits + 1 letter) + entity (1–9 or A–Z) + Z + check character.
 */

import type { PartySnapshot } from "@/lib/packing/types";

const GSTIN_INDIA_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Strip spaces and force uppercase for display and storage. */
export function normalizeIndianGstinInput(raw: string): string {
  return String(raw ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
}

/**
 * @returns `null` if valid or empty; human-readable error if non-empty but invalid.
 */
export function validateIndianGstinOrEmpty(normalized: string): string | null {
  if (!normalized) return null;
  if (normalized.length !== 15) {
    return "GSTIN must be exactly 15 characters (2-digit state code + 10-character PAN + entity code + Z + check character).";
  }
  if (!GSTIN_INDIA_RE.test(normalized)) {
    return "Invalid GSTIN format. Use: 2 state digits, PAN (5 letters, 4 digits, 1 letter), one entity character (1–9 or A–Z), then Z, then one check character.";
  }
  return null;
}

/** For DB: `null` if empty; normalized string if valid; throws if invalid. */
export function gstinForDatabase(raw: string | null | undefined): string | null {
  const n = normalizeIndianGstinInput(String(raw ?? ""));
  if (!n) return null;
  const err = validateIndianGstinOrEmpty(n);
  if (err) throw new Error(err);
  return n;
}

/** Normalize GSTIN and validate; returns snapshot with cleaned `gstin` (may be ""). */
export function partySnapshotWithGstinNormalized(p: PartySnapshot): PartySnapshot {
  const gstin = normalizeIndianGstinInput(p.gstin ?? "");
  const err = validateIndianGstinOrEmpty(gstin);
  if (err) throw new Error(err);
  return { ...p, gstin };
}
