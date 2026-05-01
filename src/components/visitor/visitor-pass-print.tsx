export type VisitorPassPrintProps = {
  companyName: string;
  /** Public URL for org logo (org-logos bucket). */
  logoUrl: string | null;
  docNumber: string;
  visitDateLabel: string;
  visitorName: string;
  visitorMobile: string;
  visitorCompany: string | null;
  hostName: string;
  purpose: string | null;
  vehicleReg: string | null;
  driverName: string | null;
  issuedAtLabel: string | null;
  photoUrl: string | null;
  poweredBy: string | null;
};

/** ISO ID-1 card (85.6×54mm). Key fields use the largest type that still fits typical printers. */
export function VisitorPassPrintView(props: VisitorPassPrintProps) {
  const labelCls = "font-bold text-slate-700";
  const primaryRowCls =
    "text-[8.5px] leading-[1.12] print:text-[9.5px] print:leading-[1.1] text-slate-900";
  const nameCls =
    "text-[11.5px] font-bold leading-[1.08] print:text-[13px] print:leading-[1.06] text-slate-900";
  const companyCls =
    "text-[10px] font-semibold leading-[1.1] print:text-[11.5px] print:leading-[1.08] text-slate-900";
  const secondaryCls =
    "text-[6px] leading-tight text-slate-700 print:text-[6.5px]";

  return (
    <div
      className="visitor-pass box-border flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm print:rounded-none print:shadow-none"
      style={{
        width: "85.6mm",
        height: "53.98mm",
        maxWidth: "100%",
        padding: "1.4mm 2mm 1.2mm",
      }}
    >
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-slate-200 pb-0.5">
        {props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- print: public logo URL
          <img src={props.logoUrl} alt="" className="h-7 w-7 shrink-0 object-contain print:h-8 print:w-8" />
        ) : null}
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[7.5px] font-bold uppercase leading-tight tracking-wide text-slate-900 print:text-[8px]">
            {props.companyName}
          </h1>
          <p className="text-[5.5px] font-semibold uppercase text-slate-600 print:text-[6px]">Visitor pass</p>
        </div>
        {props.logoUrl ? <span className="h-7 w-7 shrink-0 print:h-8 print:w-8" aria-hidden /> : null}
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-row gap-1.5 print:gap-1">
        <div className="relative h-[19mm] w-[15mm] shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50 print:h-[19.5mm] print:w-[15.5mm]">
          {props.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- print / ID card: reliable in browser print
            <img src={props.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[6px] text-slate-400 print:text-[7px]">
              Photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 print:space-y-[0.5mm]">
          <p className={nameCls}>
            <span className={labelCls}>Name: </span>
            {props.visitorName}
          </p>
          {props.visitorCompany ? (
            <p className={companyCls}>
              <span className={labelCls}>Company: </span>
              {props.visitorCompany}
            </p>
          ) : null}
          <p className={primaryRowCls}>
            <span className={labelCls}>Mobile: </span>
            {props.visitorMobile}
          </p>
          <p className={primaryRowCls}>
            <span className={labelCls}>Host: </span>
            {props.hostName}
          </p>
          <p className={primaryRowCls}>
            <span className={labelCls}>Visit date: </span>
            {props.visitDateLabel}
          </p>
          {props.purpose ? (
            <p className={`line-clamp-1 ${secondaryCls}`}>
              <span className="font-semibold text-slate-600">Purpose: </span>
              {props.purpose}
            </p>
          ) : null}
          {props.vehicleReg ? (
            <p className={secondaryCls}>
              <span className="font-semibold text-slate-600">Vehicle: </span>
              {props.vehicleReg}
            </p>
          ) : null}
          {props.driverName ? (
            <p className={secondaryCls}>
              <span className="font-semibold text-slate-600">Driver: </span>
              {props.driverName}
            </p>
          ) : null}
          <p className="pt-0.5 text-[5.5px] text-slate-600 print:text-[6px]">
            <span className="font-medium">Pass {props.docNumber}</span>
            {props.issuedAtLabel ? <span> · {props.issuedAtLabel}</span> : null}
          </p>
        </div>
      </div>

      <div className="mt-auto shrink-0 border-t border-slate-200 pt-0.5 text-[5px] leading-[1.2] text-slate-700 print:text-[5.25px]">
        <p>1. Always wear / display visitors pass in the premises.</p>
        <p className="mt-0.5">2. Please return the pass before leaving to the admin/host/security.</p>
      </div>

      {props.poweredBy ? (
        <p className="mt-0.5 text-center text-[4.5px] text-slate-400 print:mt-0 print:text-[5px]">
          {props.poweredBy}
        </p>
      ) : null}
    </div>
  );
}
