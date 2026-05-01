"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { primaryButtonXs } from "@/lib/ui/primary-button";

export function ItemListPane({ items }: { items: SavedItemRow[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) =>
      [
        p.description,
        p.default_unit,
        p.make_service_provider,
        p.model_part_no_description,
        p.hsn_sac,
      ].some((x) => (x || "").toLowerCase().includes(s)),
    );
  }, [items, q]);

  return (
    <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--card)] lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-[var(--border)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Saved items</h2>
          <Link href="/items#add-item" className={primaryButtonXs}>
            Add new item
          </Link>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, unit, HSN…"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          autoComplete="off"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
        {filtered.map((p) => {
          const active = pathname === `/items/${p.id}`;
          return (
            <li key={p.id} className="border-b border-[var(--border)]/60 last:border-0">
              <Link
                href={`/items/${p.id}`}
                className={
                  "flex min-h-[2.25rem] items-center justify-between gap-2 rounded-md px-2 py-1.5 " +
                  (active ? "bg-sky-600/15 font-medium text-sky-800 dark:text-sky-200" : "hover:bg-[var(--border)]")
                }
              >
                <span className="min-w-0 truncate text-sm">{p.description}</span>
                <span className="shrink-0 tabular-nums text-xs text-[var(--muted)]">{p.default_unit}</span>
              </Link>
            </li>
          );
        })}
        {!filtered.length ? (
          <li className="px-2 py-6 text-center text-[var(--muted)]">
            {items.length ? "No matches." : "No saved items yet."}
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
