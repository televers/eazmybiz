import type { ReactNode } from "react";
import { MobileIssuedPdfPreview } from "@/components/documents/mobile-issued-pdf-preview";

type Props = {
  /** When set with downloadPdfHref, viewports below lg show an embedded PDF (same as download). */
  inlinePdfSrc: string | null;
  downloadPdfHref: string | null;
  children: ReactNode;
};

/**
 * Screen preview for /print routes: on phones and tablets, issued documents use the real PDF so
 * users can pinch-zoom like the file viewer. Drafts use horizontal scroll around a fixed min width.
 * At lg and up, only the HTML print layout is shown (unchanged for desktop print / Ctrl+P).
 */
export function SalesDocumentScreenPrintPreview({ inlinePdfSrc, downloadPdfHref, children }: Props) {
  const showEmbeddedPdf = Boolean(inlinePdfSrc && downloadPdfHref);

  if (showEmbeddedPdf) {
    return (
      <>
        <div className="lg:hidden space-y-2">
          <p className="text-xs text-[var(--muted)]">
            In-app preview renders the PDF as pages you can scroll. Use <strong>Open in new tab</strong> for your
            browser viewer, or <strong>Download PDF</strong> below to save the file.
          </p>
          <MobileIssuedPdfPreview src={inlinePdfSrc!} />
        </div>
        <div className="hidden lg:block">{children}</div>
      </>
    );
  }

  return (
    <div className="lg:contents">
      <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0 lg:overflow-visible lg:pb-0">
        <div className="w-full min-w-[794px] max-w-full lg:min-w-0">{children}</div>
      </div>
    </div>
  );
}
