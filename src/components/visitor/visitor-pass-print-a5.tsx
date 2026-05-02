import type { VisitorPassPrintProps } from "@/components/visitor/visitor-pass-print";

export type VisitorPassPrintA5Props = VisitorPassPrintProps & {
  /** Multi-line org address for display (communication address). */
  orgAddressBlock: string | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] leading-snug text-slate-900 print:text-[9px] print:leading-tight">
      <span className="font-semibold text-slate-700">{label}: </span>
      {value}
    </p>
  );
}

/** Larger, bold lines for visitor identity on the badge front. */
function IdentityRow({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  const size = primary
    ? "text-lg font-extrabold leading-tight print:text-[15px] print:font-bold print:leading-tight"
    : "text-base font-bold leading-snug print:text-sm print:font-semibold print:leading-tight";
  return (
    <p className={`${size} tracking-tight text-slate-950`}>
      <span className="font-extrabold text-slate-800">{label}: </span>
      {value}
    </p>
  );
}

/**
 * A5 portrait sheet: top half = front of foldable badge (org + visitor), bottom = rules on “back”.
 * User folds along the dashed line to make a two-sided pass.
 */
export function VisitorPassPrintA5View(props: VisitorPassPrintA5Props) {
  return (
    <div
      className="visitor-pass-a5 box-border flex min-h-[210mm] flex-col bg-white text-slate-900 shadow-sm print:min-h-0 print:h-auto print:shadow-none"
      style={{ width: "148mm", maxWidth: "100%" }}
    >
      {/* —— Front (top half after print) —— */}
      <section
        className="flex min-h-[105mm] flex-1 flex-col border-b-2 border-dashed border-slate-400 py-[4mm] px-[5mm] print:min-h-0 print:flex-[1_1_0] print:border-slate-500 print:py-[2.5mm] print:px-[3.5mm]"
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-slate-200 pb-2 print:gap-1.5 print:pb-1">
          {props.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 object-contain print:h-[11mm] print:w-[11mm]"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded border border-dashed border-slate-200 bg-slate-50 print:h-[11mm] print:w-[11mm]" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-tight text-slate-900 print:text-[12px] print:leading-snug">
              {props.companyName}
            </h1>
            {props.orgAddressBlock ? (
              <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-slate-600 print:mt-0 print:text-[8px] print:leading-tight">
                {props.orgAddressBlock}
              </p>
            ) : null}
          </div>
        </header>

        <div className="mt-2 flex min-h-0 flex-1 flex-row gap-3 print:mt-1.5 print:gap-2">
          <div className="h-[38mm] w-[30mm] shrink-0 overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-50 print:h-[30mm] print:w-[24mm]">
            {props.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">Photo</div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 print:space-y-1">
            <IdentityRow label="Name" value={props.visitorName} primary />
            <IdentityRow
              label="Company"
              value={props.visitorCompany?.trim() ? props.visitorCompany : "—"}
            />
            <div className="space-y-1 border-t border-slate-200 pt-1.5 print:space-y-0 print:pt-0.5">
            <Row label="Mobile" value={props.visitorMobile} />
            <Row label="Host" value={props.hostName} />
            <Row label="Visit date" value={props.visitDateLabel} />
            {props.purpose ? <Row label="Purpose" value={props.purpose} /> : null}
            {props.vehicleReg ? <Row label="Vehicle no." value={props.vehicleReg} /> : null}
            {props.driverName ? <Row label="Driver" value={props.driverName} /> : null}
            <p className="pt-0.5 text-[11px] text-slate-600 print:pt-0 print:text-[9px] print:leading-tight">
              <span className="font-semibold text-slate-800">{props.docNumber}</span>
              {props.issuedAtLabel ? <span> · {props.issuedAtLabel}</span> : null}
            </p>
            </div>
          </div>
        </div>

        <p className="mt-auto shrink-0 pt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 print:pt-1 print:text-[8px]">
          Visitor pass — fold along center line
        </p>
      </section>

      {/* —— Back (bottom half): rules —— */}
      <section
        className="flex min-h-[105mm] flex-1 flex-col bg-slate-50/80 py-[5mm] px-[6mm] print:min-h-0 print:flex-[1_1_0] print:bg-white print:py-[2.5mm] print:px-[3.5mm]"
      >
        <p className="text-[11px] font-medium leading-relaxed text-slate-800 print:text-[9.5px] print:leading-snug">
          Keep the side with visitor details facing out; instructions stay on the inside of the badge. Use a badge
          holder.
        </p>
        <h2 className="mt-3 text-sm font-bold uppercase tracking-wide text-slate-900 print:mt-1.5 print:text-[10px] print:leading-none">
          Visitor instructions
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-900 print:mt-1 print:space-y-0 print:pl-3 print:text-[8.5px] print:leading-snug">
          <li>Always wear or display this pass visibly while on the premises.</li>
          <li>Return this pass to admin, host, or security before leaving.</li>
          <li>
            Do not transfer this pass to another person; misuse may be addressed under your host organization’s
            security policy.
          </li>
        </ol>
        <div className="mt-auto shrink-0 pt-2 text-[10px] text-slate-600 print:pt-1 print:text-[9px] print:leading-tight">
          <p className="font-semibold text-slate-800">{props.companyName}</p>
        </div>
        {props.poweredBy ? (
          <p className="mt-1.5 shrink-0 text-center text-[9px] text-slate-400 print:mt-1 print:text-[8px] print:leading-tight">
            {props.poweredBy}
          </p>
        ) : null}
      </section>
    </div>
  );
}
