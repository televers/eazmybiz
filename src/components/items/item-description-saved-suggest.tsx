"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SavedItemRow } from "@/lib/items/saved-item-types";

const MAX_SUGGESTIONS = 12;

function itemMatchesQuery(it: SavedItemRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return false;
  return [it.description, it.default_unit, it.make_service_provider, it.model_part_no_description, it.hsn_sac].some(
    (x) => (x || "").toLowerCase().includes(s),
  );
}

export function ItemDescriptionWithSavedSuggest({
  value,
  onChange,
  onPickSaved,
  savedItems,
  inputClassName,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  onPickSaved: (item: SavedItemRow) => void;
  savedItems: SavedItemRow[];
  inputClassName: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!savedItems.length) return [];
    return savedItems.filter((it) => itemMatchesQuery(it, value)).slice(0, MAX_SUGGESTIONS);
  }, [value, savedItems]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showList = open && value.trim().length > 0 && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        required={required}
        autoComplete="off"
        className={inputClassName}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length > 0) setOpen(true);
        }}
        placeholder={placeholder}
      />
      {showList ? (
        <ul
          className="absolute z-50 mt-1 max-h-48 w-full min-w-[240px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-left text-xs shadow-md"
          role="listbox"
        >
          {suggestions.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-[var(--border)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPickSaved(it);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-[var(--foreground)]">{it.description}</span>
                <span className="text-[var(--muted)]"> · {it.default_unit}</span>
                {it.hsn_sac ? <span className="block truncate text-[10px] text-[var(--muted)]">HSN/SAC {it.hsn_sac}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open &&
      value.trim().length >= 2 &&
      savedItems.length > 0 &&
      suggestions.length === 0 ? (
        <p className="pointer-events-none absolute z-40 mt-1 w-full rounded-md border border-[var(--border)]/80 bg-[var(--card)] px-2 py-1.5 text-[10px] text-[var(--muted)] shadow-sm">
          No saved item matches — continue with your text and other fields for a one-off line.
        </p>
      ) : null}
    </div>
  );
}
