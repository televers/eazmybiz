import { assertModuleAccess } from "@/lib/access";
import { getOrgContext } from "@/lib/org";

export default async function QuotationsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  assertModuleAccess(ctx, "quotation");
  return <>{children}</>;
}
