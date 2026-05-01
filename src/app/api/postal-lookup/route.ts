import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostalLookup } from "@/lib/geo/postal-lookup";

/**
 * Authenticated postal / PIN lookup for address autofill (proxies public APIs; do not expose without auth).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") ?? "").trim().toUpperCase();
  const postal = (searchParams.get("postal") ?? "").trim();
  if (!/^[A-Z]{2}$/.test(country) || !postal || postal.length > 16) {
    return NextResponse.json({ ok: false, error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const result = await resolvePostalLookup(country, postal);
    if (!result) {
      return NextResponse.json({ ok: false });
    }
    return NextResponse.json({ ok: true, city: result.city, state: result.state });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
