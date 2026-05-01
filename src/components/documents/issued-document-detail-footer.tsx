import { formatDateTimeIst } from "@/lib/packing/date-format";
import { formatCreatedByLabel } from "@/lib/documents/created-by-label";

export type IssuedEditLogEntry = {
  edited_at: string;
  edited_by_display_name: string | null;
};

export function IssuedDocumentDetailFooter({
  firstIssuedAt,
  lastUpdatedAt,
  editLog,
}: {
  firstIssuedAt: string;
  lastUpdatedAt: string | null;
  editLog: IssuedEditLogEntry[];
}) {
  return (
    <footer className="mt-8 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
      <p className="text-center">First issued on: {formatDateTimeIst(firstIssuedAt)}</p>
      <p className="mt-1 text-center">
        Last updated on: {lastUpdatedAt ? formatDateTimeIst(lastUpdatedAt) : "—"}
      </p>
      {editLog.length > 0 ? (
        <div className="mx-auto mt-4 max-w-lg text-left">
          <p className="text-[11px] font-medium text-[var(--foreground)]">Saved changes after issue</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {editLog.map((e, i) => (
              <li key={`${e.edited_at}-${i}`}>
                {formatDateTimeIst(e.edited_at)} — {formatCreatedByLabel(e.edited_by_display_name)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </footer>
  );
}
