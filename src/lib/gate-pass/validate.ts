import { requireValidIntlMobile } from "@/lib/phone/intl-mobile";
import type { GatePassSavePayload } from "./save-payload";

/** Returns a user-visible error message, or null if valid. */
export function validateMaterialGatePass(input: GatePassSavePayload): string | null {
  const dp = String(input.documentDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dp)) {
    return "Pass date is required.";
  }

  if (!(input.invoiceNo && input.invoiceNo.trim())) {
    return "Invoice / delivery challan number is required.";
  }

  const pk = input.packageCount;
  if (
    pk == null ||
    typeof pk !== "number" ||
    !Number.isFinite(pk) ||
    !Number.isInteger(pk) ||
    pk < 1
  ) {
    return "Number of packages is required (at least 1).";
  }

  const hasCourier =
    Boolean((input.transportName ?? "").trim()) || Boolean((input.lrDocketNo ?? "").trim());
  const hasHand =
    Boolean((input.handCarriedName ?? "").trim()) && Boolean((input.handCarriedMobile ?? "").trim());

  if (!hasCourier && !hasHand) {
    return "Fill either courier/transport (name or LR/AWB) or hand-carried person (name and mobile).";
  }

  if (hasHand) {
    try {
      requireValidIntlMobile(input.handCarriedMobile ?? "");
    } catch (e) {
      return e instanceof Error ? e.message : "Enter a valid hand-carried mobile (with country code).";
    }
  }

  return null;
}
