"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  deleteDraftPurchaseOrder,
  duplicatePurchaseOrder,
} from "@/app/(main)/purchase-orders/actions";
import {
  deleteDraftQuotation,
  duplicateQuotation,
} from "@/app/(main)/quotations/actions";
import {
  deleteDraftPackingList,
  duplicatePackingList,
} from "@/app/(main)/packing-lists/actions";
import { deleteDraftDeliveryChallan } from "@/app/(main)/delivery-challans/delete-draft-delivery-challan";
import { duplicateDeliveryChallan } from "@/app/(main)/delivery-challans/actions";
import { duplicateVisitorVisit } from "@/lib/visitors/actions";
export type DocumentRowActionsKind =
  | "quotation"
  | "purchase_order"
  | "packing_list"
  | "delivery_challan"
  | "gate_pass"
  | "visitor";

function printHref(kind: DocumentRowActionsKind, id: string): string {
  switch (kind) {
    case "quotation":
      return `/quotations/${id}/print`;
    case "purchase_order":
      return `/purchase-orders/${id}/print`;
    case "packing_list":
      return `/packing-lists/${id}/print`;
    case "delivery_challan":
      return `/delivery-challans/${id}/print`;
    case "gate_pass":
      return `/gate-passes/${id}/print`;
    case "visitor":
      return `/visitors/${id}/print`;
  }
}

function pdfApiHref(kind: DocumentRowActionsKind, id: string): string | null {
  switch (kind) {
    case "quotation":
      return `/api/quotations/${id}/pdf`;
    case "purchase_order":
      return `/api/purchase-orders/${id}/pdf`;
    case "packing_list":
      return `/api/packing-lists/${id}/pdf`;
    case "delivery_challan":
      return `/api/delivery-challans/${id}/pdf`;
    default:
      return null;
  }
}

/** After duplicate: open editor for docs that have a dedicated edit URL; gate/visitor edit on detail. */
function duplicateOpenHref(kind: DocumentRowActionsKind, id: string): string {
  switch (kind) {
    case "quotation":
      return `/quotations/${id}/edit`;
    case "purchase_order":
      return `/purchase-orders/${id}/edit`;
    case "packing_list":
      return `/packing-lists/${id}/edit`;
    case "delivery_challan":
      return `/delivery-challans/${id}/edit`;
    case "visitor":
      return `/visitors/${id}`;
    case "gate_pass":
      return `/gate-passes/${id}`;
  }
}

function hasPdfDownloadFile(kind: DocumentRowActionsKind, status: string): boolean {
  if (kind === "quotation" || kind === "purchase_order" || kind === "packing_list" || kind === "delivery_challan") {
    return status === "issued";
  }
  return false;
}

/** Visitor: print only for issued passes, visit date is “today” in org calendar, and not checked in yet. */
function visitorShowPrintPreview(
  status: string,
  visitDateYmd: string | undefined,
  checkedInAt: string | null | undefined,
  orgTodayYmd: string | undefined,
): boolean {
  if (status !== "issued") return false;
  const ymd = visitDateYmd?.trim().slice(0, 10) ?? "";
  const today = orgTodayYmd?.trim().slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !today || ymd !== today) return false;
  return checkedInAt == null || String(checkedInAt).trim() === "";
}

function showPrintPreviewOption(
  kind: DocumentRowActionsKind,
  status: string,
  visitorVisitDateYmd: string | undefined,
  visitorCheckedInAt: string | null | undefined,
  gateMaterialMoved: boolean,
  visitorOrgTodayYmd: string | undefined,
): boolean {
  if (kind === "gate_pass") {
    return status === "issued" && !gateMaterialMoved;
  }
  if (kind === "visitor") {
    return visitorShowPrintPreview(status, visitorVisitDateYmd, visitorCheckedInAt, visitorOrgTodayYmd);
  }
  return true;
}

function showDownloadPdfOption(kind: DocumentRowActionsKind, status: string): boolean {
  if (kind === "visitor") {
    return false;
  }
  if (kind === "quotation" || kind === "purchase_order" || kind === "packing_list" || kind === "delivery_challan") {
    return status === "issued";
  }
  /* Gate pass: no PDF in this menu — use Print preview (same URL). */
  return false;
}

async function duplicateDocument(kind: DocumentRowActionsKind, id: string): Promise<{ id: string }> {
  switch (kind) {
    case "quotation":
      return duplicateQuotation(id);
    case "purchase_order":
      return duplicatePurchaseOrder(id);
    case "packing_list":
      return duplicatePackingList(id);
    case "delivery_challan":
      return duplicateDeliveryChallan(id);
    case "visitor":
      return duplicateVisitorVisit(id);
    case "gate_pass":
      throw new Error("Gate passes are created fresh; use New gate pass.");
  }
}

function listPathAfterDeleteDraft(kind: DocumentRowActionsKind): string | null {
  switch (kind) {
    case "quotation":
      return "/quotations";
    case "purchase_order":
      return "/purchase-orders";
    case "packing_list":
      return "/packing-lists";
    case "delivery_challan":
      return "/delivery-challans";
    default:
      return null;
  }
}

