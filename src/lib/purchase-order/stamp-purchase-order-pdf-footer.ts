import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PurchaseOrderPdfFooterStampInput = {
  docNumber: string;
  poweredBy: string | null;
};

/**
 * Stamps purchase order no., page x of y (when more than one page), and optional powered-by line
 * onto each page. Uses pdf-lib so the footer is visible regardless of @react-pdf fixed/layer quirks.
 */
export async function stampPurchaseOrderPdfFooter(
  pdfBytes: Uint8Array,
  opts: PurchaseOrderPdfFooterStampInput,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const fontSize = 8;
  const textColor = rgb(0.28, 0.33, 0.41);
  const lineColor = rgb(0.8, 0.84, 0.88);
  const marginX = 28;
  const textY = 22;

  for (let i = 0; i < totalPages; i++) {
    const page = pages[i]!;
    const { width } = page.getSize();
    const pageNum = i + 1;

    let text: string | null = null;
    if (totalPages > 1) {
      const parts = [`Purchase Order No.: ${opts.docNumber}`, `Page ${pageNum} of ${totalPages}`];
      if (opts.poweredBy) parts.push(opts.poweredBy);
      text = parts.join("  ·  ");
    } else if (opts.poweredBy) {
      text = opts.poweredBy;
    }

    if (!text) continue;

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const x = Math.min(Math.max(marginX, (width - textWidth) / 2), width - marginX - textWidth);
    const lineY = textY + fontSize + 5;

    page.drawLine({
      start: { x: marginX, y: lineY },
      end: { x: width - marginX, y: lineY },
      thickness: 0.75,
      color: lineColor,
    });

    page.drawText(text, {
      x,
      y: textY,
      size: fontSize,
      font,
      color: textColor,
    });
  }

  return pdfDoc.save({ useObjectStreams: false });
}
