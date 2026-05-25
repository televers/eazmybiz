"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { resolvePartyShipAddressId } from "@/lib/parties/resolve-ship-address-id";
import {
  createDeliveryChallan,
  updateDeliveryChallan,
  type DeliveryChallanAdditionalChargeInput,
} from "@/app/(main)/delivery-challans/actions";
import type { DeliveryChallanLine } from "@/lib/delivery-challan/types";
import {
  computeAdditionalCharge,
  computeDcLineFromInputs,
  dcTotalsWithAdditionalCharges,
  normalizeDcLineForSave,
} from "@/lib/delivery-challan/compute";
import { dcLinesFromJson, emptyDcLine } from "@/lib/delivery-challan/parse";
import { emptyParty, type PartySnapshot } from "@/lib/packing/types";
import {
  loadPartySelectClassName,
  PartyFields,
  partyBillFromList,
  partyShipFromList,
  type PartyListRow,
} from "@/components/packing/party-fields";
import { useSavePartyFlags } from "@/components/packing/save-party-section";
import { confirmPartyChange } from "@/lib/parties/confirm-party-change";
import { addressStructuralEqual } from "@/lib/parties/snapshot";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { ItemDescriptionWithSavedSuggest } from "@/components/items/item-description-saved-suggest";
import { DocumentLineMoveControls } from "@/components/documents/document-line-move-controls";
import { moveArrayItem } from "@/lib/ui/move-array-item";
import { savedItemDetailsSubtitle } from "@/lib/items/saved-item-subtitle";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import {
  isPresetQuotationUnit,
  isPresetTaxPercent,
  QUOTATION_UNIT_OPTIONS,
  QUOTATION_UNIT_OTHER,
  TAX_PERCENT_OTHER,
  TAX_PERCENT_PRESETS,
} from "@/lib/quotation/line-presets";
import {
  additionalChargeDraftFromSavedLabel,
  resolveAdditionalChargeLabel,
  type AdditionalChargeDraftRow,
} from "@/lib/quotation/additional-charges";
import { additionalChargesFromJson } from "@/lib/quotation/parse";
import { QuotationAdditionalChargesSection } from "@/components/quotation/quotation-additional-charges-section";
import { errorMessage } from "@/lib/errors";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import type { PlanTier } from "@/types/database";
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

const TAX_DECIMAL_PLACES = 3;

function formatTaxPresetOptionLabel(p: number): string {
  if (p === 0) return "0.00 (exempt)";
  return p.toFixed(2);
}

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

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";

