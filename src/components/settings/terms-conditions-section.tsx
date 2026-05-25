"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  defaultDeliveryChallanTerms,
  defaultPackingTerms,
  defaultQuotationTerms,
} from "@/lib/packing/types";
import { defaultPurchaseOrderTerms } from "@/lib/purchase-order/org-address";
import { primaryButtonCompact } from "@/lib/ui/primary-button";
import { saveDocumentTerms, type DocumentTermsKind } from "@/app/(main)/settings/company/actions";

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full font-mono text-xs leading-relaxed";

type TermsItem = {
  kind: DocumentTermsKind;
  label: string;
  value: string;
  defaultText: () => string;
  showDefaultHint?: boolean;
};

function TermsCard({ item }: { item: TermsItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = item.value.trim() || item.defaultText();
  const usingDefault = !item.value.trim();

  async function onSave() {
    setError(null);
    setLoading(true);
    try {
      await saveDocumentTerms(item.kind, draft);
      setEditing(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-[var(--foreground)]">{item.label}</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(item.value.trim() || item.defaultText());
              setEditing(true);
              setError(null);
            }}
            className="text-xs font-medium text-sky-600 hover:underline"
          >
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className={field}
            placeholder={item.defaultText()}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => void onSave()} className={primaryButtonCompact}>
              {loading ? "Saving…" : "Save terms"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setDraft(item.value);
                setEditing(false);
                setError(null);
              }}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {usingDefault && item.showDefaultHint !== false ? (
            <p className="text-[11px] text-[var(--muted)]">Using default text</p>
          ) : null}
          <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--foreground)]">
            {display}
          </pre>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function TermsConditionsSection({
  quotationTerms,
  purchaseOrderTerms,
  deliveryChallanTerms,
  packingTerms,
}: {
  quotationTerms: string;
  purchaseOrderTerms: string;
  deliveryChallanTerms: string;
  packingTerms: string;
}) {
  const items: TermsItem[] = [
    {
      kind: "quotation",
      label: "Quotation",
      value: quotationTerms,
      defaultText: defaultQuotationTerms,
    },
    {
      kind: "purchase_order",
      label: "Purchase order",
      value: purchaseOrderTerms,
      defaultText: defaultPurchaseOrderTerms,
      showDefaultHint: false,
    },
    {
      kind: "delivery_challan",
      label: "Delivery challan",
      value: deliveryChallanTerms,
      defaultText: defaultDeliveryChallanTerms,
    },
    {
      kind: "packing_list",
      label: "Packing list",
      value: packingTerms,
      defaultText: defaultPackingTerms,
    },
  ];

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Terms &amp; conditions</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Default text printed on each document type. Edit any block to customize; leave blank to use the built-in
          default.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <TermsCard key={item.kind} item={item} />
        ))}
      </div>
    </section>
  );
}
