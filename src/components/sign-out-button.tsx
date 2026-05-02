"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={
        "rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--border)] " + className
      }
    >
      Sign out
    </button>
  );
}
