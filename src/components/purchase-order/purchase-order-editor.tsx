"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PartyFields, partyBillFromList, type PartyListRow } from "@/components/packing/party-fields";
import { useSavePartyFlags } from "@/components/packing/save-party-section";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import {
  computeAdditionalCharge,
  computeLineFromInputs,
  quotationTotalsWithAdditionalCharges,
} from "@/lib/quotation/compute";
import {
  isPresetQuotationUnit,
  isPresetTaxPercent,
  QUOTATION_UNIT_OPTIONS,
  QUOTATION_UNIT_OTHER,
  TAX_PERCENT_OTHER,
  TAX_PERCENT_PRESETS,
} from "@/lib/quotation/line-presets";
import type { QuotationLine } from "@/lib/quotation/types";
import { emptyParty, type PartySnapshot } from "@/lib/packing/types";
import { createPurchaseOrder, updatePurchaseOrder } from "@/app/(main)/purchase-orders/actions";
import {
  additionalChargeDraftFromSavedLabel,
  resolveAdditionalChargeLabel,
  type AdditionalChargeDraftRow,
} from "@/lib/quotation/additional-charges";
import { additionalChargesFromJson } from "@/lib/quotation/parse";
import {
  DELIVERY_PERIOD_OTHER,
  DELIVERY_PERIOD_STANDARD_OPTIONS,
  deliveryPeriodEditorStateFromSaved,
  formatDeliveryPeriodForSave,
} from "@/lib/quotation/delivery-period-options";
import {
  PAYMENT_TERM_OPTIONS,
  PAYMENT_TERM_OTHER,
  paymentTermEditorStateFromSaved,
} from "@/lib/quotation/payment-terms";
import {
  INCOTERMS_2020,
  INCOTERM_OTHER,
  deliveryIncoEditorStateFromSaved,
  formatDeliveryIncoForSave,
} from "@/lib/quotation/incoterms";
import { PurchaseOrderAdditionalChargesSection } from "@/components/purchase-order/purchase-order-additional-charges-section";
import { defaultQuotationValidUntilYmd } from "@/lib/quotation/dates";
import { purchaseOrderIssuedEditSummaryLines } from "@/lib/purchase-order/issued-edit-diff";
import { partySnapshotFromOrganization } from "@/lib/purchase-order/org-address";
import { PoOrgAddressBlock } from "@/components/purchase-order/po-org-address-block";
import { partySnapshotHasAddressContent } from "@/components/purchase-order/party-address-preview";
import type { OrgShipAddressRow } from "@/lib/org-ship-addresses/load";
import { shippingAddressCardTitle } from "@/lib/parties/address-option-labels";
import { addressStructuralEqual } from "@/lib/parties/snapshot";
import { confirmPartyChange } from "@/lib/parties/confirm-party-change";
import { errorMessage } from "@/lib/errors";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import type { PlanTier, Organization } from "@/types/database";
import {
  clampSeriesSlotValue,
  type DocumentNumberingCreateProps,
} from "@/lib/documents/document-numbering";
import { DocumentNumberSeriesCreateBlock } from "@/components/documents/document-number-series-create-block";
import {
  parsePackingListTemplateId,
  packingListTemplateOptionsForPlan,
} from "@/lib/packing/packing-list-templates";
import type { PackingListTemplateId } from "@/lib/packing/types";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { ItemDescriptionWithSavedSuggest } from "@/components/items/item-description-saved-suggest";
import { savedItemDetailsSubtitle } from "@/lib/items/saved-item-subtitle";

const TAX_DECIMAL_PLACES = 3;

function formatTaxPresetOptionLabel(p: number): string {
  if (p === 0) return "0.00 (exempt)";
  return p.toFixed(2);
}

/** Display string for custom tax field (up to 3 decimal places). */
function formatTaxDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function sanitizeTaxPercentInput(raw: string): string {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (s.startsWith(".")) s = `0${s}`;
  const dot = s.indexOf(".");
  if (dot === -1) return s.slice(0, 8);
  const intPart = s.slice(0, dot).replace(/\./g, "") || "0";
  let decPart = s.slice(dot + 1).replace(/\./g, "");
  decPart = decPart.slice(0, TAX_DECIMAL_PLACES);
  if (decPart.length === 0) return `${intPart}.`;
  return `${intPart}.${decPart}`;
}

/** Parse draft to number, or null if empty / incomplete (e.g. trailing '.'). */
function parseTaxDraftToNumber(draft: string): number | null {
  const t = draft.trim();
  if (t === "" || t === ".") return null;
  if (t.endsWith(".")) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

const QTY_DECIMAL_PLACES = 3;
const UNIT_PRICE_DECIMAL_PLACES = 4;

function sanitizeDecimalInput(raw: string, maxDecimals: number, maxIntLen = 12): string {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (s.startsWith(".")) s = `0${s}`;
  const dot = s.indexOf(".");
  if (dot === -1) return s.slice(0, maxIntLen);
  const intPart = s.slice(0, dot).replace(/\./g, "") || "0";
  let decPart = s.slice(dot + 1).replace(/\./g, "");
  decPart = decPart.slice(0, maxDecimals);
  if (decPart.length === 0) return `${intPart}.`;
  return `${intPart}.${decPart}`;
}

function formatQtyDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

function formatUnitPriceDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10000) / 10000;
  return String(r);
}

