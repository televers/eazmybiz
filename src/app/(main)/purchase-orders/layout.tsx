import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";

export default async function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "purchase_order");
  return <>{children}</>;
}
