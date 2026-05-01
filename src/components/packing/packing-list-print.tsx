import Image from "next/image";
import type { Organization } from "@/types/database";
import type { PackingListTemplateId, PackingPackage, PartySnapshot } from "@/lib/packing/types";
import { defaultPackingTerms } from "@/lib/packing/types";
import { formatDateTimeIst, formatDocumentDateDdMmYyyy } from "@/lib/packing/date-format";
import { formatGrossWeightKg, formatPackageSizeCm } from "@/lib/packing/package-display";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { formatPackingOptionalDetailLine } from "@/lib/packing/format-line";
import { packingListPrintTheme } from "@/lib/packing/packing-list-templates";

export type PackingListPrintProps = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  invoiceNo: string | null;
  documentDate: string | null;
  issuedAt: string | null;
  updatedAt: string | null;
  status: string;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  packages: PackingPackage[];
  notes: string | null;
  poweredBy: string | null;
  logoUrl: string | null;
};

function totals(packages: PackingPackage[]) {
  let qty = 0;
  let weight = 0;
  for (const p of packages) {
    for (const l of p.lines) qty += Number(l.qty) || 0;
    if (p.package_weight_kg != null && Number.isFinite(p.package_weight_kg)) {
      weight += p.package_weight_kg;
    }
  }
  return { qty, weight };
}

export function PackingListPrintView(props: PackingListPrintProps) {
  const { org, packages, template } = props;
  const theme = packingListPrintTheme(template);
  const t = totals(packages);
  const termsText = (org.packing_terms?.trim() || defaultPackingTerms()).split("\n").filter(Boolean);
  const docDate = formatDocumentDateDdMmYyyy(props.documentDate, props.issuedAt);
  const b = theme.cellBorder;

  return (
    <div className={theme.shell}>
      <header className={`flex flex-col gap-4 border-b pb-4 md:flex-row md:items-start md:justify-between ${theme.headerRule}`}>
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
            {formatConsignerBlock(org).map((line, i) => (
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
            Packing list
          </div>
          <div className="mt-3 space-y-1 text-slate-700">
            <div>
              <span className="text-slate-500">Date: </span>
              {docDate}
            </div>
            <div>
              <span className="text-slate-500">Packing list no.: </span>
              {props.docNumber}
            </div>
            <div>
              <span className="text-slate-500">Invoice no.: </span>
              {props.invoiceNo ?? "—"}
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
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

      <div className="mt-6 w-full min-w-0">
        <div className={`w-full max-w-full border ${theme.tableOuter}`}>
          <table className="w-full min-w-[540px] table-fixed border-collapse text-slate-900 print:min-w-0">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[22%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[29%]" />
            </colgroup>
            <thead>
              <tr className={theme.thead}>
                <th
                  className={`border-b border-r px-1.5 py-2 text-center align-middle text-[11px] font-semibold leading-none ${b}`}
                >
                  Pkg #
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-left align-top text-[11px] font-semibold leading-tight ${b}`}
                >
                  <span className="block">Item description</span>
                  <span className={`mt-1 block text-[10px] font-normal normal-case ${theme.theadMuted}`}>
                    Model / part no., make
                  </span>
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-center align-middle text-[11px] font-semibold ${b}`}
                >
                  Unit
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-right align-middle text-[11px] font-semibold tabular-nums ${b}`}
                >
                  Qty
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-left align-middle text-[11px] font-semibold ${b}`}
                >
                  Pkg type
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-center align-middle text-[11px] font-semibold ${b}`}
                >
                  L×W×H (cm)
                </th>
                <th
                  className={`border-b border-r px-1.5 py-2 text-right align-middle text-[11px] font-semibold ${b}`}
                >
                  Gross weight (kg)
                </th>
                <th className={`border-b px-1.5 py-2 text-left align-middle text-[11px] font-semibold ${b}`}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => {
                const rs = Math.max(1, pkg.lines.length);
                return pkg.lines.map((line, li) => {
                  const optional = formatPackingOptionalDetailLine(line);
                  return (
                    <tr key={`${pkg.package_no}-${li}`} className="text-[12px] leading-snug">
                      {li === 0 ? (
                        <td
                          className={`border-b border-r px-1.5 py-2 align-middle text-center text-sm font-bold tabular-nums ${b}`}
                          rowSpan={rs}
                        >
                          {pkg.package_no}
                        </td>
                      ) : null}
                      <td className={`border-b border-r px-1.5 py-2 align-top break-words ${b}`}>
                        <div className="font-semibold text-slate-900">{line.description?.trim() || "—"}</div>
                        {optional ? (
                          <div className="mt-1 text-[11px] font-normal leading-snug text-slate-600">{optional}</div>
                        ) : null}
                      </td>
                      <td className={`border-b border-r px-1.5 py-2 align-middle text-center ${b}`}>{line.unit}</td>
                      <td className={`border-b border-r px-1.5 py-2 align-middle text-right tabular-nums ${b}`}>
                        {line.qty}
                      </td>
                      {li === 0 ? (
                        <>
                          <td className={`border-b border-r px-1.5 py-2 align-middle ${b}`} rowSpan={rs}>
                            {pkg.package_type || "—"}
                          </td>
                          <td
                            className={`border-b border-r px-1.5 py-2 align-middle text-center ${b}`}
                            rowSpan={rs}
                          >
                            {formatPackageSizeCm(pkg.package_size)}
                          </td>
                          <td
                            className={`border-b border-r px-1.5 py-2 align-middle text-right tabular-nums ${b}`}
                            rowSpan={rs}
                          >
                            {formatGrossWeightKg(pkg.package_weight_kg)}
                          </td>
                          <td className={`border-b px-1.5 py-2 align-top leading-snug ${b}`} rowSpan={rs}>
                            {pkg.packing_remarks || "—"}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                });
              })}
              <tr className={`text-[12px] font-semibold leading-snug ${theme.totalRow}`}>
                <td className={`border-b border-r px-1.5 py-2 text-right ${b}`} colSpan={3}>
                  Total
                </td>
                <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>{t.qty}</td>
                <td className={`border-b border-r px-1.5 py-2 ${b}`} colSpan={2} />
                <td className={`border-b border-r px-1.5 py-2 text-right tabular-nums ${b}`}>
                  {t.weight ? `${t.weight} kg` : "—"}
                </td>
                <td className={`border-b px-1.5 py-2 ${b}`} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {props.notes ? (
        <div className="mt-4 text-sm">
          <div className="font-medium text-slate-700">Notes</div>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{props.notes}</p>
        </div>
      ) : null}

      <div className="mt-8 text-sm">
        <div className={`border-b pb-1 font-semibold ${theme.partyRule}`}>Packing list — terms and conditions</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
          {termsText.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </div>

      {props.status === "draft" ? (
        <p className="mt-6 text-center text-sm text-amber-700">Draft — not issued</p>
      ) : props.issuedAt ? (
        <div className="mt-4 space-y-1 text-center text-xs text-slate-500">
          <p>First issued on: {formatDateTimeIst(props.issuedAt)}</p>
          <p>Last updated on: {formatDateTimeIst(props.updatedAt)}</p>
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
