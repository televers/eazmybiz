import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Organization } from "@/types/database";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";
import { defaultDeliveryChallanTerms, type PackingListTemplateId, type PartySnapshot } from "@/lib/packing/types";
import type { QuotationAdditionalCharge } from "@/lib/quotation/types";
import { amountInWordsForCurrency } from "@/lib/amount-in-words";
import { formatAmountPdf, formatMoneyPdf } from "@/lib/currencies";
import { formatDocumentDateDdMmYyyy, formatIsoDateOnlyDdMmYyyy } from "@/lib/packing/date-format";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { dcTotalsWithAdditionalCharges } from "@/lib/delivery-challan/compute";
import { formatDeliveryChallanOptionalDetailLine } from "@/lib/delivery-challan/format-line";
import { formatQuotationBankDetailLines, hasQuotationBankDetails } from "@/lib/quotation/bank-details-print";
import { PdfDocumentLogo, PdfDocumentLogoPlaceholder } from "@/lib/pdf/document-logo-pdf";
import { packingListPdfTheme } from "@/lib/packing/packing-list-templates";

const INNER_W = 539;
const COL = {
  sr: 22,
  desc: 151,
  hsn: 43,
  unit: 32,
  qty: 38,
  rate: 49,
  taxable: 54,
  taxPct: 32,
  taxAmt: 54,
  lineTotal: 64,
} as const;

const SPAN_LINE_LABEL = COL.sr + COL.desc + COL.hsn + COL.unit;

function buildDeliveryChallanPdfStyles(theme: ReturnType<typeof packingListPdfTheme>) {
  const { border, headerBg, headerFg, accent, totalBg, optionalSub } = theme;
  return StyleSheet.create({
    page: {
      padding: 28,
      paddingBottom: 36,
      fontFamily: "Helvetica",
      fontSize: 8,
      color: "#0f172a",
      lineHeight: 1.35,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
      paddingBottom: 10,
    },
    title: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 2,
      marginBottom: 6,
    },
    meta: { fontSize: 8, marginTop: 3, textAlign: "right" },
    metaLabel: { color: "#64748b" },
    twoCol: { flexDirection: "row", gap: 12, marginBottom: 10 },
    box: { flex: 1, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 6 },
    boxTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    boxBody: { fontSize: 7.5, lineHeight: 1.4 },
    transportBox: { flex: 1, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 6 },
    transportRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
    transportLabel: { fontSize: 7.5, color: "#64748b", width: "42%" },
    transportValue: { fontSize: 7.5, textAlign: "right", flex: 1 },
    tableOuter: { width: INNER_W, alignSelf: "flex-start" },
    th: {
      paddingVertical: 5,
      paddingHorizontal: 4,
      fontSize: 6,
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
      paddingVertical: 5,
      paddingHorizontal: 4,
      fontSize: 6.5,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexShrink: 0,
      flexGrow: 0,
    },
    tdNum: {
      paddingVertical: 5,
      paddingHorizontal: 4,
      fontSize: 6.5,
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
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexDirection: "column",
      flexShrink: 0,
      flexGrow: 0,
      justifyContent: "flex-start",
    },
    lineMain: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#0f172a", lineHeight: 1.35 },
    lineCompact: { fontSize: 6, fontFamily: "Helvetica", color: optionalSub, marginTop: 2, lineHeight: 1.35 },
    sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 4 },
    small: { fontSize: 8, lineHeight: 1.4 },
    dcTermsTitle: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      marginTop: 10,
      borderBottomWidth: 1,
      borderBottomColor: border,
      paddingBottom: 2,
    },
    dcTermsLi: { fontSize: 8, marginBottom: 2, marginLeft: 8 },
    ackSection: {
      marginTop: 10,
      flexDirection: "row",
      gap: 8,
      width: INNER_W,
      alignSelf: "flex-start",
    },
    ackHalf: {
      flex: 1,
      borderWidth: 1,
      borderColor: border,
      padding: 6,
    },
    ackTitle: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: "#0f172a",
      marginBottom: 4,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    ackFormRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 4,
    },
    ackFormRowFirst: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 5,
    },
    ackLabelCol: {
      width: 62,
      fontSize: 8,
      color: "#334155",
      paddingBottom: 1,
    },
    ackLabelColSig: {
      width: 62,
      fontSize: 8,
      color: "#334155",
      paddingBottom: 2,
    },
    ackRule: {
      flex: 1,
      borderBottomWidth: 0.75,
      borderBottomColor: border,
      minHeight: 9,
      marginLeft: 4,
    },
    ackFormRowSig: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 4,
    },
    ackRuleSig: {
      flex: 1,
      borderBottomWidth: 0.75,
      borderBottomColor: border,
      minHeight: 22,
      marginLeft: 4,
    },
    ackForLine: { fontSize: 8, lineHeight: 1.35, color: "#0f172a" },
    ackSignatoryCaption: { fontSize: 8, color: "#334155", marginTop: 10 },
    ackSignatoryRule: {
      borderBottomWidth: 0.75,
      borderBottomColor: border,
      marginTop: 24,
      minHeight: 10,
    },
    footer: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: border,
      paddingTop: 6,
    },
    totalRow: { backgroundColor: totalBg },
  });
}

