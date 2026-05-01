import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org";
import { LegalFooter } from "@/components/legal/legal-footer";
import { OnboardingForm } from "./ui";

export default async function OnboardingPage() {
  const ctx = await getOrgContext();
  if (ctx) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <div className="flex flex-1 flex-col justify-center py-8">
        <h1 className="mb-2 text-2xl font-semibold">Your company</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Free plan includes one company and up to two users. You can invite a teammate later from
          company settings.
        </p>
        <OnboardingForm />
      </div>
      <LegalFooter showOperator={false} className="-mx-4 shrink-0" />
    </div>
  );
}
