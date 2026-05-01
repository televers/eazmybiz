/** Print / on-screen preview for material gate pass — layout sized for A5 portrait. */
export function GatePassPrintView({
  companyName,
  docNumber,
  passDateLabel,
  directionLabel,
  invoiceOrDc,
  partyName,
  transportName,
  lrDocketNo,
  handCarriedName,
  handCarriedMobile,
  vehicleNo,
  packageCount,
  mainItem,
  notes,
  issuedAtLabel,
  poweredBy,
}: {
  companyName: string;
  docNumber: string;
  /** Calendar pass date (e.g. DD/MM/YYYY), Asia/Kolkata. */
  passDateLabel: string | null;
  directionLabel: string;
  invoiceOrDc: string;
  partyName: string;
  transportName: string;
  lrDocketNo: string;
  handCarriedName: string;
  handCarriedMobile: string;
  vehicleNo: string;
  packageCount: string;
  mainItem: string;
  notes: string | null;
  issuedAtLabel: string | null;
  poweredBy: string | null;
}) {
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 border-b border-[var(--border)] py-2 text-sm print:border-gray-300 print:py-1.5 print:text-[13px]">
      <div className="font-medium text-[var(--muted)] print:text-gray-600">{label}</div>
      <div className="font-medium text-[var(--foreground)] break-words print:text-black">{value || "—"}</div>
    </div>
  );

  return (
    <article className="box-border flex min-h-[calc(210mm-24mm)] w-full max-w-[148mm] flex-col bg-[var(--card)] px-6 py-5 text-[var(--foreground)] print:max-w-none print:min-h-0 print:bg-white print:p-0 print:px-4 print:py-3 print:text-black">
      <header className="border-b-2 border-[var(--foreground)] pb-3 print:border-black">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)] print:text-gray-600">
          Material gate pass
        </p>
        <h1 className="mt-1 text-center text-lg font-bold leading-tight print:text-xl">{companyName}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm print:text-[13px]">
          <span>
            <span className="text-[var(--muted)] print:text-gray-600">No.</span>{" "}
            <span className="font-semibold tabular-nums">{docNumber}</span>
          </span>
          <span className="rounded-md bg-[var(--muted)]/15 px-2 py-0.5 font-semibold print:bg-gray-100">
            {directionLabel}
          </span>
          {passDateLabel ? (
            <span className="text-[var(--muted)] print:text-gray-600">{passDateLabel}</span>
          ) : null}
          {issuedAtLabel ? (
            <span className="text-[var(--muted)] print:text-gray-600">{issuedAtLabel}</span>
          ) : null}
        </div>
      </header>

      <div className="mt-4 flex-1 space-y-0 print:mt-3">
        {row("Invoice / DC", invoiceOrDc)}
        {row("Party", partyName)}
        {row("Transporter", transportName)}
        {row("LR / docket", lrDocketNo)}
        {row("Hand-carried", handCarriedName)}
        {row("Contact", handCarriedMobile)}
        {row("Vehicle no.", vehicleNo)}
        {row("Packages", packageCount)}
        {row("Main item", mainItem)}
      </div>

      {notes?.trim() ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3 print:mt-2 print:border-gray-300 print:pt-2">
          <p className="text-xs font-medium text-[var(--muted)] print:text-gray-600">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm print:text-[13px]">{notes.trim()}</p>
        </div>
      ) : null}

      <div className="mt-4 border-t border-[var(--border)] pt-3 print:mt-3 print:border-gray-300 print:pt-2.5">
        <p className="text-xs font-semibold text-[var(--foreground)] print:text-black">Sign and stamp</p>
        <div className="mt-2 grid grid-cols-2 gap-4 print:mt-2 print:gap-5">
          <div>
            <div className="min-h-[16mm] border-b border-dashed border-[var(--foreground)] print:min-h-[18mm] print:border-black" />
            <p className="mt-1 text-center text-[10px] font-medium text-[var(--muted)] print:text-gray-600">Signature</p>
          </div>
          <div>
            <div className="min-h-[16mm] border-b border-dashed border-[var(--foreground)] print:min-h-[18mm] print:border-black" />
            <p className="mt-1 text-center text-[10px] font-medium text-[var(--muted)] print:text-gray-600">Stamp</p>
          </div>
        </div>
      </div>

      {poweredBy ? (
        <p className="mt-auto pt-4 text-center text-[10px] text-[var(--muted)] print:pt-3 print:text-gray-500">
          {poweredBy}
        </p>
      ) : null}
    </article>
  );
}