function parseQtyDraftToNumber(draft: string): number | null {
  const t = draft.trim();
  if (t === "" || t === ".") return null;
  if (t.endsWith(".")) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function parseUnitPriceDraftToNumber(draft: string): number | null {
  const t = draft.trim();
  if (t === "" || t === ".") return null;
  if (t.endsWith(".")) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

const field = "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";

type ShipToLoadKey = "custom" | "org_profile" | "slot_1" | "slot_2" | "slot_3";

function inferInitialShipToLoadKey(
  ship: PartySnapshot,
  orgProfile: PartySnapshot,
  orgShipAddresses: OrgShipAddressRow[],
): ShipToLoadKey {
  if (addressStructuralEqual(ship, orgProfile)) return "org_profile";
  for (const row of orgShipAddresses) {
    if (addressStructuralEqual(ship, row.snapshot)) {
      return `slot_${row.ship_slot}` as ShipToLoadKey;
    }
  }
  return "custom";
}

function shipToSnapshotForLoadKey(
  key: ShipToLoadKey,
  orgProfile: PartySnapshot,
  orgShipAddresses: OrgShipAddressRow[],
  fallback: PartySnapshot,
): PartySnapshot {
  if (key === "org_profile") return { ...orgProfile };
  if (key.startsWith("slot_")) {
    const slot = Number(key.replace("slot_", ""));
    const row = orgShipAddresses.find((s) => s.ship_slot === slot);
    if (row) return { ...row.snapshot };
  }
  return { ...fallback };
}

export function PurchaseOrderEditor({
  mode,
  purchaseOrderId,
  organization,
  defaultCurrency,
  documentDateMinYmd,
  documentDateMaxYmd,
  initial,
  parties,
  savedItems,
  plan,
  documentStatus = "draft",
  organizationCountryCode = "IN",
  billingCountryCode,
  numberingCreate,
  numberingDraft,
  initialNumberingSeriesSlot,
  existingDocumentNumber,
  orgShipAddresses = [],
}: {
  mode: "create" | "edit";
  purchaseOrderId?: string;
  organization: Pick<
    Organization,
    | "name"
    | "gstin"
    | "org_address_line1"
    | "org_address_line2"
    | "org_city"
    | "org_state"
    | "org_pin"
    | "org_country"
    | "country_code"
    | "org_mobile"
  >;
  defaultCurrency: string;
  /** Organization-calendar bounds for purchase order date (see document-date-backdate-policy). */
  documentDateMinYmd: string;
  documentDateMaxYmd: string;
  plan: PlanTier;
  /** Draft purchase orders allow changing the linked party; issued do not. */
  documentStatus?: "draft" | "issued";
  /** ISO country for default mobile ISD (company profile). */
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
  /** New draft: preview document number and optional multi-series picker. */
  numberingCreate?: DocumentNumberingCreateProps | null;
  /** Edit draft: same UI as create for series / preview. */
  numberingDraft?: DocumentNumberingCreateProps | null;
  /** Resolved slot for this draft (stored column or org default). */
  initialNumberingSeriesSlot?: number;
  /** Existing document number when editing a draft (fixes preview peek). */
  existingDocumentNumber?: string | null;
  /** Saved company warehouse / shipping addresses (slots 1–3). */
  orgShipAddresses?: OrgShipAddressRow[];
  savedItems: SavedItemRow[];
  initial?: {
    template?: string;
    document_date: string | null;
    currency: string;
    vendor_to?: unknown;
    bill_to?: unknown;
    ship_to?: unknown;
    lines: unknown;
    payment_term: string | null;
    delivery_inco_term: string | null;
    delivery_period: string | null;
    valid_until: string | null;
    terms_notes: string | null;
    notes: string | null;
    additional_charges?: unknown;
    party_id?: string | null;
  };
  parties: PartyListRow[];
}) {
  const router = useRouter();
  const partyPickerDisabled = documentStatus === "issued";
  const restrictDocumentBackdate = documentStatus !== "issued";
  const canPickTemplate = plan !== "free";
  const [template, setTemplate] = useState<PackingListTemplateId>(() =>
    parsePackingListTemplateId(initial?.template),
  );
  const templateOptions = useMemo(() => packingListTemplateOptionsForPlan(plan), [plan]);

  useEffect(() => {
    const allowed = templateOptions.map((o) => o.id);
    if (!allowed.includes(template)) setTemplate("basic");
  }, [template, templateOptions]);

  const [documentDate, setDocumentDate] = useState(
    (initial?.document_date ?? documentDateMaxYmd).toString().slice(0, 10),
  );
  const initialValidUntil =
    initial?.valid_until?.trim() ||
    defaultQuotationValidUntilYmd(
      (initial?.document_date ?? documentDateMaxYmd).slice(0, 10),
      documentDateMaxYmd.slice(0, 10),
    );
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const validUntilTouchedRef = useRef(Boolean(initial?.valid_until?.trim()));
  const [currency, setCurrency] = useState(
    (initial?.currency || defaultCurrency || "INR").toUpperCase().slice(0, 3),
  );
  const numberingUi =
    numberingCreate ?? (mode === "edit" && documentStatus === "draft" ? numberingDraft : null);
  const [seriesSlot, setSeriesSlot] = useState(() => {
    if (!numberingUi) return 1;
    if (mode === "edit" && documentStatus === "draft" && initialNumberingSeriesSlot != null) {
      return clampSeriesSlotValue(initialNumberingSeriesSlot, numberingUi.maxSlots);
    }
    return numberingUi.effectiveDefaultSlot;
  });
  const orgPartySnapshot = useMemo(() => partySnapshotFromOrganization(organization), [organization]);
  const [vendorTo, setVendorTo] = useState<PartySnapshot>(() =>
    initial?.vendor_to ? (initial.vendor_to as PartySnapshot) : emptyParty(organizationCountryCode),
  );
  const [billTo, setBillTo] = useState<PartySnapshot>(() =>
    initial?.bill_to ? (initial.bill_to as PartySnapshot) : orgPartySnapshot,
  );
  const [shipTo, setShipTo] = useState<PartySnapshot>(() =>
    initial?.ship_to ? (initial.ship_to as PartySnapshot) : orgPartySnapshot,
  );
  const [shipToSameAsBillTo, setShipToSameAsBillTo] = useState(() => {
    if (initial?.bill_to && initial?.ship_to) {
      const b = initial.bill_to as PartySnapshot;
      const s = initial.ship_to as PartySnapshot;
      return JSON.stringify(b) === JSON.stringify(s);
    }
    return true;
  });
  const [shipToLoadKey, setShipToLoadKey] = useState<ShipToLoadKey>(() => {
    if (initial?.ship_to) {
      return inferInitialShipToLoadKey(
        initial.ship_to as PartySnapshot,
        partySnapshotFromOrganization(organization),
        orgShipAddresses,
      );
    }
    return orgShipAddresses.length > 0 ? "slot_1" : "org_profile";
  });
  /** Bumped when user picks "Custom address" so the form opens empty and expanded. */
  const [customShipToSession, setCustomShipToSession] = useState(0);
  const [saveOrgShipAddress, setSaveOrgShipAddress] = useState(false);

  const seedLines = useMemo<QuotationLine[]>(() => {
    if (initial?.lines && Array.isArray(initial.lines) && initial.lines.length) {
      return (initial.lines as QuotationLine[]).map((l) =>
        computeLineFromInputs({
          description: l.description,
          make_service_provider: l.make_service_provider,
          model_part_no_description: l.model_part_no_description,
          hsn_sac: l.hsn_sac,
          unit: l.unit,
          qty: l.qty,
          unit_price: l.unit_price,
          tax_percent: l.tax_percent,
          item_preset_id: l.item_preset_id,
          save_as_item: l.save_as_item,
        }),
      );
    }
    return [
      computeLineFromInputs({
        description: "",
        make_service_provider: "",
        model_part_no_description: "",
        hsn_sac: "",
        unit: "Pcs",
        qty: 1,
        unit_price: 0,
        tax_percent: 0,
        save_as_item: true,
      }),
    ];
  }, [initial]);

  const [lines, setLines] = useState<QuotationLine[]>(() => seedLines);
  /** When true, tax % uses custom text field (no +0.001 hack on line.tax_percent). */
  const [lineTaxCustom, setLineTaxCustom] = useState<boolean[]>(() =>
    seedLines.map((l) => !isPresetTaxPercent(l.tax_percent)),
  );
  const [taxCustomDraft, setTaxCustomDraft] = useState<string[]>(() =>
    seedLines.map((l) => formatTaxDraftFromNumber(l.tax_percent)),
  );
  const [qtyDraft, setQtyDraft] = useState<string[]>(() =>
    seedLines.map((l) => formatQtyDraftFromNumber(l.qty)),
  );
  const [unitPriceDraft, setUnitPriceDraft] = useState<string[]>(() =>
    seedLines.map((l) => formatUnitPriceDraftFromNumber(l.unit_price)),
  );
  const [additionalChargeDrafts, setAdditionalChargeDrafts] = useState<AdditionalChargeDraftRow[]>(() => {
    if (initial?.additional_charges == null) return [];
    const parsed = additionalChargesFromJson(initial.additional_charges);
    return parsed.map((c) =>
      additionalChargeDraftFromSavedLabel(
        c.label,
        formatUnitPriceDraftFromNumber(c.amount),
        formatTaxDraftFromNumber(c.tax_percent),
      ),
    );
  });
  const [paymentTermPreset, setPaymentTermPreset] = useState(() =>
    paymentTermEditorStateFromSaved(initial?.payment_term).preset,
  );
  const [paymentTermCustom, setPaymentTermCustom] = useState(() =>
    paymentTermEditorStateFromSaved(initial?.payment_term).custom,
  );
  useEffect(() => {
    const next = paymentTermEditorStateFromSaved(initial?.payment_term);
    setPaymentTermPreset(next.preset);
    setPaymentTermCustom(next.custom);
  }, [initial?.payment_term]);
  const [incotermPreset, setIncotermPreset] = useState(() =>
    deliveryIncoEditorStateFromSaved(initial?.delivery_inco_term).preset,
  );
  const [incotermPlace, setIncotermPlace] = useState(() =>
    deliveryIncoEditorStateFromSaved(initial?.delivery_inco_term).place,
  );
  const [incotermCustom, setIncotermCustom] = useState(() =>
    deliveryIncoEditorStateFromSaved(initial?.delivery_inco_term).custom,
  );
  useEffect(() => {
    const next = deliveryIncoEditorStateFromSaved(initial?.delivery_inco_term);
    setIncotermPreset(next.preset);
    setIncotermPlace(next.place);
    setIncotermCustom(next.custom);
  }, [initial?.delivery_inco_term]);
  const [deliveryPeriodPreset, setDeliveryPeriodPreset] = useState(() =>
    deliveryPeriodEditorStateFromSaved(initial?.delivery_period).preset,
  );
  const [deliveryPeriodCustom, setDeliveryPeriodCustom] = useState(() =>
    deliveryPeriodEditorStateFromSaved(initial?.delivery_period).custom,
  );
  useEffect(() => {
    const next = deliveryPeriodEditorStateFromSaved(initial?.delivery_period);
    setDeliveryPeriodPreset(next.preset);
    setDeliveryPeriodCustom(next.custom);
  }, [initial?.delivery_period]);
  const [termsNotes, setTermsNotes] = useState(initial?.terms_notes ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [linkedPartyId, setLinkedPartyId] = useState<string | null>(() => initial?.party_id ?? null);
  const [billLoadedFromParty, setBillLoadedFromParty] = useState(() => Boolean(initial?.party_id));
  const vendorFromSavedParty = Boolean(
    linkedPartyId && (billLoadedFromParty || documentStatus === "issued"),
  );
  const vendorShowCompact =
    vendorFromSavedParty ||
    (documentStatus === "issued" && partySnapshotHasAddressContent(vendorTo));
  const vendorLockAddress = vendorFromSavedParty || documentStatus === "issued";
  const [billAddressLockVersion, setBillAddressLockVersion] = useState(0);
  const [savePartyFlags, savePartyUi] = useSavePartyFlags("bill_only", vendorTo, undefined, {
    partyLinkedId: linkedPartyId,
  });

  useEffect(() => {
    if (shipToSameAsBillTo) setShipTo(billTo);
  }, [billTo, shipToSameAsBillTo]);

  const billPartyAddressId = useMemo(() => {
    if (!linkedPartyId) return null;
    if (!billLoadedFromParty && documentStatus !== "issued") return null;
    return parties.find((p) => p.id === linkedPartyId)?.bill_address_id ?? null;
  }, [parties, linkedPartyId, billLoadedFromParty, documentStatus]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeLineForSave(l: QuotationLine): QuotationLine {
    return computeLineFromInputs({
      description: l.description.trim(),
      make_service_provider: l.make_service_provider.trim(),
      model_part_no_description: l.model_part_no_description.trim(),
      hsn_sac: l.hsn_sac.trim(),
      unit: l.unit.trim() || "Pcs",
      qty: l.qty,
      unit_price: l.unit_price,
      tax_percent: l.tax_percent,
      item_preset_id: l.item_preset_id,
      save_as_item: l.item_preset_id ? undefined : l.save_as_item,
    });
  }

  const issuedPurchaseOrderBaseline = useMemo(() => {
    if (mode !== "edit" || documentStatus !== "issued") return null;
    return {
      lines: seedLines.map((l) =>
        computeLineFromInputs({
          description: l.description.trim(),
          make_service_provider: l.make_service_provider.trim(),
          model_part_no_description: l.model_part_no_description.trim(),
          hsn_sac: l.hsn_sac.trim(),
          unit: l.unit.trim() || "Pcs",
          qty: l.qty,
          unit_price: l.unit_price,
          tax_percent: l.tax_percent,
          item_preset_id: l.item_preset_id,
          save_as_item: l.save_as_item,
        }),
      ),
      charges: additionalChargesFromJson(initial?.additional_charges ?? null)
        .map((c) => ({
          label: String(c.label ?? "").trim(),
          amount: Math.round(Number(c.amount) * 100) / 100,
          tax_percent: Math.round(Number(c.tax_percent) * 1000) / 1000,
        }))
        .filter((c) => c.label.length > 0 || c.amount > 0)
        .slice(0, 2),
    };
  }, [mode, documentStatus, seedLines, initial?.additional_charges]);

  function updateLine(i: number, patch: Partial<QuotationLine>) {
    setLines((prev) =>
      prev.map((row, j) => {
        if (j !== i) return row;
        const merged = { ...row, ...patch };
        return computeLineFromInputs({
          description: merged.description,
          make_service_provider: merged.make_service_provider,
          model_part_no_description: merged.model_part_no_description,
          hsn_sac: merged.hsn_sac,
          unit: merged.unit,
          qty: merged.qty,
          unit_price: merged.unit_price,
          tax_percent: merged.tax_percent,
          item_preset_id: merged.item_preset_id,
          save_as_item: merged.save_as_item,
        });
      }),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      computeLineFromInputs({
        description: "",
        make_service_provider: "",
        model_part_no_description: "",
        hsn_sac: "",
        unit: "Pcs",
        qty: 1,
        unit_price: 0,
        tax_percent: 0,
        save_as_item: true,
      }),
    ]);
    setLineTaxCustom((prev) => [...prev, false]);
    setTaxCustomDraft((prev) => [...prev, formatTaxDraftFromNumber(0)]);
    setQtyDraft((prev) => [...prev, formatQtyDraftFromNumber(1)]);
    setUnitPriceDraft((prev) => [...prev, formatUnitPriceDraftFromNumber(0)]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setLineTaxCustom((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setTaxCustomDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setQtyDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
    setUnitPriceDraft((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  /** Apply qty, unit price, and tax drafts so save matches the form (handles submit without blur). */
  function normalizeAdditionalChargesPayload(): {
    label: string;
    amount: number;
    tax_percent: number;
  }[] {
    return additionalChargeDrafts
      .map((d) => ({
        label: resolveAdditionalChargeLabel(d).trim(),
        amount: parseUnitPriceDraftToNumber(d.amountDraft.trim()) ?? 0,
        tax_percent: parseTaxDraftToNumber(d.taxDraft.trim()) ?? 0,
      }))
      .filter((c) => c.label.length > 0 || c.amount > 0)
      .slice(0, 2);
  }

  function linesWithFlushedDrafts(base: QuotationLine[]): QuotationLine[] {
    return base.map((l, i) => {
      const qRaw = (qtyDraft[i] ?? formatQtyDraftFromNumber(l.qty)).trim();
      const upRaw = (unitPriceDraft[i] ?? formatUnitPriceDraftFromNumber(l.unit_price)).trim();
      let qty = l.qty;
      let unit_price = l.unit_price;
      const qn = parseQtyDraftToNumber(qRaw);
      if (qn !== null) qty = qn;
      const upn = parseUnitPriceDraftToNumber(upRaw);
      if (upn !== null) unit_price = upn;

      let tax_percent = l.tax_percent;
      if (lineTaxCustom[i]) {
        const d = (taxCustomDraft[i] ?? formatTaxDraftFromNumber(l.tax_percent)).trim();
        if (d === "" || d === ".") {
          tax_percent = 0;
        } else {
          const tn = parseTaxDraftToNumber(d);
          if (tn !== null) tax_percent = tn;
        }
      }

      return computeLineFromInputs({
        description: l.description,
        make_service_provider: l.make_service_provider,
        model_part_no_description: l.model_part_no_description,
        hsn_sac: l.hsn_sac,
        unit: l.unit,
        qty,
        unit_price,
        tax_percent,
        item_preset_id: l.item_preset_id,
        save_as_item: l.save_as_item,
      });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (paymentTermPreset === "") {
      setError("Select a payment term.");
      return;
    }
    if (paymentTermPreset === PAYMENT_TERM_OTHER && !paymentTermCustom.trim()) {
      setError("Enter the payment terms when Others is selected.");
      return;
    }
    const paymentTermFinal =
      paymentTermPreset === PAYMENT_TERM_OTHER ? paymentTermCustom.trim() : paymentTermPreset;
    if (incotermPreset === "") {
      setError("Select an Incoterm rule or Others.");
      return;
    }
    if (incotermPreset === INCOTERM_OTHER) {
      if (!incotermCustom.trim()) {
        setError("Enter the delivery / Incoterm wording when Others is selected.");
        return;
      }
    } else if (!incotermPlace.trim()) {
      setError("Enter the place of delivery (e.g. factory, city, or port).");
      return;
    }
    const deliveryIncoFinal = formatDeliveryIncoForSave(
      incotermPreset,
      incotermPlace,
      incotermCustom,
    );
    if (!deliveryIncoFinal) {
      setError("Delivery / Incoterm is required.");
      return;
    }
    const deliveryPeriodFinal = formatDeliveryPeriodForSave(deliveryPeriodPreset, deliveryPeriodCustom);
    if (!deliveryPeriodFinal.trim()) {
      setError("Choose a delivery period or enter one under Other.");
      return;
    }
    if (!validUntil.trim()) {
      setError("Delivery by date is required.");
      return;
    }
    if (!vendorTo.name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (!billTo.name.trim()) {
      setError("Bill to name is required.");
      return;
    }
    const shipToFinal = shipToSameAsBillTo ? billTo : shipTo;
    if (!shipToFinal.name.trim()) {
      setError("Ship to name is required.");
      return;
    }
    if (
      documentStatus !== "issued" &&
      savePartyFlags.save_bill &&
      !savePartyFlags.party_display_name.trim()
    ) {
      setError("Enter a party name to save the vendor address.");
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      setError("Each line needs a product or service name.");
      return;
    }
    if (linesWithFlushedDrafts(lines).some((l) => !l.unit?.trim())) {
      setError("Each line needs a unit.");
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const qd = (qtyDraft[i] ?? formatQtyDraftFromNumber(lines[i].qty)).trim();
      const upd = (unitPriceDraft[i] ?? formatUnitPriceDraftFromNumber(lines[i].unit_price)).trim();
      if (qd === "" || qd === ".") {
        setError(`Line ${i + 1}: Qty is required.`);
        return;
      }
      if (upd === "" || upd === ".") {
        setError(`Line ${i + 1}: Unit price is required.`);
        return;
      }
      const qn = parseQtyDraftToNumber(qd);
      const upn = parseUnitPriceDraftToNumber(upd);
      if (qn === null || qn <= 0) {
        setError(`Line ${i + 1}: Enter a valid quantity greater than zero.`);
        return;
      }
      if (upn === null || upn < 0) {
        setError(`Line ${i + 1}: Enter a valid unit price (0 or greater).`);
        return;
      }
    }

    if (mode === "edit" && documentStatus === "issued" && issuedPurchaseOrderBaseline) {
      const curLines = linesWithFlushedDrafts(lines).map((l) => normalizeLineForSave(l));
      const curCharges = normalizeAdditionalChargesPayload();
      const bullets = purchaseOrderIssuedEditSummaryLines({
        currency,
        baselineLines: issuedPurchaseOrderBaseline.lines,
        baselineCharges: issuedPurchaseOrderBaseline.charges,
        currentLines: curLines,
        currentCharges: curCharges,
      });
      if (bullets.length > 0) {
        const msg = `Save changes to this issued purchase order?\n\n${bullets.map((b) => `• ${b}`).join("\n")}`;
        if (!window.confirm(msg)) return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        document_date: documentDate || null,
        currency,
        vendor_to: vendorTo,
        bill_to: billTo,
        ship_to: shipToFinal,
        lines: linesWithFlushedDrafts(lines).map((l) => normalizeLineForSave(l)),
        additional_charges: normalizeAdditionalChargesPayload(),
        payment_term: paymentTermFinal,
        delivery_inco_term: deliveryIncoFinal,
        delivery_period: deliveryPeriodFinal,
        valid_until: validUntil,
        terms_notes: termsNotes.trim() ? termsNotes : undefined,
        notes: notes.trim() ? notes : undefined,
        party_save:
          documentStatus === "issued"
            ? undefined
            : savePartyFlags.save_bill && savePartyFlags.party_display_name.trim()
              ? {
                  party_display_name: savePartyFlags.party_display_name,
                  save_bill: true,
                }
              : undefined,
        party_id: linkedPartyId,
        template,
        append_org_ship_address:
          documentStatus !== "issued" &&
          !shipToSameAsBillTo &&
          shipToLoadKey === "custom" &&
          saveOrgShipAddress
            ? true
            : undefined,
      };
      if (mode === "create") {
        const res = await createPurchaseOrder({
          ...payload,
          series_slot: numberingCreate?.multiSeriesEnabled ? seriesSlot : null,
        });
        router.replace(`/purchase-orders/${res.id}`);
      } else if (purchaseOrderId) {
        const res = await updatePurchaseOrder(purchaseOrderId, {
          ...payload,
          series_slot:
            documentStatus === "draft" && numberingDraft?.multiSeriesEnabled ? seriesSlot : undefined,
        });
        setLinkedPartyId(res.party_id);
        router.replace(`/purchase-orders/${purchaseOrderId}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save"));
    } finally {
      setLoading(false);
    }
  }

  const flushedForTotals = linesWithFlushedDrafts(lines);
  const chargeRowsComputed = additionalChargeDrafts.map((d) =>
    computeAdditionalCharge({
      label: resolveAdditionalChargeLabel(d),
      amount: parseUnitPriceDraftToNumber(d.amountDraft.trim()) ?? 0,
      tax_percent: parseTaxDraftToNumber(d.taxDraft.trim()) ?? 0,
    }),
  );
  const quotationCombined = quotationTotalsWithAdditionalCharges(flushedForTotals, chargeRowsComputed);

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Purchase order date</span>
          <input
            type="date"
            required
            min={restrictDocumentBackdate ? documentDateMinYmd.slice(0, 10) : undefined}
            max={documentDateMaxYmd.slice(0, 10)}
            value={documentDate}
            onChange={(e) => {
              const v = e.target.value;
              setDocumentDate(v);
              setValidUntil((prev) => {
                const next = defaultQuotationValidUntilYmd(v, documentDateMaxYmd.slice(0, 10));
                if (!validUntilTouchedRef.current) return next;
                if (prev < v) return next;
                return prev;
              });
            }}
            className={field + " w-full max-w-full sm:max-w-[200px]"}
          />
        </label>
        {numberingUi ? (
          <DocumentNumberSeriesCreateBlock
            numbering={numberingUi}
            documentDateYmd={documentDate}
            seriesSlot={seriesSlot}
            onSeriesSlotChange={setSeriesSlot}
            existingDocumentNumber={mode === "edit" ? existingDocumentNumber : null}
            committedSeriesSlot={initialNumberingSeriesSlot}
          />
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={field + " w-full max-w-full sm:max-w-[200px]"}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Print / PDF template</span>
          <select
            disabled={!canPickTemplate}
            value={template}
            onChange={(e) => setTemplate(e.target.value as PackingListTemplateId)}
            className={field + " w-full max-w-full sm:max-w-[280px] disabled:opacity-60"}
          >
            {templateOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!canPickTemplate ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <p>Free plan uses the Basic template. Upgrade for template choice.</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <PartyFields
          title="Purchase order to (vendor)"
          value={vendorTo}
          onChange={setVendorTo}
          parties={parties}
          pickTarget="bill"
          dense={!vendorShowCompact}
          compactAddressPreview={vendorShowCompact}
          onReleasePartyLink={() => {
            setLinkedPartyId(null);
            setBillLoadedFromParty(false);
          }}
          lockAddressFields={vendorLockAddress}
          partyAddressRowId={billPartyAddressId}
          addressLockVersion={billAddressLockVersion}
          selectedLoadPartyId={
            linkedPartyId && (documentStatus === "issued" || billLoadedFromParty) ? linkedPartyId : null
          }
          partyPickerDisabled={partyPickerDisabled}
          addressLockHint={
            documentStatus === "issued"
              ? "This purchase order is issued — vendor name, address, and GSTIN cannot be changed. You may still update contact person and mobile when needed."
              : vendorShowCompact
                ? "Choose “—” on Load party to enter a new vendor manually."
                : null
          }
          organizationCountryCode={organizationCountryCode}
          billingCountryCode={billingCountryCode}
          onPickParty={(id) => {
            if (id == null) {
              setVendorTo(emptyParty(organizationCountryCode));
              setLinkedPartyId(null);
              setBillLoadedFromParty(false);
              setBillAddressLockVersion((v) => v + 1);
              return;
            }
            if (
              !partyPickerDisabled &&
              billLoadedFromParty &&
              linkedPartyId &&
              linkedPartyId !== id &&
              !confirmPartyChange(parties, linkedPartyId, id)
            ) {
              return;
            }
            const row = parties.find((p) => p.id === id);
            if (row) {
              setVendorTo(partyBillFromList(row));
              setLinkedPartyId(id);
              setBillLoadedFromParty(true);
              setBillAddressLockVersion((v) => v + 1);
            }
          }}
        />

        {documentStatus !== "issued" ? savePartyUi : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Company addresses on this PO</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shipToSameAsBillTo}
            disabled={documentStatus === "issued"}
            onChange={(e) => {
              const checked = e.target.checked;
              setShipToSameAsBillTo(checked);
              if (checked) {
                setShipTo(billTo);
              } else {
                setShipTo(
                  shipToSnapshotForLoadKey(shipToLoadKey, orgPartySnapshot, orgShipAddresses, billTo),
                );
              }
            }}
          />
          Ship to same as bill to
        </label>
        <div className={shipToSameAsBillTo ? "space-y-3" : "grid gap-4 lg:grid-cols-2"}>
          <PoOrgAddressBlock
            title="Bill to"
            loadDefaultLabel="Load default billing address"
            value={billTo}
            onChange={setBillTo}
            defaultSnapshot={orgPartySnapshot}
            organizationCountryCode={organizationCountryCode}
            billingCountryCode={billingCountryCode}
            readOnly={documentStatus === "issued"}
          />
          {!shipToSameAsBillTo ? (
            <div className="space-y-2">
              {documentStatus !== "issued" ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[var(--muted)]">Load ship to address</span>
                  <select
                    className={field}
                    value={shipToLoadKey}
                    onChange={(e) => {
                      const key = e.target.value as ShipToLoadKey;
                      setShipToLoadKey(key);
                      setSaveOrgShipAddress(false);
                      if (key === "custom") {
                        setShipTo(emptyParty(organizationCountryCode));
                        setCustomShipToSession((n) => n + 1);
                      } else {
                        setShipTo(
                          shipToSnapshotForLoadKey(key, orgPartySnapshot, orgShipAddresses, shipTo),
                        );
                      }
                    }}
                  >
                    <option value="org_profile">Company profile (communication address)</option>
                    {orgShipAddresses.map((row) => (
                      <option key={row.id} value={`slot_${row.ship_slot}`}>
                        {row.label?.trim()
                          ? `${shippingAddressCardTitle(row.ship_slot)} — ${row.label.trim()}`
                          : shippingAddressCardTitle(row.ship_slot)}
                      </option>
                    ))}
                    <option value="custom">Custom address for this PO</option>
                  </select>
                </label>
              ) : null}
              <PoOrgAddressBlock
                key={
                  shipToLoadKey === "custom"
                    ? `custom-${customShipToSession}`
                    : shipToLoadKey
                }
                title="Ship to"
                loadDefaultLabel="Load default shipping address"
                value={shipTo}
                onChange={(next) => {
                  setShipTo(next);
                  setShipToLoadKey("custom");
                  setSaveOrgShipAddress(false);
                }}
                defaultSnapshot={orgPartySnapshot}
                organizationCountryCode={organizationCountryCode}
                billingCountryCode={billingCountryCode}
                readOnly={documentStatus === "issued"}
                initialExpanded={shipToLoadKey === "custom" && customShipToSession > 0}
                showContactFields={shipToLoadKey === "custom"}
              />
              {documentStatus !== "issued" &&
              shipToLoadKey === "custom" &&
              partySnapshotHasAddressContent(shipTo) ? (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={saveOrgShipAddress}
                    onChange={(e) => setSaveOrgShipAddress(e.target.checked)}
                  />
                  <span className="text-[var(--muted)]">
                    Save as company warehouse / shipping address (uses the next free slot under Company
                    profile)
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Line items</h3>
        <p className="text-xs text-[var(--muted)] lg:hidden">Swipe sideways to see all columns.</p>
        <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 lg:touch-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-2 w-8">#</th>
                <th className="py-2 pr-2 min-w-[260px]">Product / Service</th>
                <th className="py-2 pr-2 w-24">HSN/SAC</th>
                <th className="py-2 pr-2 min-w-[148px]">Unit</th>
                <th className="py-2 pr-2 min-w-[88px]">
                  Qty <span className="text-[var(--foreground)]">*</span>
                </th>
                <th className="py-2 pr-2 min-w-[100px]">
                  Unit price <span className="text-[var(--foreground)]">*</span>
                </th>
                <th className="py-2 pr-2 min-w-[120px]">Tax %</th>
                <th className="py-2 pr-2 w-24">Taxable</th>
                <th className="py-2 pr-2 w-24">Tax amt</th>
                <th className="py-2 pr-2 w-24">Total</th>
                <th className="py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const locked = Boolean(line.item_preset_id);
                const isNewItemLine = !line.item_preset_id;
                const lockCls = locked ? " cursor-not-allowed bg-[var(--muted)]/10 opacity-90" : "";
                const catalogSubtitle = locked
                  ? savedItemDetailsSubtitle(line, { omitHsn: true })
                  : null;
                return (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-2 align-top text-[var(--muted)]">{i + 1}</td>
                  <td className="py-2 pr-2 align-top">
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-[var(--foreground)]">
                          Product / service name *
                        </label>
                        <div className="flex gap-1">
                          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            {locked ? (
                              <>
                                <input
                                  readOnly
                                  className={field + lockCls + " w-full"}
                                  value={line.description}
                                  placeholder="e.g. Product or service title"
                                  required
                                />
                                {catalogSubtitle ? (
                                  <p className="text-[11px] leading-snug text-[var(--muted)]">
                                    {catalogSubtitle}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <ItemDescriptionWithSavedSuggest
                                required
                                value={line.description}
                                onChange={(v) => updateLine(i, { description: v })}
                                savedItems={savedItems}
                                inputClassName={field}
                                placeholder="Type to search saved items or enter a new name"
                                onPickSaved={(it) =>
                                  updateLine(i, {
                                    description: it.description,
                                    unit: it.default_unit || "Pcs",
                                    make_service_provider: it.make_service_provider,
                                    model_part_no_description: it.model_part_no_description,
                                    hsn_sac: it.hsn_sac,
                                    item_preset_id: it.id,
                                    save_as_item: undefined,
                                  })
                                }
                              />
                            )}
                          </div>
                          {locked ? (
                            <button
                              type="button"
                              title="Unlink saved item"
                              aria-label="Unlink saved item"
                              className="h-[34px] w-8 shrink-0 self-start rounded-md border border-[var(--border)] bg-[var(--card)] text-base leading-none text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                              onClick={() =>
                                updateLine(i, {
                                  description: "",
                                  make_service_provider: "",
                                  model_part_no_description: "",
                                  hsn_sac: "",
                                  unit: "Pcs",
                                  item_preset_id: null,
                                  save_as_item: true,
                                })
                              }
                            >
                              -
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {!locked ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] leading-tight text-[var(--muted)]">
                              Model / part no / description <span className="font-normal">(optional)</span>
                            </label>
                            <input
                              className={field + " text-sm"}
                              value={line.model_part_no_description}
                              onChange={(e) => updateLine(i, { model_part_no_description: e.target.value })}
                              placeholder="Model, part no., detail"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] leading-tight text-[var(--muted)]">
                              Make / service provider <span className="font-normal">(optional)</span>
                            </label>
                            <input
                              className={field + " text-sm"}
                              value={line.make_service_provider}
                              onChange={(e) => updateLine(i, { make_service_provider: e.target.value })}
                              placeholder="Brand or service provider"
                            />
                          </div>
                        </div>
                      ) : null}
                      {isNewItemLine ? (
                        <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <input
                            type="checkbox"
                            checked={line.save_as_item !== false}
                            onChange={(e) => updateLine(i, { save_as_item: e.target.checked })}
                          />
                          Save as item in database when saving this purchase order
                        </label>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <input
                      readOnly={locked}
                      className={field + lockCls}
                      value={line.hsn_sac}
                      onChange={(e) => updateLine(i, { hsn_sac: e.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <div className="flex min-w-[132px] flex-col gap-1">
                      <select
                        disabled={locked}
                        className={field + lockCls}
                        value={isPresetQuotationUnit(line.unit) ? line.unit : QUOTATION_UNIT_OTHER}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === QUOTATION_UNIT_OTHER) {
                            updateLine(i, {
                              unit: isPresetQuotationUnit(line.unit) ? "" : line.unit,
                            });
                          } else {
                            updateLine(i, { unit: v });
                          }
                        }}
                      >
                        {QUOTATION_UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value={QUOTATION_UNIT_OTHER}>Other…</option>
                      </select>
                      {!isPresetQuotationUnit(line.unit) ? (
                        <input
                          readOnly={locked}
                          className={field + " text-xs" + lockCls}
                          value={line.unit}
                          onChange={(e) => updateLine(i, { unit: e.target.value })}
                          placeholder="Type unit"
                          aria-label="Custom unit"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={field + " min-w-[80px] tabular-nums"}
                      value={qtyDraft[i] ?? formatQtyDraftFromNumber(line.qty)}
                      onChange={(e) => {
                        const next = sanitizeDecimalInput(e.target.value, QTY_DECIMAL_PLACES);
                        setQtyDraft((prev) => {
                          const arr = [...prev];
                          arr[i] = next;
                          return arr;
                        });
                        const parsed = parseQtyDraftToNumber(next);
                        if (parsed === null) return;
                        updateLine(i, { qty: parsed });
                      }}
                      onBlur={() => {
                        const d = qtyDraft[i] ?? "";
                        const t = d.trim();
                        if (t === "" || t === ".") {
                          updateLine(i, { qty: 0 });
                          setQtyDraft((prev) => {
                            const arr = [...prev];
                            arr[i] = "";
                            return arr;
                          });
                          return;
                        }
                        const parsed = parseQtyDraftToNumber(d);
                        if (parsed !== null) {
                          updateLine(i, { qty: parsed });
                          setQtyDraft((prev) => {
                            const arr = [...prev];
                            arr[i] = formatQtyDraftFromNumber(parsed);
                            return arr;
                          });
                        }
                      }}
                      placeholder="0"
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={field + " min-w-[88px] tabular-nums"}
                      value={unitPriceDraft[i] ?? formatUnitPriceDraftFromNumber(line.unit_price)}
                      onChange={(e) => {
                        const next = sanitizeDecimalInput(e.target.value, UNIT_PRICE_DECIMAL_PLACES);
                        setUnitPriceDraft((prev) => {
                          const arr = [...prev];
                          arr[i] = next;
                          return arr;
                        });
                        const parsed = parseUnitPriceDraftToNumber(next);
                        if (parsed === null) return;
                        updateLine(i, { unit_price: parsed });
                      }}
                      onBlur={() => {
                        const d = unitPriceDraft[i] ?? "";
                        const t = d.trim();
                        if (t === "" || t === ".") {
                          updateLine(i, { unit_price: 0 });
                          setUnitPriceDraft((prev) => {
                            const arr = [...prev];
                            arr[i] = "";
                            return arr;
                          });
                          return;
                        }
                        const parsed = parseUnitPriceDraftToNumber(d);
                        if (parsed !== null) {
                          updateLine(i, { unit_price: parsed });
                          setUnitPriceDraft((prev) => {
                            const arr = [...prev];
                            arr[i] = formatUnitPriceDraftFromNumber(parsed);
                            return arr;
                          });
                        }
                      }}
                      placeholder="0"
                      aria-label="Unit price"
                    />
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <div className="flex min-w-[108px] flex-col gap-1">
                      <select
                        className={field}
                        value={
                          lineTaxCustom[i] || !isPresetTaxPercent(line.tax_percent)
                            ? TAX_PERCENT_OTHER
                            : String(line.tax_percent)
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === TAX_PERCENT_OTHER) {
                            setLineTaxCustom((prev) => {
                              const next = [...prev];
                              next[i] = true;
                              return next;
                            });
                            setTaxCustomDraft((prev) => {
                              const next = [...prev];
                              next[i] = "";
                              return next;
                            });
                            updateLine(i, { tax_percent: 0 });
                            return;
                          }
                          setLineTaxCustom((prev) => {
                            const next = [...prev];
                            next[i] = false;
                            return next;
                          });
                          updateLine(i, { tax_percent: Number(v) });
                        }}
                      >
                        {TAX_PERCENT_PRESETS.map((p) => (
                          <option key={p} value={String(p)}>
                            {formatTaxPresetOptionLabel(p)}
                          </option>
                        ))}
                        <option value={TAX_PERCENT_OTHER}>Other…</option>
                      </select>
                      {lineTaxCustom[i] || !isPresetTaxPercent(line.tax_percent) ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          className={field + " text-xs"}
                          value={taxCustomDraft[i] ?? formatTaxDraftFromNumber(line.tax_percent)}
                          onChange={(e) => {
                            const next = sanitizeTaxPercentInput(e.target.value);
                            setTaxCustomDraft((prev) => {
                              const arr = [...prev];
                              arr[i] = next;
                              return arr;
                            });
                            const parsed = parseTaxDraftToNumber(next);
                            if (parsed === null) return;
                            updateLine(i, { tax_percent: parsed });
                          }}
                          onBlur={() => {
                            const d = taxCustomDraft[i] ?? "";
                            const t = d.trim();
                            if (t === "" || t === ".") {
                              updateLine(i, { tax_percent: 0 });
                              setTaxCustomDraft((prev) => {
                                const arr = [...prev];
                                arr[i] = "0";
                                return arr;
                              });
                              return;
                            }
                            const parsed = parseTaxDraftToNumber(d);
                            if (parsed !== null) {
                              updateLine(i, { tax_percent: parsed });
                              setTaxCustomDraft((prev) => {
                                const arr = [...prev];
                                arr[i] = formatTaxDraftFromNumber(parsed);
                                return arr;
                              });
                            }
                          }}
                          placeholder="e.g. 12.375"
                          aria-label="Custom tax percent"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 pr-2 align-top text-right tabular-nums text-[var(--muted)]">{line.taxable_value.toFixed(2)}</td>
                  <td className="py-2 pr-2 align-top text-right tabular-nums text-[var(--muted)]">{line.tax_amount.toFixed(2)}</td>
                  <td className="py-2 pr-2 align-top text-right font-medium tabular-nums">{line.line_total.toFixed(2)}</td>
                  <td className="py-2 align-top text-right">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        className="min-h-10 min-w-[3.25rem] px-2 text-sm text-red-600 hover:underline touch-manipulation"
                        onClick={() => removeLine(i)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addLine}
          className="flex min-h-11 items-center text-sm text-sky-600 hover:underline touch-manipulation"
        >
          + Add line
        </button>

        <PurchaseOrderAdditionalChargesSection
          currency={currency}
          drafts={additionalChargeDrafts}
          setDrafts={setAdditionalChargeDrafts}
          quotationCombined={quotationCombined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--foreground)] font-medium">Payment term *</span>
          <select
            required
            className={field}
            value={paymentTermPreset}
            onChange={(e) => setPaymentTermPreset(e.target.value)}
            aria-label="Payment term"
          >
            <option value="">Select payment term…</option>
            {PAYMENT_TERM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={PAYMENT_TERM_OTHER}>Others</option>
          </select>
          {paymentTermPreset === PAYMENT_TERM_OTHER ? (
            <textarea
              rows={2}
              className={field + " mt-2"}
              value={paymentTermCustom}
              onChange={(e) => setPaymentTermCustom(e.target.value)}
              placeholder="Describe payment terms"
              aria-label="Custom payment terms"
            />
          ) : null}
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--foreground)] font-medium">Incoterms 2020 & place of delivery *</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <select
              required
              className={field + " sm:min-w-[200px] sm:flex-1"}
              value={incotermPreset}
              onChange={(e) => setIncotermPreset(e.target.value)}
              aria-label="Incoterm rule"
            >
              <option value="">Select Incoterm…</option>
              {INCOTERMS_2020.map(({ code, label }) => (
                <option key={code} value={code}>
                  {code} — {label}
                </option>
              ))}
              <option value={INCOTERM_OTHER}>Others (non-standard)</option>
            </select>
            <input
              type="text"
              className={field + " sm:flex-1"}
              value={incotermPlace}
              onChange={(e) => setIncotermPlace(e.target.value)}
              placeholder="Place (e.g. factory, New Delhi, Mumbai port)"
              disabled={incotermPreset === "" || incotermPreset === INCOTERM_OTHER}
              aria-label="Place of delivery"
            />
          </div>
          {incotermPreset === INCOTERM_OTHER ? (
            <textarea
              rows={2}
              className={field + " mt-1"}
              value={incotermCustom}
              onChange={(e) => setIncotermCustom(e.target.value)}
              placeholder="Full delivery / Incoterm wording"
              aria-label="Custom delivery terms"
            />
          ) : incotermPreset ? (
            <span className="text-xs text-[var(--muted)]">
              Printed as: {formatDeliveryIncoForSave(incotermPreset, incotermPlace, "") || "…"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--foreground)] font-medium">Delivery period *</span>
          <select
            required
            className={field}
            value={deliveryPeriodPreset}
            onChange={(e) => {
              const v = e.target.value;
              setDeliveryPeriodPreset(v);
              if (v !== DELIVERY_PERIOD_OTHER) setDeliveryPeriodCustom("");
            }}
            aria-label="Delivery period"
          >
            <option value="">Select…</option>
            {DELIVERY_PERIOD_STANDARD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={DELIVERY_PERIOD_OTHER}>Other (specify)</option>
          </select>
          {deliveryPeriodPreset === DELIVERY_PERIOD_OTHER ? (
            <textarea
              rows={2}
              className={field + " mt-1"}
              value={deliveryPeriodCustom}
              onChange={(e) => setDeliveryPeriodCustom(e.target.value)}
              placeholder="e.g. 3 weeks from approved drawing, ex-stock, phased delivery…"
              aria-label="Custom delivery period"
            />
          ) : null}
          <span className="text-xs text-[var(--muted)]">
            Standard options print as shown. Choose Other for any wording not listed.
          </span>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--foreground)] font-medium">Delivery by *</span>
          <input
            type="date"
            required
            min={documentDate.slice(0, 10)}
            value={validUntil}
            onChange={(e) => {
              validUntilTouchedRef.current = true;
              setValidUntil(e.target.value);
            }}
            className={field + " w-full max-w-full sm:max-w-[200px]"}
          />
          <span className="text-xs text-[var(--muted)]">
            Defaults to 7 days after the purchase order date or 7 days from today (organization calendar), whichever is later.
            Change if you need a different delivery date.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Additional terms (optional)</span>
        <textarea rows={3} className={field} value={termsNotes} onChange={(e) => setTermsNotes(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Any special note (optional) to be printed on purchase order</span>
        <textarea rows={2} className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={mode === "edit" && purchaseOrderId ? `/purchase-orders/${purchaseOrderId}` : "/purchase-orders"}
          className="flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:min-h-0"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className={primaryButtonMd + " min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"}
        >
          {loading ? "Saving…" : mode === "create" ? "Create draft" : "Save"}
        </button>
      </div>
    </form>
  );
}
