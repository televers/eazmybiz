import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney } from "@/lib/currencies";
import { dcLinesFromJson } from "@/lib/delivery-challan/parse";
import { dcTotalsWithAdditionalCharges } from "@/lib/delivery-challan/compute";
import { formatDocumentDateDdMmYyyy, formatDateTimeIst } from "@/lib/packing/date-format";
import { formatPackingGrossWeightDisplay, packagesFromJson } from "@/lib/packing/parse";
import { additionalChargesFromJson, linesFromJson } from "@/lib/quotation/parse";
import { quotationTotalsWithAdditionalCharges } from "@/lib/quotation/compute";

export type PartyQuotationListRow = {
  id: string;
  doc_number: string;
  dateDdMm: string;
  validUntilDdMm: string;
  value: string;
  currency: string;
  status: string;
  issued: string;
  href: string;
  sortMs: number;
};

export type PartyPackingListRow = {
  id: string;
  doc_number: string;
  dateDdMm: string;
  grossWeightDisplay: string;
  packages: number;
  invoiceNo: string;
  status: string;
  issued: string;
  href: string;
  sortMs: number;
};

export type PartyDcListRow = {
  id: string;
  doc_number: string;
  dateDdMm: string;
  value: string;
  currency: string;
  transporterName: string;
  lrNo: string;
  status: string;
  issued: string;
  href: string;
  sortMs: number;
};

export type PartyPurchaseOrderListRow = {
  id: string;
  doc_number: string;
  dateDdMm: string;
  deliveryByDdMm: string;
  value: string;
  currency: string;
  status: string;
  issued: string;
  href: string;
  sortMs: number;
};

function normName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normGstin(s: string | null | undefined): string {
  return (s ?? "").replace(/\s/g, "").toUpperCase();
}

function jsonPartyFields(j: unknown): { name: string; gstin: string } {
  if (!j || typeof j !== "object") return { name: "", gstin: "" };
  const o = j as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const gstin = typeof o.gstin === "string" ? o.gstin : "";
  return { name, gstin };
}

function buildPartyKeys(displayName: string, billName: string, shipNames: string[], gstins: string[]) {
  const names = new Set<string>();
  for (const raw of [displayName, billName, ...shipNames]) {
    const n = normName(raw);
    if (n) names.add(n);
  }
  const gst = new Set<string>();
  for (const g of gstins) {
    const x = normGstin(g);
    if (x) gst.add(x);
  }
  return { names, gstins: gst };
}

type PartyMatchKeys = ReturnType<typeof buildPartyKeys>;

async function getPartyMatchKeysFromDb(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string,
): Promise<PartyMatchKeys | null> {
  const { data: party } = await supabase
    .from("parties")
    .select("id, display_name")
    .eq("id", partyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!party) return null;

  const { data: addrs } = await supabase
    .from("party_addresses")
    .select("address_role, name, gstin")
    .eq("party_id", partyId)
    .eq("organization_id", organizationId);

  const displayName = (party.display_name as string) ?? "";
  let billName = "";
  const shipNames: string[] = [];
  const gstins: string[] = [];

  for (const r of addrs ?? []) {
    const row = r as { address_role: string; name: string | null; gstin: string | null };
    if (row.address_role === "bill_to") billName = row.name ?? "";
    if (row.address_role === "ship_to" && row.name) shipNames.push(row.name);
    const g = normGstin(row.gstin);
    if (g) gstins.push(row.gstin as string);
  }

  return buildPartyKeys(displayName, billName, shipNames, gstins);
}

