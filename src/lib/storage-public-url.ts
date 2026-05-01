export function publicObjectUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`;
}
