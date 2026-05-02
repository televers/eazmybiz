"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

/** Same-origin worker copied from `pdfjs-dist` into `public/pdfjs/` at setup. */
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

const MAX_PAGES = 60;

/**
 * Renders PDF pages to canvases (PDF.js). `src` must be the authenticated **inline** PDF URL
 * (`.../pdf?inline=1`) so "Open in new tab" can display in the browser instead of forcing download.
 */
export function MobileIssuedPdfPreview({ src }: { src: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const outer = outerRef.current;
    if (!host || !outer) return;

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let pdfDoc: PDFDocumentProxy | null = null;

    host.innerHTML = "";
    setTruncated(false);

    void (async () => {
      try {
        setStatus("loading");
        setErrorMessage(null);

        const res = await fetch(src, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(`Could not load PDF (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

        loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy().catch(() => {});
          return;
        }
        pdfDoc = pdf;

        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const rect = outer.getBoundingClientRect();
        const containerW = Math.max(rect.width > 40 ? rect.width - 16 : window.innerWidth - 48, 280);

        const numPages = Math.min(pdf.numPages, MAX_PAGES);
        if (pdf.numPages > MAX_PAGES) setTruncated(true);

        for (let p = 1; p <= numPages; p++) {
          if (cancelled) break;
          const page = await pdf.getPage(p);
          const base = page.getViewport({ scale: 1 });
          const scale = containerW / base.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) continue;

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className =
            "mb-3 block max-w-full rounded border border-[var(--border)] bg-white shadow-sm dark:bg-neutral-950";

          await page.render({ canvasContext: ctx, viewport }).promise;
          host.appendChild(canvas);
        }

        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(e instanceof Error ? e.message : "Preview failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      host.innerHTML = "";
      void loadingTask?.destroy().catch(() => {});
      void pdfDoc?.destroy().catch(() => {});
    };
  }, [src]);

  return (
    <div ref={outerRef} className="w-full space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700"
        >
          Open in new tab
        </a>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Scroll to see all pages here, or open in a new tab for your browser&apos;s PDF viewer.
      </p>

      {status === "loading" ? (
        <div
          className="h-48 w-full animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/15"
          aria-busy
          aria-label="Loading PDF preview"
        />
      ) : null}

      {status === "error" ? (
        <div className="space-y-2 text-sm">
          <p className="text-red-600">{errorMessage ?? "Could not show preview."}</p>
          <a href={src} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-600 underline">
            Open in new tab
          </a>
        </div>
      ) : null}

      {truncated ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Showing first {MAX_PAGES} pages only. Open in a new tab or use <strong>Download PDF</strong> below for the
          full file.
        </p>
      ) : null}

      <div
        ref={hostRef}
        className="max-h-[min(78dvh,1200px)] w-full overflow-y-auto overflow-x-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-2"
      />
    </div>
  );
}