async function partyHasRelatedGatePasses(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string,
  keys: PartyMatchKeys,
): Promise<boolean> {
  const { count: linkedCount, error: e1 } = await supabase
    .from("gate_passes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("party_id", partyId);
  if (e1) throw e1;
  if ((linkedCount ?? 0) > 0) return true;

  const { data: legacy, error: e2 } = await supabase
    .from("gate_passes")
    .select("party_name")
    .eq("organization_id", organizationId)
    .is("party_id", null);
  if (e2) throw e2;
  for (const row of legacy ?? []) {
    const nn = normName((row as { party_name: string | null }).party_name);
    if (nn && keys.names.has(nn)) return true;
  }
  return false;
}

function docMatchesVendor(vendor: unknown, keys: PartyMatchKeys): boolean {
  const p = jsonPartyFields(vendor);
  const nn = normName(p.name);
  if (nn && keys.names.has(nn)) return true;
  const gg = normGstin(p.gstin);
  if (gg && keys.gstins.has(gg)) return true;
  return false;
}

function docMatches(
  bill: unknown,
  ship: unknown | null,
  keys: PartyMatchKeys,
): boolean {
  const parts: { name: string; gstin: string }[] = [jsonPartyFields(bill)];
  if (ship != null) parts.push(jsonPartyFields(ship));
  for (const p of parts) {
    const nn = normName(p.name);
    if (nn && keys.names.has(nn)) return true;
    const gg = normGstin(p.gstin);
    if (gg && keys.gstins.has(gg)) return true;
  }
  return false;
}

function sortMsFromRow(
  issued_at: string | null,
  created_at: string | null,
  document_date: string | null | undefined,
): number {
  if (issued_at) {
    const t = Date.parse(issued_at);
    if (!Number.isNaN(t)) return t;
  }
  if (document_date) {
    const t = Date.parse(document_date + "T12:00:00");
    if (!Number.isNaN(t)) return t;
  }
  if (created_at) {
    const t = Date.parse(created_at);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function mergeQuotationRows(a: PartyQuotationListRow[], b: PartyQuotationListRow[]): PartyQuotationListRow[] {
  const map = new Map<string, PartyQuotationListRow>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()].sort((x, y) => y.sortMs - x.sortMs);
}

function mergePackingRows(a: PartyPackingListRow[], b: PartyPackingListRow[]): PartyPackingListRow[] {
  const map = new Map<string, PartyPackingListRow>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()].sort((x, y) => y.sortMs - x.sortMs);
}

function mergeDcRows(a: PartyDcListRow[], b: PartyDcListRow[]): PartyDcListRow[] {
  const map = new Map<string, PartyDcListRow>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()].sort((x, y) => y.sortMs - x.sortMs);
}

function mergePurchaseOrderRows(
  a: PartyPurchaseOrderListRow[],
  b: PartyPurchaseOrderListRow[],
): PartyPurchaseOrderListRow[] {
  const map = new Map<string, PartyPurchaseOrderListRow>();
  for (const r of a) map.set(r.id, r);
  for (const r of b) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()].sort((x, y) => y.sortMs - x.sortMs);
}

function buildQuotationListRow(row: {
  id: string;
  doc_number: string;
  status: string;
  document_date: string | null;
  valid_until: string | null;
  currency: string | null | undefined;
  issued_at: string | null;
  created_at: string | null;
  bill_to: unknown;
  lines: unknown;
  additional_charges: unknown;
}): PartyQuotationListRow {
  const sortMs = sortMsFromRow(row.issued_at, row.created_at, row.document_date ?? undefined);
  const cur = (row.currency ?? "INR").trim() || "INR";
  const totals = quotationTotalsWithAdditionalCharges(
    linesFromJson(row.lines),
    additionalChargesFromJson(row.additional_charges),
  );
  return {
    id: row.id,
    doc_number: row.doc_number,
    dateDdMm: formatDocumentDateDdMmYyyy(row.document_date, row.issued_at),
    validUntilDdMm: formatDocumentDateDdMmYyyy(row.valid_until, null),
    value: formatMoney(totals.final_grand_total, cur),
    currency: cur,
    status: row.status,
    issued: formatDateTimeIst(row.issued_at),
    href: `/quotations/${row.id}`,
    sortMs,
  };
}

function buildPackingListRow(row: {
  id: string;
  doc_number: string;
  status: string;
  document_date: string | null;
  invoice_no: string | null;
  issued_at: string | null;
  created_at: string | null;
  bill_to: unknown;
  ship_to: unknown;
  packages: unknown;
}): PartyPackingListRow {
  const sortMs = sortMsFromRow(row.issued_at, row.created_at, row.document_date ?? undefined);
  const pkgs = packagesFromJson(row.packages);
  return {
    id: row.id,
    doc_number: row.doc_number,
    dateDdMm: formatDocumentDateDdMmYyyy(row.document_date, row.issued_at),
    grossWeightDisplay: formatPackingGrossWeightDisplay(pkgs),
    packages: pkgs.length,
    invoiceNo: row.invoice_no?.trim() || "—",
    status: row.status,
    issued: formatDateTimeIst(row.issued_at),
    href: `/packing-lists/${row.id}`,
    sortMs,
  };
}

