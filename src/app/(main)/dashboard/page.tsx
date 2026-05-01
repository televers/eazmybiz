import Link from "next/link";
import type { FeatureKey } from "@/lib/access";
import { fetchNotificationPreview } from "@/lib/notifications-preview";
import { getOrgContext, isAccountOwnerForActiveOrg } from "@/lib/org";
import { formatPeriodYmIstDisplay } from "@/lib/ist";
import { getUsageSummary } from "@/lib/usage";

export default async function DashboardPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const notificationPreview = ctx.canManageMemberships ? await fetchNotificationPreview(ctx) : null;
  const isAccountOwner = isAccountOwnerForActiveOrg(ctx);

  const u = await getUsageSummary(ctx.organization.id, ctx.organization.plan);
  const fp = ctx.featurePermissions;

  const docLimitLabel = u.documentsLimit === null ? "Unlimited" : String(u.documentsLimit);
  const periodLabel = formatPeriodYmIstDisplay(u.periodYm);

  const cards = [
    {
      href: "/parties",
      title: "Parties",
      desc: "Customer / Vendor details, billing & shipping addresses",
      feature: "parties" as FeatureKey,
    },
    {
      href: "/items",
      title: "Items",
      desc: "Save your products / services to use in documentation",
      feature: "items" as FeatureKey,
    },
    {
      href: "/quotations",
      title: "Quotations",
      desc: "Commercial offer / quote to your customers",
      feature: "quotation" as FeatureKey,
    },
    {
      href: "/packing-lists",
      title: "Packing Lists",
      desc: "Package-wise items / packing in your shipments",
      feature: "packing_list" as FeatureKey,
    },
    {
      href: "/delivery-challans",
      title: "Delivery Challans",
      desc: "Delivery related document (not Tax Invoice)",
      feature: "delivery_challan" as FeatureKey,
    },
    {
      href: "/gate-passes",
      title: "Material Gate Pass",
      desc: "Inward / Outward material movement",
      feature: "gate_pass" as FeatureKey,
    },
    {
      href: "/visitors",
      title: "Visitor management",
      desc: "Visitor passes, check-in/check-out",
      feature: "visitor" as FeatureKey,
    },
  ] as const;

  const showNotificationCard =
    !!notificationPreview &&
    (notificationPreview.items.length > 0 ||
      (isAccountOwner && notificationPreview.pendingApprovalCount > 0));

  const np = notificationPreview;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your Company&apos;s Monthly {periodLabel} usage. Quota resets on 1st of every calendar month (IST Timezone)
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          <li className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="font-medium">Documents</div>
            <div className="text-2xl font-semibold">
              {u.documentsUsed} / {docLimitLabel}
            </div>
            <div className="text-[var(--muted)]">Quotation + packing list + challan combined</div>
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="font-medium">Gate passes</div>
            <div className="text-2xl font-semibold">
              {u.gatePassesUsed} / {u.gatePassesLimit}
            </div>
            <div className="text-[var(--muted)]">Issued passes</div>
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="font-medium">Visitor passes</div>
            <div className="text-2xl font-semibold">
              {u.visitorPassesUsed} / {u.visitorPassesLimit}
            </div>
            <div className="text-[var(--muted)]">Issued passes</div>
          </li>
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Modules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards
            .filter((c) => fp[c.feature])
            .map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-sky-400"
              >
                <div className="font-medium">{c.title}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{c.desc}</div>
              </Link>
            ))}
        </div>
      </div>

      {showNotificationCard && np ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-[var(--foreground)]">Recent notifications</h2>
            <Link
              href="/settings/notifications"
              className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
            >
              View all
            </Link>
          </div>
          {isAccountOwner && np.pendingApprovalCount > 0 ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
              {np.pendingApprovalCount} profile change
              {np.pendingApprovalCount === 1 ? "" : "s"} awaiting your approval —{" "}
              <Link href="/settings/notifications" className="font-medium underline">
                Review in Notifications
              </Link>
            </p>
          ) : null}
          {np.items.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[var(--foreground)]">
              {np.items.slice(0, 4).map((item) => (
                <li key={item.id} className="border-t border-[var(--border)] pt-2 first:border-t-0 first:pt-0">
                  <div className="text-xs text-[var(--muted)]">
                    {item.company_name} ·{" "}
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                  <p className="mt-0.5">{item.summary}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
