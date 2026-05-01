import Link from "next/link";
import {
  loadPartyDocuments,
  type PartyDcListRow,
  type PartyPackingListRow,
  type PartyQuotationListRow,
} from "@/lib/parties/party-documents";
import { primaryButtonCompact } from "@/lib/ui/primary-button";
import { DocumentRowActionsMenu } from "@/components/documents/document-row-actions-menu";

function QuotationsSection({ rows, empty }: { rows: PartyQuotationListRow[]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <h3 className="text-sm font-semibold">Quotations</h3>
        <Link href="/quotations/new" className={primaryButtonCompact}>
          Add new quotation
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--card)] text-[var(--muted)]">
          <tr className="border-b border-[var(--border)]">
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Value</th>
            <th className="px-4 py-3 font-medium">Currency</th>
            <th className="px-4 py-3 font-medium">Valid until</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Issued</th>
            <th className="w-12 px-2 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-3">
                <Link href={r.href} className="text-sky-600 underline">
                  {r.doc_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.dateDdMm}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.value}</td>
              <td className="px-4 py-3">{r.currency}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.validUntilDdMm}</td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.issued}</td>
              <td className="px-2 py-3 text-right align-middle">
                <DocumentRowActionsMenu kind="quotation" documentId={r.id} status={r.status} />
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function PackingSection({ rows, empty }: { rows: PartyPackingListRow[]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <h3 className="text-sm font-semibold">Packing lists</h3>
        <Link href="/packing-lists/new" className={primaryButtonCompact}>
          Add new packing list
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--card)] text-[var(--muted)]">
          <tr className="border-b border-[var(--border)]">
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Packages</th>
            <th className="px-4 py-3 font-medium text-right">Gross weight</th>
            <th className="px-4 py-3 font-medium">Invoice no.</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Issued</th>
            <th className="w-12 px-2 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-3">
                <Link href={r.href} className="text-sky-600 underline">
                  {r.doc_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.dateDdMm}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.packages}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.grossWeightDisplay}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.invoiceNo}</td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.issued}</td>
              <td className="px-2 py-3 text-right align-middle">
                <DocumentRowActionsMenu kind="packing_list" documentId={r.id} status={r.status} />
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ChallansSection({ rows, empty }: { rows: PartyDcListRow[]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <h3 className="text-sm font-semibold">Delivery challans</h3>
        <Link href="/delivery-challans/new" className={primaryButtonCompact}>
          Add new challan
        </Link>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--card)] text-[var(--muted)]">
          <tr className="border-b border-[var(--border)]">
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Value</th>
            <th className="px-4 py-3 font-medium">Currency</th>
            <th className="px-4 py-3 font-medium">Transporter name</th>
            <th className="px-4 py-3 font-medium">LR no.</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Issued</th>
            <th className="w-12 px-2 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-3">
                <Link href={r.href} className="text-sky-600 underline">
                  {r.doc_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.dateDdMm}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.value}</td>
              <td className="px-4 py-3">{r.currency}</td>
              <td
                className="px-4 py-3 max-w-[160px] truncate text-[var(--muted)]"
                title={r.transporterName !== "—" ? r.transporterName : undefined}
              >
                {r.transporterName}
              </td>
              <td
                className="px-4 py-3 max-w-[120px] truncate text-[var(--muted)]"
                title={r.lrNo !== "—" ? r.lrNo : undefined}
              >
                {r.lrNo}
              </td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{r.issued}</td>
              <td className="px-2 py-3 text-right align-middle">
                <DocumentRowActionsMenu kind="delivery_challan" documentId={r.id} status={r.status} />
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={9}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export async function PartyTransactions({
  organizationId,
  partyId,
}: {
  organizationId: string;
  partyId: string;
}) {
  const docs = await loadPartyDocuments(organizationId, partyId);
  const total = docs.quotation.length + docs.packing_list.length + docs.delivery_challan.length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Related documents</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Documents linked to this party, plus older rows without a party link that still match on billing/shipping name
          or GSTIN.
          {total === 0
            ? " Nothing yet — open a quotation, packing list, or challan and use Load party, or save addresses as this party."
            : null}
        </p>
      </div>

      <div className="space-y-4">
        <QuotationsSection rows={docs.quotation} empty="No matching quotations." />
        <PackingSection rows={docs.packing_list} empty="No matching packing lists." />
        <ChallansSection rows={docs.delivery_challan} empty="No matching delivery challans." />
      </div>
    </section>
  );
}
