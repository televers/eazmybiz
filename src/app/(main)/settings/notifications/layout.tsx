import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";

/** Notifications: account owner or company admin (same gate as Team & company settings). */
export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx?.canManageMemberships) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
