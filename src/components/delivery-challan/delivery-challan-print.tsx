import Image from "next/image";
import type { Organization } from "@/types/database";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";
import type { PackingListTemplateId, PartySnapshot } from "@/lib/packing/types";
import type { QuotationAdditionalCharge } from "@/lib/quotation/types";
import { amountInWordsForCurrency } from "@/lib/amount-in-words";
import { formatAmountPdf, formatMoneyPdf } from "@/lib/currencies";
import { formatDocumentDateDdMmYyyy, formatIsoDateOnlyDdMmYyyy } from "@/lib/packing/date-format";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { dcTotalsWithAdditionalCharges } from "@/lib/delivery-challan/compute";
import { formatDeliveryChallanOptionalDetailLine } from "@/lib/delivery-challan/format-line";
import { defaultDeliveryChallanTerms } from "@/lib/packing/types";
import { formatQuotationBankDetailLines, hasQuotationBankDetails } from "@/lib/quotation/bank-details-print";
import { packingListPrintTheme } from "@/lib/packing/packing-list-templates";

function fmtDate(s: string | null | undefined): string {
  if (s == null || String(s).trim() === "") return "—";
  return formatDocumentDateDdMmYyyy(s, null);
}

function totalQty(lines: DeliveryChallanLine[]) {
  return lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
}

export type DeliveryChallanPrintProps = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  documentDate: string | null;
  issuedAt: string | null;
  status: string;
  currency: string;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  lines: DeliveryChallanLine[];
  additionalCharges: QuotationAdditionalCharge[];
  poNo: string | null;
  poDate: string | null;
  lrDocketNo: string | null;
  ewayBillNo: string | null;
  transportName: string | null;
  transporterId: string | null;
  vehicleNo: string | null;
  notes: string | null;
  poweredBy: string | null;
  logoUrl: string | null;
};

