"use client";

import { useRouter } from "next/navigation";
import { MaterialGatePassForm } from "./material-gate-pass-form";
import { issueGatePass, updateGatePass } from "@/app/(main)/gate-passes/actions";
import type { PartyListRow } from "@/lib/parties/load-parties";

export function GatePassDraftForm({
  id,
  parties,
  defaultValues,
  minPassDateYmd,
  maxPassDateYmd,
  calendarTzLabel,
  organizationCountryCode,
  billingCountryCode,
}: {
  id: string;
  parties: PartyListRow[];
  minPassDateYmd: string;
  maxPassDateYmd: string;
  calendarTzLabel: string;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
  defaultValues: {
    direction: "in" | "out";
    documentDate: string;
    invoiceNo: string;
    partyId: string | null;
    partyName: string;
    transportName: string;
    lrDocketNo: string;
    handCarriedName: string;
    handCarriedMobile: string;
    vehicleNo: string;
    packageCount: string;
    mainItem: string;
    notes: string;
  };
}) {
  const router = useRouter();
  return (
    <MaterialGatePassForm
      key={id}
      parties={parties}
      minPassDateYmd={minPassDateYmd}
      maxPassDateYmd={maxPassDateYmd}
      calendarTzLabel={calendarTzLabel}
      organizationCountryCode={organizationCountryCode}
      billingCountryCode={billingCountryCode}
      defaultValues={defaultValues}
      submitLabel="Save draft"
      onSave={async (payload) => {
        await updateGatePass(id, payload);
        router.replace("/gate-passes");
        router.refresh();
      }}
      onIssuePass={async (payload) => {
        await updateGatePass(id, payload);
        const res = await issueGatePass(id);
        if (!res.ok) {
          throw new Error(
            res.error === "quota exceeded"
              ? "Monthly gate pass quota reached."
              : (res.error ?? "Could not issue"),
          );
        }
        router.replace(`/gate-passes/${id}/print?autoprint=1`);
        router.refresh();
      }}
    />
  );
}
