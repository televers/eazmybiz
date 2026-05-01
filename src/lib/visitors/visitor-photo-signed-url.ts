import type { SupabaseClient } from "@supabase/supabase-js";

export const VISITOR_PHOTOS_BUCKET = "visitor-photos";

/** Signed URL lifetime for visitor photos (detail + print). */
export const VISITOR_PHOTO_SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Short-lived URL for a visitor photo object. Requires an authenticated Supabase client;
 * Storage RLS must allow read for the current user (private bucket).
 */
export async function signedVisitorPhotoUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
): Promise<string | null> {
  const p = storagePath?.trim();
  if (!p) return null;
  const { data, error } = await supabase.storage
    .from(VISITOR_PHOTOS_BUCKET)
    .createSignedUrl(p, VISITOR_PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