export function DeliveryChallanPrintView(props: DeliveryChallanPrintProps) {
  const theme = packingListPrintTheme(props.template);
  const b = theme.cellBorder;
  const docDate = formatDocumentDateDdMmYyyy(props.documentDate, props.issuedAt);
  const tq = totalQty(props.lines);
  const combined = dcTotalsWithAdditionalCharges(props.lines, props.additionalCharges ?? []);
  const t = combined.lines;
  const words = amountInWordsForCurrency(combined.final_grand_total, props.currency);
  const dcTermsLines = (props.org.delivery_challan_terms?.trim() || defaultDeliveryChallanTerms())
    .split("\n")
    .filter(Boolean);

  const rightRows: { label: string; value: string }[] = [
    { label: "PO no.", value: props.poNo?.trim() || "—" },
    { label: "PO date", value: fmtDate(props.poDate) },
    { label: "LR / Docket no.", value: props.lrDocketNo?.trim() || "—" },
    { label: "E-way bill no.", value: props.ewayBillNo?.trim() || "—" },
    { label: "Transport name", value: props.transportName?.trim() || "—" },
    { label: "Transporter ID", value: props.transporterId?.trim() || "—" },
    { label: "Vehicle no.", value: props.vehicleNo?.trim() || "—" },
  ];

  return (
    <div className={theme.shell}>
      <header
        className={`flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between ${theme.headerRule}`}
      >
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="relative h-16 w-28 shrink-0">
            {props.logoUrl ? (
              <Image src={props.logoUrl} alt="" fill className="object-contain object-left" sizes="112px" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 text-[10px] text-slate-400">
                Logo
              </div>
            )}
          </div>
          <div className="min-w-0 text-sm leading-snug">
            {formatConsignerBlock(props.org).map((line, i) => (
              <div key={i} className={i === 0 ? "font-semibold" : ""}>
                {line}
              </div>
            ))}
          </div>
        </div>
        <div className="text-right text-sm">
          <div
            className={`inline-block border-b-2 pb-1 text-base font-semibold uppercase tracking-wide ${theme.titleAccent} ${theme.titleUnderline}`}
          >
            Delivery challan
          </div>
          <div className="mt-3 space-y-1 text-slate-700">
            <div>
              <span className="text-slate-500">Date: </span>
              {docDate}
            </div>
            <div>
              <span className="text-slate-500">Challan no.: </span>
              {props.docNumber}
            </div>
            <div>
              <span className="text-slate-500">Currency: </span>
              {props.currency}
            </div>
            {props.status === "draft" ? (
              <div className="text-amber-700">Draft — not issued</div>
            ) : props.issuedAt ? (
              <div>
                <span className="text-slate-500">Issued: </span>
                {formatIsoDateOnlyDdMmYyyy(props.issuedAt)}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Bill to</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {formatPartyBlock(props.billTo).join("\n") || "—"}
            </div>
          </div>
          <div>
            <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Ship to</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {formatPartyBlock(props.shipTo).join("\n") || "—"}
            </div>
          </div>
        </div>
        <div>
          <div className={`border-b pb-1 text-sm font-semibold ${theme.partyRule}`}>Transport & documents</div>
          <dl className="mt-3 space-y-2 text-sm">
            {rightRows.map((r) => (
              <div key={r.label} className="grid grid-cols-[1fr_1.2fr] gap-2 gap-x-4">
                <dt className="text-slate-500">{r.label}</dt>
                <dd className="text-right text-slate-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6 w-full min-w-0">
        <div className={`w-full max-w-full border ${theme.tableOuter}`}>
          <table className="w-full min-w-[540px] table-fixed border-collapse text-xs text-slate-900 print:min-w-0">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[28%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className={theme.thead}>
                <th className={`border-b border-r px-1.5 py-1.5 text-center font-semibold ${b}`}>#</th>
                <th
                  className={`border-b border-r px-1.5 py-1.5 text-left align-top text-[11px] font-semibold leading-tight ${b}`}
                >
                  <span className="block">Description</span>
                  <span className={`mt-0.5 block text-[10px] font-normal normal-case ${theme.theadMuted}`}>
                    Model/Part No. , Make
                  </span>
                </th>
                <th className={`border-b border-r px-1.5 py-1.5 text-center font-semibold ${b}`}>HSN</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-center font-semibold ${b}`}>Unit</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-right font-semibold ${b}`}>Qty</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-right font-semibold ${b}`}>Unit rate</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-right font-semibold ${b}`}>Taxable</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-right font-semibold ${b}`}>Tax %</th>
                <th className={`border-b border-r px-1.5 py-1.5 text-right font-semibold ${b}`}>Tax amt</th>
                <th className={`border-b px-1.5 py-1.5 text-right font-semibold ${b}`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {props.lines.map((line, i) => {
                const opt = formatDeliveryChallanOptionalDetailLine(line);
                return (
                  <tr key={i} className="text-[12px] leading-snug">
                    <td className={`border-b border-r px-1.5 py-1.5 text-center tabular-nums align-top ${b}`}>
                      {i + 1}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 break-words align-top ${b}`}>
                      <div className="font-semibold text-slate-900">{line.description?.trim() || "—"}</div>
                      {opt ? (
                        <div className="mt-1 text-[11px] font-normal leading-snug text-slate-600">{opt}</div>
                      ) : null}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-center tabular-nums align-top ${b}`}>
                      {line.hsn || "—"}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-center align-top ${b}`}>{line.unit || "—"}</td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-top ${b}`}>
                      {line.qty}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-top ${b}`}>
                      {formatAmountPdf(line.unit_price)}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-top ${b}`}>
                      {formatAmountPdf(line.taxable_value)}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-top ${b}`}>
                      {line.tax_percent}
                    </td>
                    <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-top ${b}`}>
                      {formatAmountPdf(line.tax_amount)}
                    </td>
                    <td
                      className={`border-b px-1.5 py-1.5 text-right tabular-nums align-top font-medium ${b}`}
                    >
                      {formatAmountPdf(line.line_total)}
                    </td>
                  </tr>
                );
              })}
              <tr className={`text-[12px] font-semibold leading-snug ${theme.totalRow}`}>
                <td className={`border-b border-r px-1.5 py-1.5 text-right align-middle ${b}`} colSpan={4}>
                  Totals (line items)
                </td>
                <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-middle ${b}`}>{tq}</td>
                <td className={`border-b border-r px-1.5 py-1.5 align-middle ${b}`} />
                <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-middle ${b}`}>
                  {formatAmountPdf(t.taxable_value)}
                </td>
                <td className={`border-b border-r px-1.5 py-1.5 align-middle ${b}`} />
                <td className={`border-b border-r px-1.5 py-1.5 text-right tabular-nums align-middle ${b}`}>
                  {formatAmountPdf(t.tax_amount)}
                </td>
                <td className={`border-b px-1.5 py-1.5 text-right tabular-nums align-middle ${b}`}>
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

      <div className="mt-4 text-sm">
        <div className="font-semibold text-slate-800">Amount in words</div>
        <p className="mt-1 text-slate-700">{words}</p>
      </div>

      {props.notes ? (
        <div className="mt-4 text-sm">
          <div className="font-medium text-slate-700">Notes</div>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{props.notes}</p>
        </div>
      ) : null}

      <div className="mt-6 text-sm">
        <div className={`border-b pb-1 font-semibold text-slate-800 ${theme.partyRule}`}>
          Delivery challan — terms &amp; conditions
        </div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
          {dcTermsLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </div>

      {hasQuotationBankDetails(props.org) ? (
        <div className="mt-6 text-sm">
          <div className={`border-b pb-1 font-semibold text-slate-800 ${theme.partyRule}`}>Bank details</div>
          <div className="mt-2 space-y-1 whitespace-pre-wrap text-slate-700">
            {formatQuotationBankDetailLines(props.org).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 text-sm print:grid-cols-2 md:grid-cols-2 print:break-inside-avoid">
        <div className={`rounded-md border p-3 text-left ${theme.tableOuter}`}>
          <div className={`border-b pb-1.5 text-sm font-semibold leading-none text-slate-900 ${theme.partyRule}`}>
            Received by
          </div>
          <div className="mt-2.5 grid gap-y-2 text-slate-800">
            {(["Name", "Comment", "Date"] as const).map((label) => (
              <div key={label} className="grid grid-cols-[6.5rem_1fr] items-end gap-x-2">
                <span className="text-[13px] leading-none text-slate-700">{label}:</span>
                <span className="min-h-[0.875rem] border-b border-slate-400 print:border-slate-800" />
              </div>
            ))}
            <div className="grid grid-cols-[6.5rem_1fr] items-end gap-x-2">
              <span className="self-end pb-[0.125rem] text-[13px] leading-none text-slate-700">Signature:</span>
              <span className="min-h-[2.125rem] border-b border-slate-400 print:border-slate-800" />
            </div>
          </div>
        </div>
        <div className={`rounded-md border p-3 text-left ${theme.tableOuter}`}>
          <p className="text-[13px] leading-snug text-slate-800">
            <span className="font-semibold">For </span>
            {props.org.name?.trim() || "—"}
          </p>
          <div className="mt-4">
            <div className="text-[13px] text-slate-700">Authorised signatory</div>
            <div className="mt-9 min-h-[0.75rem] border-b border-slate-400 print:border-slate-800" />
          </div>
        </div>
      </div>

      {props.poweredBy ? (
        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
          {props.poweredBy}
        </footer>
      ) : null}
    </div>
  );
}