export type DeliveryChallanPdfInput = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  documentDate: string | null;
  issuedAt: string | null;
  currency: string;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  lines: DeliveryChallanLine[];
  additionalCharges: QuotationAdditionalCharge[];
  poNo: string | null;
  poDate: string | null;
  lrDocketNo: string | null;
  ewayBillNo: string | null;
  transportName: string | null;
  transporterId: string | null;
  vehicleNo: string | null;
  notes: string | null;
  poweredBy: string | null;
  logoUrl: string | null;
};

function fmtDate(s: string | null | undefined): string {
  if (s == null || String(s).trim() === "") return "—";
  return formatDocumentDateDdMmYyyy(s, null);
}

export function DeliveryChallanPdfDocument(props: DeliveryChallanPdfInput) {
  const palette = packingListPdfTheme(props.template);
  const styles = buildDeliveryChallanPdfStyles(palette);
  const combined = dcTotalsWithAdditionalCharges(props.lines, props.additionalCharges ?? []);
  const t = combined.lines;
  const words = amountInWordsForCurrency(combined.final_grand_total, props.currency);
  const consigner = formatConsignerBlock(props.org);
  const docDateDisplay = formatDocumentDateDdMmYyyy(props.documentDate, props.issuedAt);
  const issuedDateDisplay = props.issuedAt ? formatIsoDateOnlyDdMmYyyy(props.issuedAt) : null;
  const tq = props.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const dcTermsLines = (props.org.delivery_challan_terms?.trim() || defaultDeliveryChallanTerms())
    .split("\n")
    .filter(Boolean);

  const transportRows: { label: string; value: string }[] = [
    { label: "PO no.", value: props.poNo?.trim() || "—" },
    { label: "PO date", value: fmtDate(props.poDate) },
    { label: "LR / Docket no.", value: props.lrDocketNo?.trim() || "—" },
    { label: "E-way bill no.", value: props.ewayBillNo?.trim() || "—" },
    { label: "Transport name", value: props.transportName?.trim() || "—" },
    { label: "Transporter ID", value: props.transporterId?.trim() || "—" },
    { label: "Vehicle no.", value: props.vehicleNo?.trim() || "—" },
  ];

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
            <Text style={styles.title}>Delivery challan</Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Date: </Text>
              {docDateDisplay}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Challan no.: </Text>
              {props.docNumber}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Currency: </Text>
              {props.currency}
            </Text>
            {issuedDateDisplay ? (
              <Text style={styles.meta}>
                <Text style={styles.metaLabel}>Issued: </Text>
                {issuedDateDisplay}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Bill to</Text>
              <Text style={styles.boxBody}>{formatPartyBlock(props.billTo).join("\n") || "—"}</Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Ship to</Text>
              <Text style={styles.boxBody}>{formatPartyBlock(props.shipTo).join("\n") || "—"}</Text>
            </View>
          </View>
          <View style={styles.transportBox}>
            <Text style={styles.boxTitle}>Transport & documents</Text>
            {transportRows.map((r) => (
              <View key={r.label} style={styles.transportRow} wrap={false}>
                <Text style={styles.transportLabel}>{r.label}</Text>
                <Text style={styles.transportValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tableOuter}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: COL.sr, borderLeftWidth: 1, borderLeftColor: palette.border }]}>#</Text>
            <View
              style={[
                styles.th,
                {
                  width: COL.desc,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  textAlign: "left",
                },
              ]}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 6, color: palette.headerFg }}>Description</Text>
              <Text style={{ fontSize: 5, color: palette.headerSub, marginTop: 2 }}>Model/Part No. , Make</Text>
            </View>
            <Text style={[styles.th, { width: COL.hsn }]}>HSN</Text>
            <Text style={[styles.th, { width: COL.unit }]}>Unit</Text>
            <Text style={[styles.th, { width: COL.qty, textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.th, { width: COL.rate, textAlign: "right" }]}>Unit rate</Text>
            <Text style={[styles.th, { width: COL.taxable, textAlign: "right" }]}>Taxable</Text>
            <Text style={[styles.th, { width: COL.taxPct, textAlign: "right" }]}>Tax %</Text>
            <Text style={[styles.th, { width: COL.taxAmt, textAlign: "right" }]}>Tax amt</Text>
            <Text style={[styles.th, { width: COL.lineTotal, textAlign: "right" }]}>Total</Text>
          </View>

          {props.lines.map((line, i) => {
            const opt = formatDeliveryChallanOptionalDetailLine(line);
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
                  <Text style={styles.lineMain}>{line.description?.trim() || "—"}</Text>
                  {opt ? <Text style={styles.lineCompact}>{opt}</Text> : null}
                </View>
                <Text style={[styles.td, { width: COL.hsn, textAlign: "center" }]}>{line.hsn || "—"}</Text>
                <Text style={[styles.td, { width: COL.unit, textAlign: "center" }]}>{line.unit || "—"}</Text>
                <Text style={[styles.tdNum, { width: COL.qty }]}>{line.qty}</Text>
                <Text style={[styles.tdNum, { width: COL.rate }]}>{formatAmountPdf(line.unit_price)}</Text>
                <Text style={[styles.tdNum, { width: COL.taxable }]}>{formatAmountPdf(line.taxable_value)}</Text>
                <Text style={[styles.tdNum, { width: COL.taxPct }]}>{line.tax_percent}</Text>
                <Text style={[styles.tdNum, { width: COL.taxAmt }]}>{formatAmountPdf(line.tax_amount)}</Text>
                <Text style={[styles.tdNum, { width: COL.lineTotal, fontFamily: "Helvetica-Bold" }]}>
                  {formatAmountPdf(line.line_total)}
                </Text>
              </View>
            );
          })}

          <View style={[styles.row, styles.totalRow]} wrap={false}>
            <Text
              style={[
                styles.td,
                {
                  width: SPAN_LINE_LABEL,
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
            <Text style={[styles.tdNum, { width: COL.qty, fontFamily: "Helvetica-Bold" }]}>{tq}</Text>
            <Text style={[styles.td, { width: COL.rate }]} />
            <Text style={[styles.tdNum, { width: COL.taxable, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.taxable_value)}
            </Text>
            <Text style={[styles.td, { width: COL.taxPct }]} />
            <Text style={[styles.tdNum, { width: COL.taxAmt, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.tax_amount)}
            </Text>
            <Text style={[styles.tdNum, { width: COL.lineTotal, fontFamily: "Helvetica-Bold" }]}>
              {formatAmountPdf(t.grand_total)}
            </Text>
          </View>
        </View>

        {combined.additional_charges.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Additional charges</Text>
            {combined.additional_charges.map((c, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={styles.small}>{c.label || "—"}</Text>
                <Text style={[styles.small, { fontFamily: "Helvetica-Bold" }]}>
                  {`${formatAmountPdf(c.amount)} + ${c.tax_percent}% tax -> ${formatAmountPdf(c.line_total)}`}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>Grand total</Text>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{formatMoneyPdf(combined.final_grand_total, props.currency)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Amount in words</Text>
        <Text style={styles.small}>{words}</Text>

        {props.notes?.trim() ? (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.small}>{props.notes}</Text>
          </>
        ) : null}

        <Text style={styles.dcTermsTitle}>Delivery challan — terms & conditions</Text>
        {dcTermsLines.map((line, i) => (
          <Text key={i} style={styles.dcTermsLi}>
            {i + 1}. {line}
          </Text>
        ))}

        {hasQuotationBankDetails(props.org) ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Bank details</Text>
            {formatQuotationBankDetailLines(props.org).map((line, i) => (
              <Text key={i} style={styles.small}>
                {line}
              </Text>
            ))}
          </>
        ) : null}

        <View style={styles.ackSection}>
          <View style={styles.ackHalf}>
            <Text style={styles.ackTitle}>Received by</Text>
            <View style={styles.ackFormRowFirst}>
              <Text style={styles.ackLabelCol}>Name:</Text>
              <View style={styles.ackRule} />
            </View>
            <View style={styles.ackFormRow}>
              <Text style={styles.ackLabelCol}>Comment:</Text>
              <View style={styles.ackRule} />
            </View>
            <View style={styles.ackFormRow}>
              <Text style={styles.ackLabelCol}>Date:</Text>
              <View style={styles.ackRule} />
            </View>
            <View style={styles.ackFormRowSig}>
              <Text style={styles.ackLabelColSig}>Signature:</Text>
              <View style={styles.ackRuleSig} />
            </View>
          </View>
          <View style={styles.ackHalf}>
            <Text style={styles.ackForLine}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>For </Text>
              {props.org.name?.trim() || "—"}
            </Text>
            <Text style={styles.ackSignatoryCaption}>Authorised signatory</Text>
            <View style={styles.ackSignatoryRule} />
          </View>
        </View>

        {props.poweredBy ? <Text style={styles.footer}>{props.poweredBy}</Text> : null}
      </Page>
    </Document>
  );
}
