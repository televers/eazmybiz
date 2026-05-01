"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PartyListRow } from "@/lib/parties/load-parties";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-full";

/** Party display name only: type to filter saved parties, or type any name. No “save party” here. */
export function GatePassPartyNameField({
  parties,
  partyId,
  partyName,
  onChange,
  disabled,
}: {
  parties: PartyListRow[];
  partyId: string | null;
  partyName: string;
  onChange: (partyId: string | null, partyName: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!parties.length) return [];
    const q = partyName.trim().toLowerCase();
    const base = q
      ? parties.filter(
          (p) =>
            p.display_name.toLowerCase().includes(q) || p.bill_to.name.toLowerCase().includes(q),
        )
      : parties.slice(0, 15);
    return base.slice(0, 12);
  }, [parties, partyName]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  function releaseLinkIfNameEdited(next: string) {
    if (!partyId) {
      onChange(null, next);
      return;
    }
    const row = parties.find((p) => p.id === partyId);
    const linked = (row?.display_name ?? "").trim();
    if (linked && next.trim() === linked) onChange(partyId, next);
    else onChange(null, next);
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={partyName}
        onChange={(e) => {
          releaseLinkIfNameEdited(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={field}
        placeholder="Search saved parties or type a name"
      />
      {open && !disabled && filtered.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-sm shadow-md"
          role="listbox"
        >
          {filtered.map((p) => (
            <li key={p.id} role="option" aria-selected={partyId === p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-[var(--muted)]/15"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.id, p.display_name);
                  setOpen(false);
                }}
              >
                {p.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
