import Image from "next/image";
import type { Organization } from "@/types/database";
import { defaultPurchaseOrderTerms } from "@/lib/purchase-order/org-address";
import type { PackingListTemplateId, PartySnapshot } from "@/lib/packing/types";
import type { QuotationAdditionalCharge, QuotationLine } from "@/lib/quotation/types";
import { amountInWordsForCurrency } from "@/lib/amount-in-words";
import { formatAmountPdf, formatMoneyPdf } from "@/lib/currencies";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { formatQuotationOptionalDetailLine } from "@/lib/quotation/format-line";
import { formatQuotationBankDetailLines, hasQuotationBankDetails } from "@/lib/quotation/bank-details-print";
import { packingListPrintTheme } from "@/lib/packing/packing-list-templates";
import { formatDateTimeIst } from "@/lib/packing/date-format";

export type PurchaseOrderPrintProps = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  documentDate: string | null;
  currency: string;
  vendorTo: PartySnapshot;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  lines: QuotationLine[];
  additionalCharges: QuotationAdditionalCharge[];
  deliveryPeriod: string;
  validUntil: string | null;
  paymentTerm: string;
  deliveryIncoTerm: string;
  termsNotes: string | null;
  notes: string | null;
  purchaseOrderTerms: string | null;
  poweredBy: string | null;
  logoUrl: string | null;
  status: string;
  issuedAt: string | null;
  updatedAt: string | null;
};

