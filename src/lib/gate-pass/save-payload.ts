export type GatePassSavePayload = {
  direction: "in" | "out";
  /** Calendar date on the pass (Asia/Kolkata); not before today when saving or issuing. */
  documentDate: string;
  invoiceNo: string | null;
  partyId: string | null;
  partyName: string | null;
  transportName: string | null;
  lrDocketNo: string | null;
  handCarriedName: string | null;
  handCarriedMobile: string | null;
  vehicleNo: string | null;
  packageCount: number | null;
  mainItem: string | null;
  notes: string | null;
};
