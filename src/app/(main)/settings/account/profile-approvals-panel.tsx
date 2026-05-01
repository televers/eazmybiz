"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  approveOrgProfileChangeRequest,
  rejectOrgProfileChangeRequest,
} from "../company/actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import type { ProfileChangeDiffRow } from "../company/profile-diff";
import type { PendingOrgProfileChange } from "../company/profile-types";

export type AccountPendingRow = PendingOrgProfileChange & {
  company_name: string;
  diffRows: ProfileChangeDiffRow[];
};

export function ProfileApprovalsPanel(props: {
  pending: AccountPendingRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  async function approve(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await approveOrgProfileChangeRequest(id);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await rejectOrgProfileChangeRequest(id, rejectNotes[id]);
      setRejectNotes((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reject");
    } finally {
      setBusyId(null);
    }
  }

  if (props.pending.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Pending company profile changes</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Each card lists only the fields the admin actually changed. Approve to apply those values to the company
          profile.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-4">
        {props.pending.map((p) => {
          const busy = busyId === p.id;
          return (
            <li
              key={p.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm"
            >
              <p className="font-medium text-[var(--foreground)]">{p.company_name}</p>
              {p.diffRows.length > 0 ? (
                <dl className="mt-3 space-y-3 text-[var(--foreground)]">
                  {p.diffRows.map((row) => (
                    <div key={row.label}>
                      <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
                      <dd className="mt-1 space-y-0.5 text-sm">
                        <div>
                          <span className="text-[var(--muted)]">Current: </span>
                          {row.current}
                        </div>
                        <div>
                          <span className="text-[var(--muted)]">Proposed: </span>
                          <span className="font-medium">{row.proposed}</span>
                        </div>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">Open Company settings for this org to review.</p>
              )}
              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Rejection note (optional)</span>
                <input
                  value={rejectNotes[p.id] ?? ""}
                  onChange={(e) =>
                    setRejectNotes((m) => ({
                      ...m,
                      [p.id]: e.target.value,
                    }))
                  }
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  placeholder="Optional message for company admins"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approve(p.id)}
                  className={primaryButtonMd}
                >
                  {busy ? "Working…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => reject(p.id)}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)]"
                >
                  Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OrgSettingsActivityFeed(props: {
  entries: {
    id: string;
    organization_id: string;
    company_name: string;
    summary: string;
    detail_lines?: string[] | null;
    created_at: string;
    actor_label: string;
  }[];
}) {
  if (props.entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Recent company, team and access changes activity</h2>
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
        {props.entries.map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--foreground)]">{e.company_name}</span>
              <time className="text-xs text-[var(--muted)]" dateTime={e.created_at}>
                {new Date(e.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="mt-1 text-[var(--foreground)]">{e.summary}</p>
            {e.detail_lines && e.detail_lines.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                {e.detail_lines.map((line, i) => (
                  <li key={`${e.id}-${i}`}>{line}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-xs text-[var(--muted)]">By {e.actor_label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