export function PurchaseOrderPrintView(props: PurchaseOrderPrintProps) {
  const theme = packingListPrintTheme(props.template);
  const b = theme.cellBorder;
  const combined = quotationTotalsWithAdditionalCharges(props.lines, props.additionalCharges ?? []);
  const t = combined.lines;
  const words = amountInWordsForCurrency(combined.final_grand_total, props.currency);
  const consigner = formatConsignerBlock(props.org);

  return (
    <div className={theme.shell}>
      <header
        className={`flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between ${theme.headerRule}`}
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="relative h-16 w-28 shrink-0">
            {props.logoUrl ? (
              <Image
                src={props.logoUrl}
                alt=""
                fill
                className="object-contain object-left"
                sizes="112px"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400">
                Logo
              </div>
            )}
          </div>
          <div className="min-w-0 text-sm leading-relaxed">
            {consigner.map((line, i) => (
              <div key={i} className={i === 0 ? "font-semibold text-slate-900" : "text-slate-700"}>
                {line}
              </div>
            ))}
          </div>
        </div>
        <div className="text-right text-sm">
          <div
            className={`inline-block border-b-2 pb-1 text-lg font-bold uppercase tracking-wide ${theme.titleAccent} ${theme.titleUnderline}`}
          >
            PURCHASE ORDER
          </div>
          <p className="mt-3 text-slate-600">
            No.: <span className="font-medium text-slate-900">{props.docNumber}</span>
          </p>
          <p className="text-slate-600">
            Date: <span className="text-slate-900">{formatDateDdMmYyyy(props.documentDate)}</span>
          </p>
          <p className="text-slate-600">
            Delivery by: <span className="text-slate-900">{formatDateDdMmYyyy(props.validUntil)}</span>
          </p>
          <p className="text-slate-600">
            Currency: <span className="text-slate-900">{props.currency}</span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Vendor</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
            {formatPartyBlock(props.vendorTo).join("\n") || "—"}
          </pre>
        </div>
        <div>
          <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Bill to</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
            {formatPartyBlock(props.billTo).join("\n") || "—"}
          </pre>
        </div>
        <div>
          <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Ship to</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
            {formatPartyBlock(props.shipTo).join("\n") || "—"}
          </pre>
        </div>
      </div>

      <div className="mt-4">
        <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Notes</div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{props.notes?.trim() || "—"}</p>
      </div>

      <div className="mt-6 w-full min-w-0">
        <div className={`w-full max-w-full border ${theme.tableOuter}`}>
          <table className="w-full min-w-[540px] table-fixed border-collapse text-xs text-slate-900 print:min-w-0">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[34%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className={theme.thead}>
                <th className={`border-b border-r px-1.5 py-2 text-center ${b}`}>Sr</th>
                <th
                  className={`border-b border-r px-2 py-2 text-left align-top text-[11px] font-semibold leading-tight ${b}`}
                >
                  <span className="block">Product / Service</span>
                  <span className={`mt-0.5 block text-[10px] font-normal normal-case ${theme.theadMuted}`}>
                    Model/Part No. , Make
                  </span>
                </th>
                <th className={`border-b border-r px-1.5 py-2 text-center ${b}`}>HSN/SAC</th>
                <th className={`border-b border-r px-1.5 py-2 text-center ${b}`}>Unit</th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-right text-[13px] font-semibold tabular-nums ${b}`}
                >
                  Qty
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-right text-[13px] font-semibold tabular-nums ${b}`}
                >
                  Unit price
                </th>
                <th className={`border-b border-r px-1.5 py-2 text-right ${b}`}>Taxable</th>
                <th className={`border-b border-r px-1.5 py-2 text-right ${b}`}>Tax %</th>
                <th className={`border-b border-r px-1.5 py-2 text-right ${b}`}>Tax amt</th>
                <th className={`border-b px-1.5 py-2 text-right text-[13px] font-semibold tabular-nums ${b}`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {props.lines.map((line, i) => {
                const optionalDetail = formatQuotationOptionalDetailLine(line);
                return (
                  <tr key={i} className="text-[12px] leading-snug">
                    <td className={`border-b border-r px-1.5 py-2 text-center ${b}`}>{i + 1}</td>
                    <td className={`border-b border-r px-2 py-2 align-top break-words ${b}`}>
                      <div className="text-[15px] font-medium leading-snug text-slate-900">{line.description || "—"}</div>
                      {optionalDetail ? (
                        <div className="mt-1 text-[12px] leading-snug text-slate-600">{optionalDetail}</div>
                      ) : null}
                    </td>
                    <td className={`border-b border-r px-1.5 py-2 text-center ${b}`}>{line.hsn_sac || "—"}</td>
                    <td className={`border-b border-r px-1.5 py-2 text-center ${b}`}>{line.unit}</td>
                    <td
                      className={`border-b border-r px-1.5 py-2 text-right text-[13px] tabular-nums text-slate-900 ${b}`}
                    >
                      {line.qty}
                    </td>
                    <td
                      className={`border-b border-r px-1.5 py-2 text-right text-[13px] tabular-nums text-slate-900 ${b}`}
                    >
                      {formatAmountPdf(line.unit_price)}
                    </td>
                    <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>
                      {formatAmountPdf(line.taxable_value)}
                    </td>
                    <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>{line.tax_percent}</td>
                    <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>
                      {formatAmountPdf(line.tax_amount)}
                    </td>
                    <td
                      className={`border-b px-1.5 py-2 text-right text-[13px] tabular-nums font-semibold text-slate-900 ${b}`}
                    >
                      {formatAmountPdf(line.line_total)}
                    </td>
                  </tr>
                );
              })}
              <tr className={`text-[12px] font-semibold leading-snug ${theme.totalRow}`}>
                <td className={`border-b border-r px-1.5 py-2 text-right ${b}`} colSpan={4}>
                  Totals (line items)
                </td>
                <td className={`border-b border-r px-1.5 py-2 text-right text-[13px] tabular-nums ${b}`}>{t.qty}</td>
                <td className={`border-b border-r px-1.5 py-2 ${b}`} />
                <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>
                  {formatAmountPdf(t.taxable_value)}
                </td>
                <td className={`border-b border-r px-1.5 py-2 ${b}`} />
                <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>
                  {formatAmountPdf(t.tax_amount)}
                </td>
                <td className={`border-b px-1.5 py-2 text-right text-[13px] tabular-nums ${b}`}>
                  {formatAmountPdf(t.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {combined.additional_charges.length > 0 ? (
        <div className="mt-4 text-sm">
          <div className="font-semibold text-slate-800">Additional charges</div>
          <ul className="mt-2 space-y-1">
            {combined.additional_charges.map((c, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 text-slate-700">
                <span>{c.label || "—"}</span>
                <span className="tabular-nums font-semibold text-slate-900">
                  {`${formatAmountPdf(c.amount)} + ${c.tax_percent}% tax -> ${formatAmountPdf(c.line_total)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex justify-between text-base font-semibold text-slate-900">
        <span>Grand total</span>
        <span className="tabular-nums">{formatMoneyPdf(combined.final_grand_total, props.currency)}</span>
      </div>

      <div className="mt-6 text-sm">
        <div className="font-semibold text-slate-800">Amount in words</div>
        <p className="mt-1 text-slate-700">{words}</p>
      </div>

      <div className="mt-6 text-sm">
        <div className={`border-b pb-1 font-semibold ${theme.partyRule}`}>Important Terms</div>
        <p className="mt-2">
          <span className="font-medium">Delivery period: </span>
          {props.deliveryPeriod || "—"}
        </p>
        <p className="mt-1">
          <span className="font-medium">Payment: </span>
          {props.paymentTerm}
        </p>
        <p className="mt-1">
          <span className="font-medium">Delivery / Incoterm: </span>
          {props.deliveryIncoTerm}
        </p>
        {props.termsNotes?.trim() ? <p className="mt-2 whitespace-pre-wrap text-slate-700">{props.termsNotes}</p> : null}
        <div className={`mt-4 border-t pt-3 ${theme.headerRule}`}>
          <div className="font-semibold text-slate-800">Standard Terms &amp; conditions</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
            {(props.purchaseOrderTerms?.trim() || defaultPurchaseOrderTerms())
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ol>
        </div>
      </div>

      {hasQuotationBankDetails(props.org) ? (
        <div className="mt-6 text-sm">
          <div className={`border-b pb-1 font-semibold ${theme.partyRule}`}>Bank details</div>
          <div className="mt-2 space-y-1 whitespace-pre-wrap text-slate-700">
            {formatQuotationBankDetailLines(props.org).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      {props.status === "draft" ? (
        <p className="mt-6 text-center text-sm text-amber-700">Draft — not issued</p>
      ) : props.issuedAt ? (
        <div className="mt-4 space-y-1 text-center text-xs text-slate-500">
          <p>First issued on: {formatDateTimeIst(props.issuedAt)}</p>
          <p>Last revised at: {props.updatedAt ? formatDateTimeIst(props.updatedAt) : "—"}</p>
        </div>
      ) : null}

      {props.poweredBy ? (
        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
          {props.poweredBy}
        </footer>
      ) : null}
    </div>
  );
}
