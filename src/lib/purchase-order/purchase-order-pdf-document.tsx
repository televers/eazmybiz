import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Organization } from "@/types/database";
import { defaultPurchaseOrderTerms } from "@/lib/purchase-order/org-address";
import type { PackingListTemplateId, PartySnapshot } from "@/lib/packing/types";
import type { QuotationAdditionalCharge, QuotationLine } from "@/lib/quotation/types";
import { amountInWordsForCurrency } from "@/lib/amount-in-words";
import { formatAmountPdf, formatMoneyPdf } from "@/lib/currencies";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";
import { formatDateDdMmYyyy } from "@/lib/quotation/dates";
import { formatDateTimeIst } from "@/lib/packing/date-format";
import { formatQuotationOptionalDetailLine } from "@/lib/quotation/format-line";
import { formatQuotationBankDetailLines, hasQuotationBankDetails } from "@/lib/quotation/bank-details-print";
import { PdfDocumentLogo, PdfDocumentLogoPlaceholder } from "@/lib/pdf/document-logo-pdf";
import { packingListPdfTheme } from "@/lib/packing/packing-list-templates";

/**
 * A4 portrait (~595pt) minus horizontal padding 28×2 → fixed column widths (pt).
 * react-pdf/Yoga misaligns %-based cells when borders stack; pt widths + flexShrink:0 keep grid stable.
 */
const INNER_W = 539;
/** Slightly wider description + qty/price/total columns; trim tax/HSN so larger type still fits cleanly. */
const COL = {
  sr: 26,
  desc: 184,
  hsn: 38,
  unit: 30,
  qty: 32,
  unitPrice: 46,
  taxable: 44,
  taxPct: 30,
  taxAmt: 40,
  lineTotal: 69,
} as const;

const SPAN_LINE_ITEMS_LABEL = COL.sr + COL.desc + COL.hsn + COL.unit;

function buildPurchaseOrderPdfStyles(theme: ReturnType<typeof packingListPdfTheme>) {
  const { border, headerBg, headerFg, accent, totalBg, optionalSub } = theme;
  return StyleSheet.create({
    page: {
      padding: 28,
      paddingBottom: 44,
      fontFamily: "Helvetica",
      fontSize: 9,
      color: "#0f172a",
      lineHeight: 1.35,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: border,
      paddingBottom: 10,
    },
    title: {
      fontSize: 15,
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 2,
      marginBottom: 6,
    },
    meta: { fontSize: 9, marginTop: 3, textAlign: "right" },
    metaLabel: { color: "#64748b" },
    twoCol: { flexDirection: "row", gap: 14, marginBottom: 12 },
    box: { flex: 1, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 6 },
    boxTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    boxBody: { fontSize: 8, lineHeight: 1.4 },
    tableOuter: {
      width: INNER_W,
      alignSelf: "flex-start",
    },
    th: {
      paddingVertical: 6,
      paddingHorizontal: 4,
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: headerFg,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      textAlign: "center",
      flexShrink: 0,
      flexGrow: 0,
    },
    td: {
      paddingVertical: 6,
      paddingHorizontal: 4,
      fontSize: 7,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexShrink: 0,
      flexGrow: 0,
    },
    tdNum: {
      paddingVertical: 6,
      paddingHorizontal: 4,
      fontSize: 7,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      textAlign: "right",
      flexShrink: 0,
      flexGrow: 0,
    },
    tdNumFocus: {
      paddingVertical: 6,
      paddingHorizontal: 4,
      fontSize: 8,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      textAlign: "right",
      flexShrink: 0,
      flexGrow: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderStyle: "solid",
      width: INNER_W,
    },
    tableHead: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: headerBg,
      borderTopWidth: 1,
      borderTopColor: border,
      borderTopStyle: "solid",
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: "solid",
      width: INNER_W,
    },
    descCell: {
      width: COL.desc,
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexDirection: "column",
      flexShrink: 0,
      flexGrow: 0,
      justifyContent: "flex-start",
    },
    lineMain: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", lineHeight: 1.35 },
    lineCompact: { fontSize: 6.5, fontFamily: "Helvetica", color: optionalSub, marginTop: 2, lineHeight: 1.35 },
    sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
    small: { fontSize: 8, lineHeight: 1.4 },
    termsLi: { fontSize: 8, marginBottom: 3, marginLeft: 10 },
    totalRow: { backgroundColor: totalBg },
    issued: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 4 },
    issuedFirst: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 8 },
  });
}

