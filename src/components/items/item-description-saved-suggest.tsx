"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { savedItemMakeModelSubtitle } from "@/lib/items/saved-item-subtitle";

const MAX_SUGGESTIONS = 12;

function itemMatchesQuery(it: SavedItemRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return false;
  return [it.description, it.default_unit, it.make_service_provider, it.model_part_no_description, it.hsn_sac].some(
    (x) => (x || "").toLowerCase().includes(s),
  );
}

/** Full product name + make/model when a saved catalog item is linked on a line. */
export function SavedItemLineNamePreview({
  description,
  make_service_provider,
  model_part_no_description,
  className = "",
}: {
  description: string;
  make_service_provider?: string | null;
  model_part_no_description?: string | null;
  className?: string;
}) {
  const subtitle = savedItemMakeModelSubtitle({ make_service_provider, model_part_no_description });
  return (
    <div
      className={
        "rounded-md border border-[var(--border)] bg-[var(--muted)]/10 px-2 py-1.5 " + className
      }
    >
      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-snug text-[var(--foreground)]">
        {description.trim() || "—"}
      </p>
      {subtitle ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug text-[var(--muted)]">
          {subtitle}
        </p>
      ) : null}
    </div>
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
          {suggestions.map((it) => {
            const subtitle = savedItemMakeModelSubtitle(it);
            return (
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
                <span className="block whitespace-pre-wrap break-words font-medium leading-snug text-[var(--foreground)]">
                  {it.description}
                </span>
                {subtitle ? (
                  <span className="mt-0.5 block whitespace-pre-wrap break-words text-[10px] leading-snug text-[var(--muted)]">
                    {subtitle}
                  </span>
                ) : null}
              </button>
            </li>
            );
          })}
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
