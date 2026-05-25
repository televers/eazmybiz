import { formatDateTimeIst } from "@/lib/packing/date-format";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";

export type IssuedEditLogEntry = {
  edited_at: string;
  edited_by_display_name: string | null;
  summary_lines?: string[] | null;
};

export function IssuedDocumentDetailFooter({
  firstIssuedAt,
  lastUpdatedAt,
  editLog,
  lastUpdatedLabel = "Last updated on",
}: {
  firstIssuedAt: string;
  lastUpdatedAt: string | null;
  editLog: IssuedEditLogEntry[];
  lastUpdatedLabel?: string;
}) {
  return (
    <footer className="mt-8 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
      <p className="text-center">First issued on: {formatDateTimeIst(firstIssuedAt)}</p>
      <p className="mt-1 text-center">
        {lastUpdatedLabel}: {lastUpdatedAt ? formatDateTimeIst(lastUpdatedAt) : "—"}
      </p>
      {editLog.length > 0 ? (
        <div className="mx-auto mt-4 max-w-lg text-left">
          <p className="text-[11px] font-medium text-[var(--foreground)]">Changes after issue</p>
          <ul className="mt-2 space-y-3">
            {editLog.map((e, i) => (
              <li key={`${e.edited_at}-${i}`} className="rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5">
                <p className="font-medium text-[var(--foreground)]">
                  {formatDateTimeIst(e.edited_at)} — {formatCreatedByLabel(e.edited_by_display_name)}
                </p>
                {e.summary_lines && e.summary_lines.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px]">
                    {e.summary_lines.map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </footer>
  );
}
