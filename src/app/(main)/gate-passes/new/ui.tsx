"use client";

import { useRouter } from "next/navigation";
import { MaterialGatePassForm } from "@/components/gate-pass/material-gate-pass-form";
import { createGatePass } from "../actions";
import type { PartyListRow } from "@/lib/parties/load-parties";

export function NewGatePassForm({
  parties,
  minPassDateYmd,
  maxPassDateYmd,
  calendarTzLabel,
  organizationCountryCode,
  billingCountryCode,
}: {
  parties: PartyListRow[];
  minPassDateYmd: string;
  maxPassDateYmd: string;
  calendarTzLabel: string;
  organizationCountryCode: string;
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  return (
    <MaterialGatePassForm
      parties={parties}
      minPassDateYmd={minPassDateYmd}
      maxPassDateYmd={maxPassDateYmd}
      calendarTzLabel={calendarTzLabel}
      organizationCountryCode={organizationCountryCode}
      billingCountryCode={billingCountryCode}
      submitLabel="Save draft"
      onSave={async (payload) => {
        await createGatePass(payload);
        router.replace("/gate-passes");
        router.refresh();
      }}
    />
  );
}
