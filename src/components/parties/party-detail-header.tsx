"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PartyFormModal } from "@/components/parties/party-form-modal";
import type { PartyListRow } from "@/lib/parties/load-parties";
import type { PartySnapshot } from "@/lib/packing/types";
import { primaryButtonMd } from "@/lib/ui/primary-button";

function partyBillingSummary(p: PartySnapshot): string {
  const gst = p.gstin?.trim();
  const city = p.city?.trim();
  const country = p.country?.trim();
  const bits = [
    gst ? `GST ${gst}` : null,
    city || null,
    country || null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "No billing address yet";
}

const primaryBtn = `inline-flex items-center gap-2 ${primaryButtonMd}`;

function IconPrint() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8Z"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export function PartyDetailHeader({
  partyRow,
  hasDocuments,
  canEditBilling,
  organizationCountryCode = "IN",
  billingCountryCode,
}: {
  partyRow: PartyListRow;
  hasDocuments: boolean;
  /** Party maintainer, company admin, or account owner — can edit name and billing; others may still edit shipping. */
  canEditBilling: boolean;
  organizationCountryCode?: string;
  billingCountryCode?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{partyRow.display_name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{partyBillingSummary(partyRow.bill_to)}</p>
          {!canEditBilling ? (
            <p className="mt-2 max-w-xl text-xs text-[var(--muted)]">
              Use this party on documents. Name and billing are read-only for you; you can edit shipping here — changes
              show under Activity.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href={`/parties/${partyRow.id}/address-labels`}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryBtn}
          >
            <IconPrint />
            Print address labels
          </a>
          <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
            <IconPencil />
            Edit party
          </button>
        </div>
      </div>

      <PartyFormModal
        key={`${partyRow.id}-${partyRow.updated_at}`}
        open={open}
        onClose={() => setOpen(false)}
        mode="edit"
        party={partyRow}
        hasDocumentsOverride={hasDocuments}
        canEditBilling={canEditBilling}
        organizationCountryCode={organizationCountryCode}
        billingCountryCode={billingCountryCode}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