function buildDcListRow(row: {
  id: string;
  doc_number: string;
  status: string;
  document_date: string | null;
  currency: string | null | undefined;
  issued_at: string | null;
  created_at: string | null;
  bill_to: unknown;
  transport_name: string | null;
  lr_docket_no: string | null;
  line_items: unknown;
  additional_charges: unknown;
}): PartyDcListRow {
  const sortMs = sortMsFromRow(row.issued_at, row.created_at, row.document_date ?? undefined);
  const cur = (row.currency ?? "INR").trim() || "INR";
  const lines = dcLinesFromJson(row.line_items).filter((l) => l.description.trim().length > 0);
  const totals = dcTotalsWithAdditionalCharges(lines, additionalChargesFromJson(row.additional_charges));
  return {
    id: row.id,
    doc_number: row.doc_number,
    dateDdMm: formatDocumentDateDdMmYyyy(row.document_date, row.issued_at),
    value: formatMoney(totals.final_grand_total, cur),
    currency: cur,
    transporterName: row.transport_name?.trim() || "—",
    lrNo: row.lr_docket_no?.trim() || "—",
    status: row.status,
    issued: formatDateTimeIst(row.issued_at),
    href: `/delivery-challans/${row.id}`,
    sortMs,
  };
}

function buildPurchaseOrderListRow(row: {
  id: string;
  doc_number: string;
  status: string;
  document_date: string | null;
  valid_until: string | null;
  currency: string | null | undefined;
  issued_at: string | null;
  created_at: string | null;
  lines: unknown;
  additional_charges: unknown;
}): PartyPurchaseOrderListRow {
  const sortMs = sortMsFromRow(row.issued_at, row.created_at, row.document_date ?? undefined);
  const cur = (row.currency ?? "INR").trim() || "INR";
  const totals = quotationTotalsWithAdditionalCharges(
    linesFromJson(row.lines),
    additionalChargesFromJson(row.additional_charges),
  );
  return {
    id: row.id,
    doc_number: row.doc_number,
    dateDdMm: formatDocumentDateDdMmYyyy(row.document_date, row.issued_at),
    deliveryByDdMm: formatDocumentDateDdMmYyyy(row.valid_until, null),
    value: formatMoney(totals.final_grand_total, cur),
    currency: cur,
    status: row.status,
    issued: formatDateTimeIst(row.issued_at),
    href: `/purchase-orders/${row.id}`,
    sortMs,
  };
}

