import { assertModuleAccess } from "@/lib/access";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { loadPartiesWithAddresses } from "@/lib/parties/load-parties";
import { PartyListPane } from "@/components/parties/party-list-pane";

export default async function PartiesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "parties");

  const rows = await loadPartiesWithAddresses(ctx.organization.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <PartyListPane
        parties={rows}
        currentUserId={ctx.userId}
        isAccountOwnerForActiveOrg={isAccountOwnerForActiveOrg(ctx)}
        isCompanyAdmin={ctx.membership.is_company_admin}
        organizationCountryCode={ctx.organization.country_code ?? "IN"}
        billingCountryCode={ctx.entitlement?.billing_country_code ?? null}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--background)] lg:border-l lg:border-[var(--border)]">
        {children}
      </div>
    </div>
  );
}
