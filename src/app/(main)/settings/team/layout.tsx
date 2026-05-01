import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";

/** Team & access: account owner or company admin only (not regular members). */
export default async function TeamSettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