export function DeliveryChallanEditor({
  mode,
  challanId,
  listStatus,
  documentDateMinYmd,
  documentDateMaxYmd,
  defaultCurrency,
  initial,
  parties,
  savedItems,
  plan,
  organizationCountryCode = "IN",
  billingCountryCode,
  numberingCreate,
  numberingDraft,
  initialNumberingSeriesSlot,
}: {
  mode: "create" | "edit";
  challanId?: string;
  listStatus?: "draft" | "issued";
  /** Earliest selectable document date for drafts (organization calendar). */
  documentDateMinYmd: string;
  /** Latest selectable document date (organization “today”) — drafts and issued cannot pick a future date. */
  documentDateMaxYmd: string;
  defaultCurrency: string;
  plan: PlanTier;
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
  initial?: {
    template?: string;
    document_date: string | null;
    currency?: string | null;
    bill_to: unknown;
    ship_to: unknown;
    line_items: unknown;
    additional_charges?: unknown;
    po_no: string | null;
    po_date: string | null;
    lr_docket_no: string | null;
    eway_bill_no: string | null;
    transport_name: string | null;
    transporter_id: string | null;
    vehicle_no: string | null;
    notes: string | null;
    party_id?: string | null;
  };
  parties: PartyListRow[];
  savedItems: SavedItemRow[];
  numberingCreate?: DocumentNumberingCreateProps | null;
  numberingDraft?: DocumentNumberingCreateProps | null;
  initialNumberingSeriesSlot?: number;
}) {
  const router = useRouter();
  const restrictDocumentBackdate = listStatus !== "issued";
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
  const numberingUi =
    numberingCreate ?? (mode === "edit" && listStatus === "draft" ? numberingDraft : null);
  const [seriesSlot, setSeriesSlot] = useState(() => {
    if (!numberingUi) return 1;
    if (mode === "edit" && listStatus === "draft" && initialNumberingSeriesSlot != null) {
      return clampSeriesSlotValue(initialNumberingSeriesSlot, numberingUi.maxSlots);
    }
    return numberingUi.effectiveDefaultSlot;
  });
  const [currency, setCurrency] = useState(
    (initial?.currency || defaultCurrency || "INR").toString().toUpperCase().slice(0, 3),
  );
  const [billTo, setBillTo] = useState<PartySnapshot>(() =>
    initial?.bill_to ? (initial.bill_to as PartySnapshot) : emptyParty(organizationCountryCode),
  );
  const [shipTo, setShipTo] = useState<PartySnapshot>(() =>
    initial?.ship_to ? (initial.ship_to as PartySnapshot) : emptyParty(organizationCountryCode),
  );

  const seedLines = useMemo<DeliveryChallanLine[]>(() => {
    if (initial?.line_items != null) {
      return dcLinesFromJson(initial.line_items);
    }
    return [emptyDcLine()];
  }, [initial]);

  const [lines, setLines] = useState<DeliveryChallanLine[]>(() => seedLines);
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

  const [poNo, setPoNo] = useState(initial?.po_no ?? "");
  const [poDate, setPoDate] = useState(initial?.po_date ?? "");
  const [lrDocketNo, setLrDocketNo] = useState(initial?.lr_docket_no ?? "");
  const [ewayBillNo, setEwayBillNo] = useState(initial?.eway_bill_no ?? "");
  const [transportName, setTransportName] = useState(initial?.transport_name ?? "");
  const [transporterId, setTransporterId] = useState(initial?.transporter_id ?? "");
  const [vehicleNo, setVehicleNo] = useState(initial?.vehicle_no ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shipSlotLoad, setShipSlotLoad] = useState<0 | 1 | 2>(() => {
    const pid = initial?.party_id ?? null;
    const ship = initial?.ship_to as PartySnapshot | undefined;
    if (!pid || !ship) return 0;
    const row = parties.find((p) => p.id === pid);
    if (!row?.ship_tos.length) return 0;
    const sorted = [...row.ship_tos].sort((a, b) => a.slot - b.slot);
    const idx = sorted.findIndex((s) => addressStructuralEqual(s.snapshot, ship));
    return (idx >= 0 ? idx : 0) as 0 | 1 | 2;
  });
  const [linkedPartyId, setLinkedPartyId] = useState<string | null>(() => initial?.party_id ?? null);
  const [billLoadedFromParty, setBillLoadedFromParty] = useState(() => Boolean(initial?.party_id));
  const [shipLoadedFromParty, setShipLoadedFromParty] = useState(() => {
    const pid = initial?.party_id ?? null;
    const ship = initial?.ship_to as PartySnapshot | undefined;
    if (!pid || !ship) return false;
    const row = parties.find((p) => p.id === pid);
    if (!row?.ship_tos.length) return false;
    return row.ship_tos.some((s) => addressStructuralEqual(s.snapshot, ship));
  });
  const [shipSameAsBill, setShipSameAsBill] = useState(false);
  const [saveShipSnapshotToParty, setSaveShipSnapshotToParty] = useState(false);
  const [billAddressLockVersion, setBillAddressLockVersion] = useState(0);
  const [shipAddressLockVersion, setShipAddressLockVersion] = useState(0);
  const [savePartyFlags, savePartyUi] = useSavePartyFlags("bill_ship", billTo, shipTo, {
    partyLinkedId: linkedPartyId,
  });

  const linkedPartyRow = useMemo(
    () => (linkedPartyId ? parties.find((p) => p.id === linkedPartyId) : undefined),
    [parties, linkedPartyId],
  );
  const sortedShipTos = useMemo(
    () => (linkedPartyRow ? [...linkedPartyRow.ship_tos].sort((a, b) => a.slot - b.slot) : []),
    [linkedPartyRow],
  );

  const shipSameAsBillApplies =
    listStatus !== "issued" && (!linkedPartyId || sortedShipTos.length === 0);

  useEffect(() => {
    if (!shipSameAsBill || !shipSameAsBillApplies) return;
    setShipTo({ ...billTo });
  }, [billTo, shipSameAsBill, shipSameAsBillApplies]);

  function applyPickedPartyRow(row: PartyListRow) {
    setShipSameAsBill(false);
    setSaveShipSnapshotToParty(false);
    setBillTo(partyBillFromList(row));
    setLinkedPartyId(row.id);
    setBillLoadedFromParty(true);
    setBillAddressLockVersion((v) => v + 1);
    if (row.ship_tos.length > 0) {
      setShipSlotLoad(0);
      setShipTo(partyShipFromList(row, 0));
      setShipLoadedFromParty(true);
    } else {
      setShipSlotLoad(0);
      setShipTo(emptyParty(organizationCountryCode));
      setShipLoadedFromParty(false);
    }
    setShipAddressLockVersion((v) => v + 1);
  }

  function releaseBillPartyLink() {
    setLinkedPartyId(null);
    setBillLoadedFromParty(false);
    setShipLoadedFromParty(false);
    setSaveShipSnapshotToParty(false);
  }

  const shipSavedPickValue =
    linkedPartyId && shipLoadedFromParty ? String(shipSlotLoad as number) : "custom";

  const billPartyAddressId = useMemo(() => {
    if (!linkedPartyId) return null;
    if (!billLoadedFromParty && listStatus !== "issued") return null;
    return parties.find((p) => p.id === linkedPartyId)?.bill_address_id ?? null;
  }, [parties, linkedPartyId, billLoadedFromParty, listStatus]);

  const shipPartyAddressId = useMemo(() => {
    if (!linkedPartyId) return null;
    if (!shipLoadedFromParty && listStatus !== "issued") return null;
    const row = parties.find((p) => p.id === linkedPartyId);
    return resolvePartyShipAddressId(row, shipTo, shipSlotLoad);
  }, [parties, linkedPartyId, shipTo, shipSlotLoad, shipLoadedFromParty, listStatus]);

  const billLoadPartySelectId =
    linkedPartyId && (listStatus === "issued" || billLoadedFromParty) ? linkedPartyId : null;
  const shipLoadPartySelectId =
    linkedPartyId && (listStatus === "issued" || shipLoadedFromParty) ? linkedPartyId : null;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const partyPickerDisabled = listStatus === "issued";

  function updateLine(i: number, patch: Partial<DeliveryChallanLine>) {
    setLines((prev) =>
      prev.map((row, j) => {
        if (j !== i) return row;
        const merged = { ...row, ...patch };
        return computeDcLineFromInputs({
          description: merged.description,
          make_service_provider: merged.make_service_provider ?? "",
          model_part_no_description: merged.model_part_no_description ?? "",
          hsn: merged.hsn,
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
      computeDcLineFromInputs({
        description: "",
        make_service_provider: "",
        model_part_no_description: "",
        hsn: "",
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

  function moveLine(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= lines.length) return;
    setLines((prev) => moveArrayItem(prev, i, j));
    setLineTaxCustom((prev) => moveArrayItem(prev, i, j));
    setTaxCustomDraft((prev) => moveArrayItem(prev, i, j));
    setQtyDraft((prev) => moveArrayItem(prev, i, j));
    setUnitPriceDraft((prev) => moveArrayItem(prev, i, j));
  }

  function normalizeAdditionalChargesPayload(): DeliveryChallanAdditionalChargeInput[] {
    return additionalChargeDrafts
      .map((d) => ({
        label: resolveAdditionalChargeLabel(d).trim(),
        amount: parseUnitPriceDraftToNumber(d.amountDraft.trim()) ?? 0,
        tax_percent: parseTaxDraftToNumber(d.taxDraft.trim()) ?? 0,
      }))
      .filter((c) => c.label.length > 0 || c.amount > 0)
      .slice(0, 2);
  }

  function linesWithFlushedDrafts(base: DeliveryChallanLine[]): DeliveryChallanLine[] {
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

      return computeDcLineFromInputs({
        description: l.description,
        make_service_provider: l.make_service_provider ?? "",
        model_part_no_description: l.model_part_no_description ?? "",
        hsn: l.hsn,
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
    if (!billTo.name.trim()) {
      setError("Billing address name is required.");
      return;
    }
    if (!shipTo.name.trim()) {
      setError("Shipping address name is required.");
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      setError("Each line needs a product description.");
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
        setError(`Line ${i + 1}: Unit rate is required.`);
        return;
      }
      const qn = parseQtyDraftToNumber(qd);
      const upn = parseUnitPriceDraftToNumber(upd);
      if (qn === null || qn <= 0) {
        setError(`Line ${i + 1}: Enter a valid quantity greater than zero.`);
        return;
      }
      if (upn === null || upn < 0) {
        setError(`Line ${i + 1}: Enter a valid unit rate (0 or greater).`);
        return;
      }
    }
    if (
      listStatus !== "issued" &&
      (savePartyFlags.save_bill ||
        savePartyFlags.save_ship ||
        savePartyFlags.bill_and_ship_same)
    ) {
      if (!savePartyFlags.party_display_name.trim()) {
        setError("Enter a party name to save addresses.");
        return;
      }
    }
    if (listStatus !== "issued" && saveShipSnapshotToParty) {
      if (!linkedPartyId) {
        setError("Choose a saved party on billing before saving this shipping address to the party.");
        return;
      }
      if (shipLoadedFromParty) {
        setError('Use “Custom address” or “New shipping address” to save a new party ship-to.');
        return;
      }
      if (sortedShipTos.length >= 3) {
        setError("This party already has three shipping addresses.");
        return;
      }
      if (!shipTo.name.trim()) {
        setError("Enter a shipping address name before saving it to the party.");
        return;
      }
    }
    const appendShip =
      listStatus !== "issued" &&
      saveShipSnapshotToParty &&
      Boolean(linkedPartyId) &&
      !shipLoadedFromParty &&
      sortedShipTos.length < 3;
    setLoading(true);
    try {
      const payload = {
        document_date: documentDate || null,
        currency,
        bill_to: billTo,
        ship_to: shipTo,
        lines: linesWithFlushedDrafts(lines).map((l) => normalizeDcLineForSave(l)),
        additional_charges: normalizeAdditionalChargesPayload(),
        po_no: poNo || null,
        po_date: poDate || null,
        lr_docket_no: lrDocketNo || null,
        eway_bill_no: ewayBillNo || null,
        transport_name: transportName || null,
        transporter_id: transporterId || null,
        vehicle_no: vehicleNo || null,
        notes: notes || null,
        party_save:
          listStatus === "issued"
            ? undefined
            : savePartyFlags.save_bill || savePartyFlags.save_ship || savePartyFlags.bill_and_ship_same
              ? savePartyFlags
              : undefined,
        party_id: linkedPartyId,
        append_ship_address_to_linked_party: appendShip ? true : undefined,
        template,
      };
      if (mode === "create") {
        const res = await createDeliveryChallan({
          ...payload,
          series_slot: numberingCreate?.multiSeriesEnabled ? seriesSlot : null,
        });
        router.replace(`/delivery-challans/${res.id}`);
      } else if (challanId) {
        const res = await updateDeliveryChallan(challanId, {
          ...payload,
          series_slot:
            listStatus === "draft" && numberingDraft?.multiSeriesEnabled ? seriesSlot : undefined,
        });
        setLinkedPartyId(res.party_id);
        router.replace(`/delivery-challans/${challanId}`);
      }
      if (appendShip) setSaveShipSnapshotToParty(false);
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
  const dcCombined = dcTotalsWithAdditionalCharges(flushedForTotals, chargeRowsComputed);

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {mode === "edit" && listStatus === "issued" ? (
        <p className="max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This delivery challan is issued. Saving updates the document and print view.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Document date</span>
          <input
            type="date"
            required
            min={restrictDocumentBackdate ? documentDateMinYmd.slice(0, 10) : undefined}
            max={documentDateMaxYmd.slice(0, 10)}
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className="w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm sm:max-w-[200px]"
          />
        </label>
        {numberingUi ? (
          <DocumentNumberSeriesCreateBlock
            numbering={numberingUi}
            documentDateYmd={documentDate}
            seriesSlot={seriesSlot}
            onSeriesSlotChange={setSeriesSlot}
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
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <PartyFields
            title="Billing Address *"
            value={billTo}
            onChange={setBillTo}
            parties={parties}
            pickTarget="bill"
            partyNameCombobox={!partyPickerDisabled}
            onReleasePartyLink={releaseBillPartyLink}
            lockAddressFields={billLoadedFromParty || listStatus === "issued"}
            partyAddressRowId={billPartyAddressId}
            addressLockVersion={billAddressLockVersion}
            selectedLoadPartyId={billLoadPartySelectId}
            partyPickerDisabled={partyPickerDisabled}
            addressLockHint={
              listStatus === "issued"
                ? "This challan is issued — billing name, address, and GSTIN cannot be changed. The linked party cannot be switched. You may still update contact person and mobile when needed."
                : null
            }
            organizationCountryCode={organizationCountryCode}
            billingCountryCode={billingCountryCode}
            onPickParty={(id) => {
              if (id == null) {
                setBillTo(emptyParty(organizationCountryCode));
                setShipTo(emptyParty(organizationCountryCode));
                setBillLoadedFromParty(false);
                setShipLoadedFromParty(false);
                setLinkedPartyId(null);
                setShipSameAsBill(false);
                setSaveShipSnapshotToParty(false);
                setBillAddressLockVersion((v) => v + 1);
                setShipAddressLockVersion((v) => v + 1);
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
              if (row) applyPickedPartyRow(row);
            }}
            />
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h3 className="text-sm font-semibold">Shipping Address *</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
              {linkedPartyId ? (
                <>
                  <span className="shrink-0 text-xs text-[var(--muted)]">Ship-to</span>
                  <select
                    className={loadPartySelectClassName}
                    value={shipSavedPickValue}
                    disabled={listStatus === "issued"}
                    onChange={(e) => {
                      const v = e.target.value;
                      const row = parties.find((p) => p.id === linkedPartyId);
                      if (!row) return;
                      setShipSameAsBill(false);
                      setSaveShipSnapshotToParty(false);
                      if (v === "custom") {
                        setShipLoadedFromParty(false);
                        setShipAddressLockVersion((x) => x + 1);
                        return;
                      }
                      if (v === "new") {
                        setShipLoadedFromParty(false);
                        setShipTo(emptyParty(organizationCountryCode));
                        setShipAddressLockVersion((x) => x + 1);
                        return;
                      }
                      const idx = Number(v) as 0 | 1 | 2;
                      setShipSlotLoad(idx);
                      setShipTo(partyShipFromList(row, idx));
                      setShipLoadedFromParty(true);
                      setShipAddressLockVersion((x) => x + 1);
                    }}
                  >
                    {sortedShipTos.map((s, idx) => (
                      <option key={s.id} value={idx}>
                        Saved shipping {s.slot}:{" "}
                        {s.snapshot.name.trim() || s.snapshot.city?.trim() || "Address"}
                      </option>
                    ))}
                    {sortedShipTos.length < 3 ? (
                      <option value="new">New shipping address (empty form)</option>
                    ) : null}
                    <option value="custom">Custom address (edit below)</option>
                  </select>
                </>
              ) : null}
              {shipSameAsBillApplies ? (
                <label className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[11px] leading-snug text-[var(--muted)]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)]"
                    checked={shipSameAsBill}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setShipSameAsBill(on);
                      if (on) setShipTo({ ...billTo });
                    }}
                  />
                  <span>Shipping address same as billing address</span>
                </label>
              ) : null}
            </div>
            <PartyFields
              embedded
              value={shipTo}
              onChange={(p) => {
                setShipTo(p);
                if (shipSameAsBill) setShipSameAsBill(false);
              }}
              parties={parties}
              pickTarget="ship"
              shipSlotIndex={shipSlotLoad}
              hideLoadPartyPicker
              lockAddressFields={
                (shipLoadedFromParty && Boolean(linkedPartyId)) || listStatus === "issued"
              }
              partyAddressRowId={shipPartyAddressId}
              addressLockVersion={shipAddressLockVersion}
              selectedLoadPartyId={shipLoadPartySelectId}
              partyPickerDisabled={partyPickerDisabled}
              addressLockHint={
                listStatus === "issued"
                  ? "This challan is issued — shipping name, address, and GSTIN cannot be changed. You may still update contact person and mobile when needed."
                  : null
              }
              organizationCountryCode={organizationCountryCode}
            billingCountryCode={billingCountryCode}
              onPickParty={() => {}}
            />
            {linkedPartyId && !shipLoadedFromParty && listStatus !== "issued" && sortedShipTos.length < 3 ? (
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] leading-snug text-[var(--muted)]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)]"
                  checked={saveShipSnapshotToParty}
                  onChange={(e) => setSaveShipSnapshotToParty(e.target.checked)}
                />
                <span>Save this as new shipping address on the party</span>
              </label>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Transport &amp; documents</h3>
          <p className="text-[11px] text-[var(--muted)]">Shown on the right above the line table on print.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">PO no.</span>
              <input value={poNo} onChange={(e) => setPoNo(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">PO date</span>
              <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">LR / Docket no.</span>
              <input value={lrDocketNo} onChange={(e) => setLrDocketNo(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">E-way bill no.</span>
              <input value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Transport name</span>
              <input value={transportName} onChange={(e) => setTransportName(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Transporter ID</span>
              <input
                value={transporterId}
                onChange={(e) => setTransporterId(e.target.value)}
                className={field}
                placeholder="GST transporter ID"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Vehicle no.</span>
              <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={field} />
            </label>
          </div>
        </div>
      </div>

        {listStatus !== "issued" ? savePartyUi : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Line items (goods only)</h3>
        <p className="text-xs text-[var(--muted)]">
          <strong>HSN/SAC</strong> is optional per line. Unit rate, tax, and totals follow the same rules as quotations.
        </p>
        <p className="text-xs text-[var(--muted)] lg:hidden">Swipe sideways to see all columns.</p>
        <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border border-[var(--border)] pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 lg:touch-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-[var(--card)] text-[var(--muted)]">
              <tr>
                <th className="px-2 py-2 font-medium w-10">#</th>
                <th className="px-2 py-2 font-medium min-w-[200px]">Description *</th>
                <th className="px-2 py-2 font-medium">HSN/SAC</th>
                <th className="px-2 py-2 font-medium min-w-[148px]">Unit</th>
                <th className="px-2 py-2 font-medium min-w-[88px]">
                  Qty <span className="text-[var(--foreground)]">*</span>
                </th>
                <th className="px-2 py-2 font-medium min-w-[100px]">
                  Unit rate <span className="text-[var(--foreground)]">*</span>
                </th>
                <th className="px-2 py-2 font-medium min-w-[120px]">Tax %</th>
                <th className="px-2 py-2 font-medium w-24">Taxable</th>
                <th className="px-2 py-2 font-medium w-24">Tax amt</th>
                <th className="px-2 py-2 font-medium w-24">Total</th>
                <th className="px-2 py-2" />
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
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-2 py-2 align-top">
                    <DocumentLineMoveControls index={i} total={lines.length} onMove={moveLine} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1">
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          {locked ? (
                            <>
                              <input
                                required
                                readOnly
                                value={line.description}
                                className={field + lockCls + " w-full"}
                                placeholder="Product / service name"
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
                                  hsn: it.hsn_sac,
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
                                hsn: "",
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
                      {!locked ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={line.model_part_no_description ?? ""}
                            onChange={(e) => updateLine(i, { model_part_no_description: e.target.value })}
                            className={field + " text-xs"}
                            placeholder="Model / part no / description (optional)"
                          />
                          <input
                            value={line.make_service_provider ?? ""}
                            onChange={(e) => updateLine(i, { make_service_provider: e.target.value })}
                            className={field + " text-xs"}
                            placeholder="Make / service provider (optional)"
                          />
                        </div>
                      ) : null}
                      {isNewItemLine ? (
                        <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <input
                            type="checkbox"
                            checked={line.save_as_item !== false}
                            onChange={(e) => updateLine(i, { save_as_item: e.target.checked })}
                          />
                          Save as item in database when saving this document
                        </label>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      readOnly={locked}
                      value={line.hsn}
                      onChange={(e) => updateLine(i, { hsn: e.target.value })}
                      className={field + " tabular-nums" + lockCls}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
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
                  <td className="px-2 py-2 align-top">
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
                  <td className="px-2 py-2 align-top">
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
                      aria-label="Unit rate"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
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
                  <td className="px-2 py-2 align-top text-right tabular-nums text-[var(--muted)]">
                    {line.taxable_value.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 align-top text-right tabular-nums text-[var(--muted)]">
                    {line.tax_amount.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 align-top text-right font-medium tabular-nums">{line.line_total.toFixed(2)}</td>
                  <td className="px-2 py-2 align-top">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="min-h-10 min-w-[3.25rem] px-2 text-sm text-red-600 hover:underline touch-manipulation"
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

        <QuotationAdditionalChargesSection
          currency={currency}
          drafts={additionalChargeDrafts}
          setDrafts={setAdditionalChargeDrafts}
          quotationCombined={dcCombined}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href={mode === "edit" && challanId ? `/delivery-challans/${challanId}` : "/delivery-challans"}
          className="flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] sm:min-h-0"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className={primaryButtonMd + " min-h-11 w-full justify-center sm:min-h-0 sm:w-auto"}
        >
          {loading ? "Saving…" : mode === "create" ? "Save draft" : "Save"}
        </button>
      </div>
    </form>
  );
}
