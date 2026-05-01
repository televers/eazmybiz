import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const email = user.email?.trim() ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, employee_id, department, mobile")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as {
    display_name: string | null;
    employee_id: string | null;
    department: string | null;
    mobile: string | null;
  } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your personal details for this workspace. Name is used on documents you create and in the team list.
        </p>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium text-[var(--foreground)]">Your information</h2>
        <ProfileForm
          email={email}
          countryCode={ctx.organization.country_code}
          billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
          initial={{
            displayName: (p?.display_name ?? "").trim(),
            employeeId: (p?.employee_id ?? "").trim(),
            department: (p?.department ?? "").trim(),
            mobile: (p?.mobile ?? "").trim(),
          }}
        />
      </section>
    </div>
  );
}
