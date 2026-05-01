import { Image, View } from "@react-pdf/renderer";

/** Logo slot on A4 PDFs — wider/taller than legacy 56×32 so marks read clearly; `contain` matches print `object-contain`. */
const LOGO_W = 100;
const LOGO_H = 44;
const LOGO_MR = 10;

type PdfDocumentLogoProps = { src: string };

/** Renders org logo for quotation / delivery challan / packing list PDFs. */
export function PdfDocumentLogo({ src }: PdfDocumentLogoProps) {
  return (
    <View style={{ width: LOGO_W, height: LOGO_H, marginRight: LOGO_MR }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image; org logo in generated PDF */}
      <Image
        src={src}
        cache
        style={{
          width: LOGO_W,
          height: LOGO_H,
          objectFit: "contain",
          objectPosition: "left center",
        }}
      />
    </View>
  );
}

/** Empty slot when there is no logo — keeps consigner text aligned across documents. */
export function PdfDocumentLogoPlaceholder() {
  return <View style={{ width: LOGO_W, height: LOGO_H, marginRight: LOGO_MR }} />;
}
