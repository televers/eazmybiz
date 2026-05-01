"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { updateVisitorPassPrintLayout } from "./actions";
import type { VisitorPassPrintLayout } from "@/lib/visitors/visitor-pass-print-layout";

export function VisitorPassPrintLayoutSection({ initialLayout }: { initialLayout: VisitorPassPrintLayout }) {
  const router = useRouter();
  const [layout, setLayout] = useState<VisitorPassPrintLayout>(initialLayout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLayout(initialLayout);
  }, [initialLayout]);

  async function save(next: VisitorPassPrintLayout) {
    if (next === layout) return;
    setError(null);
    setBusy(true);
    try {
      await updateVisitorPassPrintLayout(next);
      setLayout(next);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const optCls = "flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Visitor pass printing</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Default layout when someone opens visitor pass print preview (from the visitor list, detail, or after
        check-in). Either layout can still be chosen on the print page for a single print.
      </p>
      <div className="mt-4 space-y-2">
        <label className={optCls}>
          <input
            type="radio"
            name="visitor-pass-print-layout"
            className="mt-1"
            checked={layout === "id_card"}
            disabled={busy}
            onChange={() => void save("id_card")}
          />
          <span>
            <span className="font-medium text-[var(--foreground)]">ID-1 card</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Wallet-sized pass (about 85.6×54 mm). Includes organization logo when uploaded. Best for small printers
              or kiosk labels.
            </span>
          </span>
        </label>
        <label className={optCls}>
          <input
            type="radio"
            name="visitor-pass-print-layout"
            className="mt-1"
            checked={layout === "a5_foldable"}
            disabled={busy}
            onChange={() => void save("a5_foldable")}
          />
          <span>
            <span className="font-medium text-[var(--foreground)]">A5 foldable badge</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              One A5 portrait sheet: front half shows company details, logo, and visitor information; bottom half is
              instructions to fold on the inside. Fold along the dashed line to make a two-sided badge.
            </span>
          </span>
        </label>
      </div>
      {busy ? <p className="mt-3 text-xs text-[var(--muted)]">Saving…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