export type PurchaseOrderPdfInput = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  documentDate: string | null;
  currency: string;
  vendorTo: PartySnapshot;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  lines: QuotationLine[];
  additionalCharges: QuotationAdditionalCharge[];
  deliveryPeriod: string;
  validUntil: string | null;
  paymentTerm: string;
  deliveryIncoTerm: string;
  termsNotes: string | null;
  notes: string | null;
  purchaseOrderTerms: string | null;
  logoUrl: string | null;
  issuedAt: string | null;
  updatedAt: string | null;
};

export function PurchaseOrderPdfDocument(props: PurchaseOrderPdfInput) {
  const palette = packingListPdfTheme(props.template);
  const styles = buildPurchaseOrderPdfStyles(palette);
  const combined = quotationTotalsWithAdditionalCharges(props.lines, props.additionalCharges ?? []);
  const t = combined.lines;
  const words = amountInWordsForCurrency(combined.final_grand_total, props.currency);
  const consigner = formatConsignerBlock(props.org);
  const docDateDisplay = formatDateDdMmYyyy(props.documentDate);
  const validUntilDisplay = formatDateDdMmYyyy(props.validUntil);

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", flex: 1 }}>
            {props.logoUrl ? <PdfDocumentLogo src={props.logoUrl} /> : <PdfDocumentLogoPlaceholder />}
            <View style={{ flex: 1 }}>
              {consigner.map((line, i) => (
                <Text key={i} style={i === 0 ? { fontSize: 10, fontFamily: "Helvetica-Bold" } : { fontSize: 8.5, marginTop: 2 }}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
          <View style={{ width: 200, alignItems: "flex-end" }}>
            <Text style={styles.title}>PURCHASE ORDER</Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>No.: </Text>
              {props.docNumber}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Date: </Text>
              {docDateDisplay}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Delivery by: </Text>
              {validUntilDisplay}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Currency: </Text>
              {props.currency}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>Vendor</Text>
            <Text style={styles.boxBody}>{formatPartyBlock(props.vendorTo).join("\n") || "—"}</Text>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>Bill to</Text>
            <Text style={styles.boxBody}>{formatPartyBlock(props.billTo).join("\n") || "—"}</Text>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>Ship to</Text>
            <Text style={styles.boxBody}>{formatPartyBlock(props.shipTo).join("\n") || "—"}</Text>
          </View>
        </View>

        {props.notes?.trim() ? (
          <View style={[styles.box, { marginBottom: 12 }]}>
            <Text style={styles.boxTitle}>Notes</Text>
            <Text style={styles.boxBody}>{props.notes.trim()}</Text>
          </View>
        ) : null}

        <View style={styles.tableOuter}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: COL.sr, borderLeftWidth: 1, borderLeftColor: palette.border }]}>
              Sr
            </Text>
            <View
              style={[
                styles.th,
                {
                  width: COL.desc,
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  textAlign: "left",
                },
              ]}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: palette.headerFg }}>Product / Service</Text>
              <Text style={{ fontSize: 5.5, color: palette.headerSub, marginTop: 2 }}>Model/Part No. , Make</Text>
            </View>
            <Text style={[styles.th, { width: COL.hsn }]}>HSN/SAC</Text>
            <Text style={[styles.th, { width: COL.unit }]}>Unit</Text>
            <Text style={[styles.th, { width: COL.qty, fontSize: 8 }]}>Qty</Text>
            <Text style={[styles.th, { width: COL.unitPrice, fontSize: 8 }]}>Unit price</Text>
            <Text style={[styles.th, { width: COL.taxable }]}>Taxable</Text>
            <Text style={[styles.th, { width: COL.taxPct }]}>Tax %</Text>
            <Text style={[styles.th, { width: COL.taxAmt }]}>Tax amt</Text>
            <Text style={[styles.th, { width: COL.lineTotal, fontSize: 8 }]}>Total</Text>
          </View>

          {props.lines.map((line, i) => {
            const optionalDetail = formatQuotationOptionalDetailLine(line);
            return (
              <View key={i} style={styles.row} wrap={false}>
                <Text
                  style={[
                    styles.td,
                    { width: COL.sr, textAlign: "center", borderLeftWidth: 1, borderLeftColor: palette.border },
                  ]}
                >
                  {i + 1}
                </Text>
                <View style={styles.descCell}>
                  <Text style={styles.lineMain}>{line.description || "—"}</Text>
                  {optionalDetail ? <Text style={styles.lineCompact}>{optionalDetail}</Text> : null}
                </View>
                <Text style={[styles.td, { width: COL.hsn, textAlign: "center" }]}>{line.hsn_sac || "—"}</Text>
                <Text style={[styles.td, { width: COL.unit, textAlign: "center" }]}>{line.unit}</Text>
                <Text style={[styles.tdNumFocus, { width: COL.qty }]}>{line.qty}</Text>
                <Text style={[styles.tdNumFocus, { width: COL.unitPrice }]}>{formatAmountPdf(line.unit_price)}</Text>
                <Text style={[styles.tdNum, { width: COL.taxable }]}>{formatAmountPdf(line.taxable_value)}</Text>
                <Text style={[styles.tdNum, { width: COL.taxPct }]}>{line.tax_percent}</Text>
                <Text style={[styles.tdNum, { width: COL.taxAmt }]}>{formatAmountPdf(line.tax_amount)}</Text>
                <Text style={[styles.tdNumFocus, { width: COL.lineTotal }]}>{formatAmountPdf(line.line_total)}</Text>
              </View>
            );
          })}

          <View style={[styles.row, styles.totalRow]} wrap={false}>
            <Text
              style={[
                styles.td,
                {
                  width: SPAN_LINE_ITEMS_LABEL,
                  fontFamily: "Helvetica-Bold",
                  textAlign: "right",
                  paddingRight: 6,
                  borderLeftWidth: 1,
                  borderLeftColor: palette.border,
                },
              ]}
            >
              Totals (line items)
            </Text>
            <Text style={[styles.tdNumFocus, { width: COL.qty, fontFamily: "Helvetica-Bold" }]}>{t.qty}</Text>
            <Text style={[styles.td, { width: COL.unitPrice }]} />
            <Text style={[styles.tdNum, { width: COL.taxable, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.taxable_value)}
            </Text>
            <Text style={[styles.td, { width: COL.taxPct }]} />
            <Text style={[styles.tdNum, { width: COL.taxAmt, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.tax_amount)}
            </Text>
            <Text style={[styles.tdNumFocus, { width: COL.lineTotal, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.grand_total)}
            </Text>
          </View>
        </View>

        {combined.additional_charges.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Additional charges</Text>
            {combined.additional_charges.map((c, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={styles.small}>{c.label || "—"}</Text>
                <Text style={[styles.small, { fontFamily: "Helvetica-Bold" }]}>
                  {`${formatAmountPdf(c.amount)} + ${c.tax_percent}% tax -> ${formatAmountPdf(c.line_total)}`}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>Grand total</Text>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
            {formatMoneyPdf(combined.final_grand_total, props.currency)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Amount in words</Text>
        <Text style={styles.small}>{words}</Text>

        <Text style={styles.sectionTitle}>Important Terms</Text>
        <Text style={styles.small}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Delivery period: </Text>
          {props.deliveryPeriod || "—"}
        </Text>
        <Text style={styles.small}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Payment: </Text>
          {props.paymentTerm}
        </Text>
        <Text style={styles.small}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Delivery / Incoterm: </Text>
          {props.deliveryIncoTerm}
        </Text>
        {props.termsNotes?.trim() ? <Text style={styles.small}>{props.termsNotes}</Text> : null}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Standard Terms & conditions</Text>
        {(props.purchaseOrderTerms?.trim() || defaultPurchaseOrderTerms())
          .split("\n")
          .filter(Boolean)
          .map((line, i) => (
            <Text key={i} style={styles.termsLi}>
              {i + 1}. {line}
            </Text>
          ))}

        {hasQuotationBankDetails(props.org) ? (
          <>
            <Text style={styles.sectionTitle}>Bank details</Text>
            {formatQuotationBankDetailLines(props.org).map((line, i) => (
              <Text key={i} style={styles.small}>
                {line}
              </Text>
            ))}
          </>
        ) : null}

        {props.issuedAt ? (
          <View>
            <Text style={styles.issuedFirst}>First issued on: {formatDateTimeIst(props.issuedAt)}</Text>
            <Text style={styles.issued}>
              Last revised at: {props.updatedAt ? formatDateTimeIst(props.updatedAt) : "—"}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