async function deleteDraftSalesDocument(kind: DocumentRowActionsKind, id: string): Promise<void> {
  switch (kind) {
    case "quotation":
      return deleteDraftQuotation(id);
    case "purchase_order":
      return deleteDraftPurchaseOrder(id);
    case "packing_list":
      return deleteDraftPackingList(id);
    case "delivery_challan":
      return deleteDraftDeliveryChallan(id);
    default:
      throw new Error("This document type cannot be deleted from the list menu.");
  }
}

function isDraftDocumentStatus(status: string): boolean {
  return String(status ?? "").trim().toLowerCase() === "draft";
}

function showDeleteDraftOption(kind: DocumentRowActionsKind, status: string): boolean {
  if (!isDraftDocumentStatus(status)) return false;
  return kind === "quotation" || kind === "purchase_order" || kind === "packing_list" || kind === "delivery_challan";
}

function openInNewTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}

/** `noopener` on `window.open` can yield a null handle; use plain `_blank` when we must control the tab. */
function openBlankTabForLaterNavigation(): Window | null {
  return window.open("about:blank", "_blank");
}

export function DocumentRowActionsMenu({
  kind,
  documentId,
  status,
  gateMaterialMoved = false,
  visitorVisitDateYmd,
  visitorCheckedInAt,
  visitorOrgTodayYmd,
}: {
  kind: DocumentRowActionsKind;
  documentId: string;
  status: string;
  /** Gate pass: material movement recorded — hides print preview in the row menu. */
  gateMaterialMoved?: boolean;
  /** Visitor: `visit_date` as YYYY-MM-DD (for print eligibility). */
  visitorVisitDateYmd?: string;
  visitorCheckedInAt?: string | null;
  /** Visitor: organization calendar “today” YYYY-MM-DD (server). */
  visitorOrgTodayYmd?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const printUrl = printHref(kind, documentId);
  const apiPdf = pdfApiHref(kind, documentId);
  const showPrint = showPrintPreviewOption(
    kind,
    status,
    visitorVisitDateYmd,
    visitorCheckedInAt,
    gateMaterialMoved,
    visitorOrgTodayYmd,
  );
  const showDownload = showDownloadPdfOption(kind, status);
  const filePdf = apiPdf != null && hasPdfDownloadFile(kind, status);
  const showDuplicate = kind !== "gate_pass";
  const showDeleteDraft = showDeleteDraftOption(kind, status);
  const hasMenuItems = showDuplicate || showDeleteDraft || showPrint || showDownload;

  function syncMenuPosition() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    syncMenuPosition();
    const onResizeOrScroll = () => syncMenuPosition();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onDeleteDraft() {
    const msg =
      "Delete this draft? If it used the last number in its numbering series, that number becomes available again. If other documents already use higher numbers in the same series, the counter stays as-is (no reuse of a middle number).";
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await deleteDraftSalesDocument(kind, documentId);
        setOpen(false);
        const list = listPathAfterDeleteDraft(kind);
        if (list) router.push(list);
        router.refresh();
      } catch (e: unknown) {
        window.alert(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  function onDuplicate() {
    const newTab = openBlankTabForLaterNavigation();
    if (!newTab) {
      window.alert("Allow pop-ups for this site to open the duplicate in a new tab.");
      return;
    }
    startTransition(async () => {
      try {
        const { id: newId } = await duplicateDocument(kind, documentId);
        setOpen(false);
        newTab.location.href = duplicateOpenHref(kind, newId);
        router.refresh();
      } catch (e) {
        newTab.close();
        window.alert(e instanceof Error ? e.message : "Could not duplicate");
      }
    });
  }

  function onPrintPreview() {
    openInNewTab(printUrl);
    setOpen(false);
  }

  function onDownloadPdf() {
    if (filePdf && apiPdf) {
      openInNewTab(apiPdf);
      setOpen(false);
      return;
    }
    if (showDownload) {
      openInNewTab(printUrl);
      setOpen(false);
    }
  }

  const menuPanel = open && menuPos && hasMenuItems && (
    <div
      ref={menuRef}
      role="menu"
      style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
      className="min-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-left text-sm shadow-lg"
    >
      {showDuplicate ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left hover:bg-[var(--border)] disabled:opacity-50"
          disabled={pending}
          onClick={onDuplicate}
        >
          Duplicate
        </button>
      ) : null}
      {showDeleteDraft ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-50"
          disabled={pending}
          onClick={onDeleteDraft}
        >
          Delete draft
        </button>
      ) : null}
      {showPrint ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left hover:bg-[var(--border)]"
          onClick={onPrintPreview}
        >
          Print preview
        </button>
      ) : null}
      {showDownload ? (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-2 text-left hover:bg-[var(--border)]"
          onClick={onDownloadPdf}
        >
          Download PDF
        </button>
      ) : null}
    </div>
  );

  if (!hasMenuItems) {
    return null;
  }

  return (
    <div className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className="rounded p-1 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Document actions"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="block px-0.5 text-lg leading-none">⋮</span>
      </button>
      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
