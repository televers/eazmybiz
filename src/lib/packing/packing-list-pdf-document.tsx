import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Organization } from "@/types/database";
import type { PackingListTemplateId, PackingPackage, PartySnapshot } from "@/lib/packing/types";
import { defaultPackingTerms } from "@/lib/packing/types";
import { formatDateTimeIst, formatDocumentDateDdMmYyyy } from "@/lib/packing/date-format";
import { formatGrossWeightKg, formatPackageSizeCm } from "@/lib/packing/package-display";
import { formatConsignerBlock, formatPartyBlock } from "@/lib/packing/format";
import { formatPackingOptionalDetailLine } from "@/lib/packing/format-line";
import { PdfDocumentLogo, PdfDocumentLogoPlaceholder } from "@/lib/pdf/document-logo-pdf";
import { packingListPdfTheme } from "@/lib/packing/packing-list-templates";

export type PackingListPdfInput = {
  template: PackingListTemplateId;
  org: Organization;
  docNumber: string;
  invoiceNo: string | null;
  documentDate: string | null;
  issuedAt: string | null;
  updatedAt: string | null;
  billTo: PartySnapshot;
  shipTo: PartySnapshot;
  packages: PackingPackage[];
  notes: string | null;
  poweredBy: string | null;
  logoUrl: string | null;
};

function totals(packages: PackingPackage[]) {
  let qty = 0;
  let weight = 0;
  for (const p of packages) {
    for (const l of p.lines) qty += Number(l.qty) || 0;
    if (p.package_weight_kg != null && Number.isFinite(p.package_weight_kg)) {
      weight += p.package_weight_kg;
    }
  }
  return { qty, weight };
}

const INNER_W = 539;
const COL = {
  pkg: 32,
  desc: 119,
  unit: 38,
  qty: 43,
  pkgType: 54,
  size: 54,
  weight: 43,
  remarks: 156,
} as const;

const LINES_BLOCK_W = COL.desc + COL.unit + COL.qty;
const SPAN_TOTAL_LABEL = COL.pkg + COL.desc + COL.unit;
const SPAN_TOTAL_MID = COL.pkgType + COL.size;

function buildStyles(theme: ReturnType<typeof packingListPdfTheme>) {
  const { border, headerBg, accent, totalBg, headerSub, optionalSub } = theme;
  return StyleSheet.create({
    page: {
      padding: 28,
      fontFamily: "Helvetica",
      fontSize: 8,
      color: "#0f172a",
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: border,
      paddingBottom: 10,
      marginBottom: 10,
    },
    consigner: { flex: 1, paddingRight: 8 },
    consignerLineBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },
    consignerLine: { fontSize: 8, marginTop: 2 },
    titleBlock: { width: 150, alignItems: "flex-end" },
    titleText: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 2,
      marginBottom: 6,
    },
    metaLine: { fontSize: 8, marginTop: 2, textAlign: "right" },
    metaLabel: { color: "#64748b" },
    twoCol: { flexDirection: "row", gap: 12, marginBottom: 10 },
    partyBox: { flex: 1, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 4 },
    partyTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    partyBody: { fontSize: 8, lineHeight: 1.35 },
    tableWrap: {
      width: INNER_W,
      alignSelf: "flex-start",
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderLeftColor: border,
      borderRightColor: border,
      borderStyle: "solid",
    },
    tableHeader: {
      flexDirection: "row",
      alignItems: "stretch",
      width: INNER_W,
      backgroundColor: headerBg,
      borderTopWidth: 1,
      borderTopColor: border,
      borderTopStyle: "solid",
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: "solid",
    },
    th: {
      paddingVertical: 5,
      paddingHorizontal: 5,
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: theme.headerFg,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexShrink: 0,
      flexGrow: 0,
    },
    thSub: { fontSize: 5.5, color: headerSub, marginTop: 2 },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      width: INNER_W,
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: "solid",
    },
    pkgMergedCell: {
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      paddingVertical: 5,
      paddingHorizontal: 5,
      justifyContent: "flex-start",
      alignItems: "stretch",
      flexShrink: 0,
      flexGrow: 0,
    },
    linesInnerRow: {
      flexDirection: "row",
      alignItems: "stretch",
      width: LINES_BLOCK_W,
    },
    lineCell: {
      paddingVertical: 5,
      paddingHorizontal: 5,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexShrink: 0,
      flexGrow: 0,
      justifyContent: "flex-start",
    },
    lineMain: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: "#0f172a",
      lineHeight: 1.35,
    },
    lineOptional: {
      fontSize: 6.5,
      fontFamily: "Helvetica",
      color: optionalSub,
      marginTop: 2,
      lineHeight: 1.35,
    },
    cellText: { fontSize: 7, lineHeight: 1.35 },
    td: {
      paddingVertical: 5,
      paddingHorizontal: 5,
      fontSize: 7,
      borderRightWidth: 1,
      borderRightColor: border,
      borderStyle: "solid",
      flexShrink: 0,
      flexGrow: 0,
    },
    tdLast: {
      paddingVertical: 5,
      paddingHorizontal: 5,
      fontSize: 7,
      flexShrink: 0,
      flexGrow: 0,
      borderRightWidth: 0,
    },
    totalStrong: { fontSize: 7, fontFamily: "Helvetica-Bold" },
    totalRow: {
      flexDirection: "row",
      alignItems: "stretch",
      width: INNER_W,
      backgroundColor: totalBg,
      borderBottomWidth: 1,
      borderBottomColor: border,
      borderBottomStyle: "solid",
      marginTop: 0,
    },
    notesTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 8 },
    notesBody: { fontSize: 8, marginTop: 2, lineHeight: 1.35 },
    termsTitle: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      marginTop: 10,
      borderBottomWidth: 1,
      borderBottomColor: border,
      paddingBottom: 2,
    },
    termsLi: { fontSize: 8, marginBottom: 2, marginLeft: 8 },
    issued: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 4 },
    issuedFirst: { fontSize: 7, color: "#64748b", textAlign: "center", marginTop: 8 },
    footer: {
      fontSize: 7,
      color: "#64748b",
      textAlign: "center",
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: border,
      paddingTop: 6,
    },
  });
}

