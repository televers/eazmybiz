import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";

export default async function DeliveryChallansLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "delivery_challan");
  return <>{children}</>;
}
