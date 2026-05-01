import { PLAN_COMPANY_ADMIN_SEATS } from "@/lib/pricing/display";

/** Shared plan comparison + modules grid for /pricing and /settings/pricing. */
export function PlanComparisonTables() {
  return (
    <div className="space-y-8">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--card)]">
              <th className="px-3 py-3 font-semibold"> </th>
              <th className="px-3 py-3 font-semibold">Free</th>
              <th className="px-3 py-3 font-semibold">Pro</th>
              <th className="px-3 py-3 font-semibold">Max</th>
            </tr>
          </thead>
          <tbody className="text-[var(--foreground)]">
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Companies</td>
              <td className="px-3 py-2.5">1</td>
              <td className="px-3 py-2.5">2</td>
              <td className="px-3 py-2.5">5</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Users (max)</td>
              <td className="px-3 py-2.5">2</td>
              <td className="px-3 py-2.5">10</td>
              <td className="px-3 py-2.5">50</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">
                Company admin seats
                <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                  Across your subscription; excludes the account owner.
                </span>
              </td>
              <td className="px-3 py-2.5 align-top">{PLAN_COMPANY_ADMIN_SEATS.free}</td>
              <td className="px-3 py-2.5 align-top">{PLAN_COMPANY_ADMIN_SEATS.pro}</td>
              <td className="px-3 py-2.5 align-top">{PLAN_COMPANY_ADMIN_SEATS.max}</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Company admins per company</td>
              <td className="px-3 py-2.5 align-top">Owner only</td>
              <td className="px-3 py-2.5 align-top">Max 1</td>
              <td className="px-3 py-2.5 align-top">
                Multiple
                <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                  Within subscription seat cap
                </span>
              </td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Deactivate members</td>
              <td className="px-3 py-2.5">No</td>
              <td className="px-3 py-2.5">Yes</td>
              <td className="px-3 py-2.5">Yes</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Company logo on documents</td>
              <td className="px-3 py-2.5">Yes</td>
              <td className="px-3 py-2.5">Yes</td>
              <td className="px-3 py-2.5">Yes</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">
                Document print / PDF layouts
                <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                  Professional colour themes for quotations, packing lists, and delivery challans.
                </span>
              </td>
              <td className="px-3 py-2.5 align-top">1</td>
              <td className="px-3 py-2.5 align-top">5</td>
              <td className="px-3 py-2.5 align-top">8</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">
                Monthly documents (combined, issued)<span className="sr-only">.</span>
              </td>
              <td className="px-3 py-2.5">30</td>
              <td className="px-3 py-2.5">500</td>
              <td className="px-3 py-2.5">Unlimited</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Monthly gate passes (issued)</td>
              <td className="px-3 py-2.5">60</td>
              <td className="px-3 py-2.5">500</td>
              <td className="px-3 py-2.5">2,000</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Monthly visitor passes (issued)</td>
              <td className="px-3 py-2.5">60</td>
              <td className="px-3 py-2.5">500</td>
              <td className="px-3 py-2.5">2,000</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Quota reset</td>
              <td className="px-3 py-2.5" colSpan={3}>
                IST midnight, 1st of calendar month
              </td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-2.5 text-[var(--muted)]">Hosted — tenant isolation</td>
              <td className="px-3 py-2.5">Yes</td>
              <td className="px-3 py-2.5">Yes</td>
              <td className="px-3 py-2.5">Yes</td>
            </tr>
            <tr className="bg-[var(--card)]">
              <td className="px-3 py-3 font-medium text-[var(--foreground)]">
                Watermark-free customer-facing outputs
                <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                  No &quot;Powered by eazmybiz&quot; on PDFs, emails, gate passes, or address labels.
                </span>
              </td>
              <td className="px-3 py-3 align-top">No</td>
              <td className="px-3 py-3 align-top font-medium text-emerald-700 dark:text-emerald-400">Yes</td>
              <td className="px-3 py-3 align-top font-medium text-emerald-700 dark:text-emerald-400">Yes</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[var(--muted)]">
          <strong className="font-medium text-[var(--foreground)]">Who sees documents?</strong> Regular users see only
          their own documents. <strong className="font-medium text-[var(--foreground)]">Company admins</strong> and the{" "}
          <strong className="font-medium text-[var(--foreground)]">account owner</strong> see the whole company.
          Reception and gate staff can open visitors or gate records when you give them those desk roles.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Modules included</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">All plans today; some features may move to Pro/Max later.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th className="px-3 py-2 font-semibold">Module</th>
                <th className="px-3 py-2 text-center font-semibold">Free</th>
                <th className="px-3 py-2 text-center font-semibold">Pro</th>
                <th className="px-3 py-2 text-center font-semibold">Max</th>
              </tr>
            </thead>
            <tbody>
              {[
                "Quotation",
                "Packing list",
                "Delivery challan",
                "Material gate pass",
                "Visitor management",
                "Parties (masters)",
              ].map((name) => (
                <tr key={name} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-center">✓</td>
                  <td className="px-3 py-2 text-center">✓</td>
                  <td className="px-3 py-2 text-center">✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
