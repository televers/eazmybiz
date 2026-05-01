"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDraftQuotation } from "@/app/(main)/quotations/actions";
import { deleteDraftPackingList } from "@/app/(main)/packing-lists/actions";
import { deleteDraftDeliveryChallan } from "@/app/(main)/delivery-challans/delete-draft-delivery-challan";

export type DeleteDraftSalesDocKind = "quotation" | "packing_list" | "delivery_challan";

export function DeleteDraftSalesDocumentButton({
  kind,
  documentId,
}: {
  kind: DeleteDraftSalesDocKind;
  documentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    const msg =
      "Delete this draft? If it used the last number in its numbering series, that number becomes available again. If other documents already use higher numbers in the same series, the counter stays as-is (no reuse of a middle number).";
    if (!window.confirm(msg)) return;
    setPending(true);
    try {
      if (kind === "quotation") await deleteDraftQuotation(documentId);
      else if (kind === "packing_list") await deleteDraftPackingList(documentId);
      else await deleteDraftDeliveryChallan(documentId);
      router.push(
        kind === "quotation"
          ? "/quotations"
          : kind === "packing_list"
            ? "/packing-lists"
            : "/delivery-challans",
      );
      router.refresh();
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onDelete}
      className="rounded-md border border-red-200 bg-[var(--card)] px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete draft"}
    </button>
  );
}