function PackageTableBlock({
  pkg,
  styles,
  border,
}: {
  pkg: PackingPackage;
  styles: ReturnType<typeof buildStyles>;
  border: string;
}) {
  const lines = pkg.lines;
  const n = lines.length;

  return (
    <View style={styles.row} wrap>
      <View style={[styles.pkgMergedCell, { width: COL.pkg, alignItems: "center" }]}>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center" }}>
          {String(pkg.package_no)}
        </Text>
      </View>

      <View
        style={{
          width: LINES_BLOCK_W,
          flexDirection: "column",
          flexShrink: 0,
          flexGrow: 0,
          borderRightWidth: 1,
          borderRightColor: border,
          borderStyle: "solid",
        }}
      >
        {lines.map((line, li) => {
          const optional = formatPackingOptionalDetailLine(line);
          return (
            <View
              key={li}
              style={[
                styles.linesInnerRow,
                {
                  borderBottomWidth: li < n - 1 ? 1 : 0,
                  borderBottomColor: border,
                  borderBottomStyle: "solid",
                },
              ]}
            >
              <View style={[styles.lineCell, { width: COL.desc, flexDirection: "column" }]}>
                <Text style={styles.lineMain}>{line.description?.trim() || "—"}</Text>
                {optional ? <Text style={styles.lineOptional}>{optional}</Text> : null}
              </View>
              <View style={[styles.lineCell, { width: COL.unit, justifyContent: "center" }]}>
                <Text style={[styles.cellText, { textAlign: "center", width: "100%" }]}>{line.unit}</Text>
              </View>
              <View style={[styles.lineCell, { width: COL.qty, borderRightWidth: 0, justifyContent: "center" }]}>
                <Text style={[styles.cellText, { textAlign: "right", width: "100%" }]}>{line.qty}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.pkgMergedCell, { width: COL.pkgType }]}>
        <Text style={styles.cellText}>{pkg.package_type || "—"}</Text>
      </View>
      <View style={[styles.pkgMergedCell, { width: COL.size, alignItems: "center" }]}>
        <Text style={[styles.cellText, { textAlign: "center", width: "100%" }]}>
          {formatPackageSizeCm(pkg.package_size)}
        </Text>
      </View>
      <View style={[styles.pkgMergedCell, { width: COL.weight }]}>
        <Text style={[styles.cellText, { textAlign: "right", width: "100%" }]}>
          {formatGrossWeightKg(pkg.package_weight_kg)}
        </Text>
      </View>
      <View style={[styles.pkgMergedCell, { width: COL.remarks, borderRightWidth: 0 }]}>
        <Text style={styles.cellText}>{pkg.packing_remarks || "—"}</Text>
      </View>
    </View>
  );
}

export function PackingListPdfDocument(props: PackingListPdfInput) {
  const { org, packages, template } = props;
  const palette = packingListPdfTheme(template);
  const styles = buildStyles(palette);
  const t = totals(packages);
  const termsText = (org.packing_terms?.trim() || defaultPackingTerms()).split("\n").filter(Boolean);
  const docDate = formatDocumentDateDdMmYyyy(props.documentDate, props.issuedAt);
  const consignerLines = formatConsignerBlock(org);
  const B = palette.border;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", flex: 1 }}>
            {props.logoUrl ? <PdfDocumentLogo src={props.logoUrl} /> : <PdfDocumentLogoPlaceholder />}
            <View style={styles.consigner}>
              {consignerLines.map((line, i) => (
                <Text key={i} style={i === 0 ? styles.consignerLineBold : styles.consignerLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText}>Packing list</Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Date: </Text>
              {docDate}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Packing list no.: </Text>
              {props.docNumber}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaLabel}>Invoice no.: </Text>
              {props.invoiceNo ?? "—"}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>Bill to</Text>
            <Text style={styles.partyBody}>{formatPartyBlock(props.billTo).join("\n") || "—"}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>Ship to</Text>
            <Text style={styles.partyBody}>{formatPartyBlock(props.shipTo).join("\n") || "—"}</Text>
          </View>
        </View>

        <View style={styles.tableWrap}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: COL.pkg, textAlign: "center" }]}>Pkg #</Text>
            <View
              style={[
                styles.th,
                {
                  width: COL.desc,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: palette.headerFg }}>
                Item description
              </Text>
              <Text style={styles.thSub}>Model / part no., make</Text>
            </View>
            <Text style={[styles.th, { width: COL.unit, textAlign: "center" }]}>Unit</Text>
            <Text style={[styles.th, { width: COL.qty, textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.th, { width: COL.pkgType, textAlign: "left" }]}>Pkg type</Text>
            <Text style={[styles.th, { width: COL.size, textAlign: "center" }]}>L×W×H (cm)</Text>
            <Text style={[styles.th, { width: COL.weight, textAlign: "right" }]}>Gross weight (kg)</Text>
            <Text style={[styles.th, { width: COL.remarks, textAlign: "left", borderRightWidth: 0 }]}>Remarks</Text>
          </View>

          {packages.map((pkg) => (
            <PackageTableBlock key={pkg.package_no} pkg={pkg} styles={styles} border={B} />
          ))}

          <View style={styles.totalRow}>
            <View style={[styles.td, { width: SPAN_TOTAL_LABEL }]}>
              <Text style={[styles.totalStrong, { textAlign: "right", width: "100%" }]}>Total</Text>
            </View>
            <View style={[styles.td, { width: COL.qty }]}>
              <Text style={[styles.totalStrong, { textAlign: "right", width: "100%" }]}>{t.qty}</Text>
            </View>
            <View style={[styles.td, { width: SPAN_TOTAL_MID }]} />
            <View style={[styles.td, { width: COL.weight }]}>
              <Text style={[styles.cellText, { textAlign: "right", width: "100%", fontFamily: "Helvetica-Bold" }]}>
                {t.weight ? `${t.weight} kg` : "—"}
              </Text>
            </View>
            <View style={[styles.tdLast, { width: COL.remarks }]} />
          </View>
        </View>

        {props.notes ? (
          <View>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesBody}>{props.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.termsTitle}>Packing list — terms and conditions</Text>
        {termsText.map((line, i) => (
          <Text key={i} style={styles.termsLi}>
            {i + 1}. {line}
          </Text>
        ))}

        {props.issuedAt ? (
          <View>
            <Text style={styles.issuedFirst}>First issued on: {formatDateTimeIst(props.issuedAt)}</Text>
            <Text style={styles.issued}>Last updated on: {formatDateTimeIst(props.updatedAt)}</Text>
          </View>
        ) : null}

        {props.poweredBy ? <Text style={styles.footer}>{props.poweredBy}</Text> : null}
      </Page>
    </Document>
  );
}
