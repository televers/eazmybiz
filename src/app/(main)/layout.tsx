import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { fetchNotificationPreview } from "@/lib/notifications-preview";
import { canAccessSubscriptionPricing, getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContext();
  if (!ctx) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }
    redirect("/onboarding");
  }

  const notificationPreview = ctx.canManageMemberships ? await fetchNotificationPreview(ctx) : null;
  const isAccountOwner = isAccountOwnerForActiveOrg(ctx);
  const canAccessPricing = canAccessSubscriptionPricing(ctx);

  return (
    <AppShell
      orgName={ctx.organization.name}
      accessibleOrganizations={ctx.accessibleOrganizations}
      activeOrgId={ctx.organization.id}
      featurePermissions={ctx.featurePermissions}
      canManageMemberships={ctx.canManageMemberships}
      canAccessPricing={canAccessPricing}
      isMasterAdmin={ctx.isMasterAdmin}
      notificationPreview={notificationPreview}
      isAccountOwner={isAccountOwner}
    >
      {children}
    </AppShell>
  );
}