async function loadPartyDocumentsWithKeys(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string,
  keys: PartyMatchKeys,
): Promise<{
  quotation: PartyQuotationListRow[];
  packing_list: PartyPackingListRow[];
  delivery_challan: PartyDcListRow[];
  purchase_order: PartyPurchaseOrderListRow[];
}> {
  const qSelect =
    "id, doc_number, status, document_date, valid_until, currency, bill_to, lines, additional_charges, issued_at, created_at";
  const plSelect =
    "id, doc_number, status, invoice_no, document_date, bill_to, ship_to, packages, issued_at, created_at";
  const dcSelect =
    "id, doc_number, status, document_date, currency, bill_to, ship_to, transport_name, lr_docket_no, line_items, additional_charges, issued_at, created_at";
  const poSelect =
    "id, doc_number, status, document_date, valid_until, currency, vendor_to, lines, additional_charges, issued_at, created_at";

  const [
    { data: qLinked },
    { data: qLegacy },
    { data: plLinked },
    { data: plLegacy },
    { data: dcLinked },
    { data: dcLegacy },
    { data: poLinked },
    { data: poLegacy },
  ] = await Promise.all([
    supabase.from("quotations").select(qSelect).eq("organization_id", organizationId).eq("party_id", partyId),
    supabase.from("quotations").select(qSelect).eq("organization_id", organizationId).is("party_id", null),
    supabase.from("packing_lists").select(plSelect).eq("organization_id", organizationId).eq("party_id", partyId),
    supabase.from("packing_lists").select(plSelect).eq("organization_id", organizationId).is("party_id", null),
    supabase.from("delivery_challans").select(dcSelect).eq("organization_id", organizationId).eq("party_id", partyId),
    supabase.from("delivery_challans").select(dcSelect).eq("organization_id", organizationId).is("party_id", null),
    supabase.from("purchase_orders").select(poSelect).eq("organization_id", organizationId).eq("party_id", partyId),
    supabase.from("purchase_orders").select(poSelect).eq("organization_id", organizationId).is("party_id", null),
  ]);

  const qL = (qLinked ?? []).map((q) => buildQuotationListRow(q as Parameters<typeof buildQuotationListRow>[0]));
  const qLeg: PartyQuotationListRow[] = [];
  for (const q of qLegacy ?? []) {
    const row = q as Parameters<typeof buildQuotationListRow>[0] & { bill_to: unknown };
    if (!docMatches(row.bill_to, null, keys)) continue;
    qLeg.push(buildQuotationListRow(row));
  }

  const plL = (plLinked ?? []).map((p) => buildPackingListRow(p as Parameters<typeof buildPackingListRow>[0]));
  const plLeg: PartyPackingListRow[] = [];
  for (const p of plLegacy ?? []) {
    const row = p as Parameters<typeof buildPackingListRow>[0] & { bill_to: unknown; ship_to: unknown };
    if (!docMatches(row.bill_to, row.ship_to, keys)) continue;
    plLeg.push(buildPackingListRow(row));
  }

  const dcL = (dcLinked ?? []).map((d) => buildDcListRow(d as Parameters<typeof buildDcListRow>[0]));
  const dcLeg: PartyDcListRow[] = [];
  for (const d of dcLegacy ?? []) {
    const row = d as Parameters<typeof buildDcListRow>[0] & { bill_to: unknown; ship_to: unknown };
    if (!docMatches(row.bill_to, row.ship_to, keys)) continue;
    dcLeg.push(buildDcListRow(row));
  }

  const poL = (poLinked ?? []).map((p) =>
    buildPurchaseOrderListRow(p as Parameters<typeof buildPurchaseOrderListRow>[0]),
  );
  const poLeg: PartyPurchaseOrderListRow[] = [];
  for (const p of poLegacy ?? []) {
    const row = p as Parameters<typeof buildPurchaseOrderListRow>[0] & { vendor_to: unknown };
    if (!docMatchesVendor(row.vendor_to, keys)) continue;
    poLeg.push(buildPurchaseOrderListRow(row));
  }

  return {
    quotation: mergeQuotationRows(qL, qLeg),
    packing_list: mergePackingRows(plL, plLeg),
    delivery_challan: mergeDcRows(dcL, dcLeg),
    purchase_order: mergePurchaseOrderRows(poL, poLeg),
  };
}

export async function loadPartyDocuments(
  organizationId: string,
  partyId: string,
): Promise<{
  quotation: PartyQuotationListRow[];
  packing_list: PartyPackingListRow[];
  delivery_challan: PartyDcListRow[];
  purchase_order: PartyPurchaseOrderListRow[];
}> {
  const supabase = await createClient();
  const keys = await getPartyMatchKeysFromDb(supabase, organizationId, partyId);
  if (!keys) {
    return { quotation: [], packing_list: [], delivery_challan: [], purchase_order: [] };
  }
  return loadPartyDocumentsWithKeys(supabase, organizationId, partyId, keys);
}

export async function partyHasRelatedDocuments(organizationId: string, partyId: string): Promise<boolean> {
  const supabase = await createClient();
  const keys = await getPartyMatchKeysFromDb(supabase, organizationId, partyId);
  if (!keys) return false;
  if (await partyHasRelatedGatePasses(supabase, organizationId, partyId, keys)) return true;
  const docs = await loadPartyDocumentsWithKeys(supabase, organizationId, partyId, keys);
  return (
    docs.quotation.length > 0 ||
    docs.packing_list.length > 0 ||
    docs.delivery_challan.length > 0 ||
    docs.purchase_order.length > 0
  );
}
