"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PartyFormModal } from "@/components/parties/party-form-modal";
import type { PartyListRow } from "@/lib/parties/load-parties";
import { primaryButtonBlock } from "@/lib/ui/primary-button";
import { canEditOrgMaintainedRecordFromFlags } from "@/lib/access/org-maintained-record";

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export function PartyListPane({
  parties,
  currentUserId,
  isAccountOwnerForActiveOrg,
  isCompanyAdmin,
  organizationCountryCode = "IN",
  billingCountryCode,
}: {
  parties: PartyListRow[];
  currentUserId: string;
  isAccountOwnerForActiveOrg: boolean;
  isCompanyAdmin: boolean;
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editParty, setEditParty] = useState<PartyListRow | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parties;
    return parties.filter((p) => p.display_name.toLowerCase().includes(s));
  }, [parties, q]);

  useEffect(() => {
    if (!editParty) return;
    const fresh = parties.find((p) => p.id === editParty.id);
    if (fresh && fresh.updated_at !== editParty.updated_at) setEditParty(fresh);
  }, [parties, editParty]);

  return (
    <div className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--card)] lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
      <aside className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[var(--border)] p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Parties</h2>
          <button type="button" onClick={() => setCreateOpen(true)} className={`mb-3 touch-manipulation ${primaryButtonBlock}`}>
            Add party
          </button>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search party name…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            autoComplete="off"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
          {filtered.map((p) => {
            const active = pathname === `/parties/${p.id}`;
            return (
              <li key={p.id} className="border-b border-[var(--border)]/60 last:border-0">
                <div className="flex items-center gap-1 py-2">
                  <Link
                    href={`/parties/${p.id}`}
                    prefetch
                    onMouseEnter={() => router.prefetch(`/parties/${p.id}`)}
                    onFocus={() => router.prefetch(`/parties/${p.id}`)}
                    onTouchStart={() => {
                      router.prefetch(`/parties/${p.id}`);
                    }}
                    className={
                      "min-w-0 flex-1 touch-manipulation truncate rounded-md px-2 py-1.5 active:opacity-70 " +
                      (active ? "bg-sky-600/15 font-medium text-sky-800 dark:text-sky-200" : "hover:bg-[var(--border)]")
                    }
                  >
                    {p.display_name}
                  </Link>
                  <button
                    type="button"
                    title="Edit party addresses"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditParty(p);
                    }}
                    className="shrink-0 touch-manipulation rounded-md p-2 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] active:opacity-70"
                  >
                    <IconPencil />
                  </button>
                </div>
              </li>
            );
          })}
          {!filtered.length ? (
            <li className="px-2 py-6 text-center text-[var(--muted)]">
              {parties.length ? "No matches." : "No parties yet."}
            </li>
          ) : null}
        </ul>
      </aside>

      <PartyFormModal
        key="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        organizationCountryCode={organizationCountryCode}
        billingCountryCode={billingCountryCode}
        onSaved={() => router.refresh()}
      />

      {editParty ? (
        <PartyFormModal
          key={`${editParty.id}-${editParty.updated_at}`}
          open
          onClose={() => setEditParty(null)}
          mode="edit"
          party={editParty}
          canEditBilling={canEditOrgMaintainedRecordFromFlags(
            {
              userId: currentUserId,
              isAccountOwnerForActiveOrg,
              isCompanyAdmin,
            },
            editParty.managed_by_user_id,
          )}
          organizationCountryCode={organizationCountryCode}
          billingCountryCode={billingCountryCode}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
