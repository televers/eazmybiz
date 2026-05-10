"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import {
  defaultDeliveryChallanTerms,
  defaultPackingTerms,
  defaultQuotationTerms,
} from "@/lib/packing/types";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import {
  approveOrgProfileChangeRequest,
  rejectOrgProfileChangeRequest,
  updateCompany,
} from "./actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { IsoCountrySelect } from "@/components/iso-country-select";
import { AddressLocalityFields } from "@/components/address/address-locality-fields";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { normalizeIndianGstinInput } from "@/lib/tax/gstin-india";
import type { ProfileChangeDiffRow } from "./profile-diff";
import type { PendingOrgProfileChange } from "./profile-types";

export type CompanyPendingRequest = PendingOrgProfileChange & { diffRows: ProfileChangeDiffRow[] };

export function CompanyForm({
  initial,
  isAccountOwnerForOrg,
  pendingQueue,
  billingCountryCode = null,
  afterSaveRedirect = null,
}: {
  /** Subscription billing country — listed first under Suggested when valid. */
  billingCountryCode?: string | null;
  /** When set, navigate here after a successful save (e.g. onboarding → dashboard). */
  afterSaveRedirect?: string | null;
  initial: {
    name: string;
    countryCode: string;
    region: string;
    gstin: string;
    orgAddressLine1: string;
    orgAddressLine2: string;
    orgCity: string;
    orgState: string;
    orgPin: string;
    orgCountry: string;
    orgEmail: string;
    orgMobile: string;
    packingTerms: string;
    deliveryChallanTerms: string;
    defaultCurrency: string;
    bankAccountHolderName: string;
    bankName: string;
    bankBranch: string;
    bankAccountNo: string;
    bankIfsc: string;
    quotationTerms: string;
  };
  isAccountOwnerForOrg: boolean;
  pendingQueue: CompanyPendingRequest[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [countryCode, setCountryCode] = useState(initial.countryCode);
  const [region, setRegion] = useState(initial.region);
  const [gstin, setGstin] = useState(initial.gstin);
  const [orgAddressLine1, setOrgAddressLine1] = useState(initial.orgAddressLine1);
  const [orgAddressLine2, setOrgAddressLine2] = useState(initial.orgAddressLine2);
  const [orgCity, setOrgCity] = useState(initial.orgCity);
  const [orgState, setOrgState] = useState(initial.orgState);
  const [orgPin, setOrgPin] = useState(initial.orgPin);
  const [orgCountry, setOrgCountry] = useState(initial.orgCountry);
  const [orgEmail, setOrgEmail] = useState(initial.orgEmail);
  const [orgMobile, setOrgMobile] = useState(initial.orgMobile);
  const [packingTerms, setPackingTerms] = useState(initial.packingTerms);
  const [deliveryChallanTerms, setDeliveryChallanTerms] = useState(initial.deliveryChallanTerms);
  const [defaultCurrency, setDefaultCurrency] = useState(initial.defaultCurrency || "INR");
  const [bankAccountHolderName, setBankAccountHolderName] = useState(initial.bankAccountHolderName);
  const [bankName, setBankName] = useState(initial.bankName);
  const [bankBranch, setBankBranch] = useState(initial.bankBranch);
  const [bankAccountNo, setBankAccountNo] = useState(initial.bankAccountNo);
  const [bankIfsc, setBankIfsc] = useState(initial.bankIfsc);
  const [quotationTerms, setQuotationTerms] = useState(initial.quotationTerms);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolveBusy, setResolveBusy] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await updateCompany({
        name,
        countryCode,
        region,
        gstin,
        orgAddressLine1,
        orgAddressLine2,
        orgCity,
        orgState,
        orgPin,
        orgCountry,
        orgEmail,
        orgMobile,
        packingTerms,
        deliveryChallanTerms,
        defaultCurrency,
        bankAccountHolderName,
        bankName,
        bankBranch,
        bankAccountNo,
        bankIfsc,
        quotationTerms,
      });
      if (result.infoMessage) {
        setInfo(result.infoMessage);
      }
      if (afterSaveRedirect && !result.pendingLegalSubmitted) {
        router.replace(afterSaveRedirect);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function onApprovePending(requestId: string) {
    setError(null);
    setResolveBusy(requestId);
    try {
      await approveOrgProfileChangeRequest(requestId);
      setRejectNotes((m) => {
        const next = { ...m };
        delete next[requestId];
        return next;
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setResolveBusy(null);
    }
  }

  async function onRejectPending(requestId: string) {
    setError(null);
    setResolveBusy(requestId);
    try {
      await rejectOrgProfileChangeRequest(requestId, rejectNotes[requestId]);
      setRejectNotes((m) => {
        const next = { ...m };
        delete next[requestId];
        return next;
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reject");
    } finally {
      setResolveBusy(null);
    }
  }

  const field =
    "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm w-full";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {!isAccountOwnerForOrg && pendingQueue.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Awaiting account owner approval</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            {pendingQueue.length === 1
              ? "One submission is queued."
              : `${pendingQueue.length} submissions are queued (oldest first).`}{" "}
            This page shows what is live today; the account owner approves each submission from Notifications or Account.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90 dark:text-amber-100/90">
            {pendingQueue.map((q, idx) => (
              <li key={q.id}>
                <span className="font-medium">Request {idx + 1}:</span>{" "}
                {q.diffRows.length > 0 ? q.diffRows.map((d) => d.label).join(", ") : "Open Company settings to review."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isAccountOwnerForOrg && pendingQueue.length > 0 ? (
        <div className="space-y-6">
          {pendingQueue.map((q, idx) => {
            const busy = resolveBusy === q.id;
            return (
              <div
                key={q.id}
                className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 text-sm"
              >
                <h2 className="font-medium text-[var(--foreground)]">
                  Approve company profile change
                  {pendingQueue.length > 1 ? ` (${idx + 1} of ${pendingQueue.length}, oldest first)` : ""}
                </h2>
                <p className="text-[var(--muted)]">
                  A company admin proposed the updates below. Approving applies this snapshot to the company profile
                  (documents and printouts). Other queued requests stay pending until you approve or reject them.
                </p>
                {q.diffRows.length > 0 ? (
                  <dl className="grid gap-3 text-[var(--foreground)] sm:grid-cols-1">
                    {q.diffRows.map((row) => (
                      <div key={row.label}>
                        <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
                        <dd className="mt-1 space-y-0.5">
                          <div>
                            <span className="text-[var(--muted)]">Current: </span>
                            {row.current}
                          </div>
                          <div>
                            <span className="text-[var(--muted)]">Proposed: </span>
                            <span className="font-medium text-[var(--foreground)]">{row.proposed}</span>
                          </div>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[var(--muted)]">No field differences vs live profile — you can still reject.</p>
                )}
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[var(--muted)]">Rejection note (optional)</span>
                  <input
                    value={rejectNotes[q.id] ?? ""}
                    onChange={(e) =>
                      setRejectNotes((m) => ({
                        ...m,
                        [q.id]: e.target.value,
                      }))
                    }
                    className={field}
                    disabled={busy}
                    placeholder="Shown to admins when you reject"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprovePending(q.id)}
                    className={primaryButtonMd}
                  >
                    {busy ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRejectPending(q.id)}
                    className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--border)]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!isAccountOwnerForOrg ? (
        <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm leading-snug text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
          <p>Only the account owner can change the company name.</p>
          <p>
            GSTIN, bank details, and communication address (including region) need account owner approval.
          </p>
          <p>Country code, email, mobile, terms, and default currency save immediately.</p>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Legal &amp; tax</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Company name (consigner)</span>
          <input
            required
            value={name}
            readOnly={!isAccountOwnerForOrg}
            onChange={isAccountOwnerForOrg ? (e) => setName(e.target.value) : undefined}
            className={
              field + (!isAccountOwnerForOrg ? " cursor-not-allowed bg-[var(--border)]/25" : "")
            }
          />
          {!isAccountOwnerForOrg ? (
            <span className="text-xs text-[var(--muted)]">Only the account owner can edit the legal company name.</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Country (legal / tax)</span>
          <IsoCountrySelect
            required
            billingCountryCode={billingCountryCode}
            organizationCountryCode={countryCode}
            value={countryCode}
            onChange={(code) => setCountryCode(code)}
            className={field}
            aria-describedby="company-country-help"
          />
          <span id="company-country-help" className="text-xs text-[var(--muted)]">
            Suggested lists your plan&apos;s billing country (when set) and India, then all countries A–Z. Open the
            list and type a letter to jump. Values are standard ISO codes (e.g. IN), not full names.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Region / state (optional)</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">GSTIN / tax ID (optional)</span>
          <input
            value={gstin}
            onChange={(e) =>
              setGstin(
                countryCode.trim().toUpperCase() === "IN"
                  ? normalizeIndianGstinInput(e.target.value)
                  : e.target.value,
              )
            }
            className={field}
            maxLength={countryCode.trim().toUpperCase() === "IN" ? 15 : undefined}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Communication Address and Contact</h2>
        {!isAccountOwnerForOrg ? (
          <p className="text-xs text-[var(--muted)]">
            Address and region changes require account owner approval before they apply on documents.
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Address line 1</span>
          <input value={orgAddressLine1} onChange={(e) => setOrgAddressLine1(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Address line 2</span>
          <input value={orgAddressLine2} onChange={(e) => setOrgAddressLine2(e.target.value)} className={field} />
        </label>
        <div className="space-y-2">
          <AddressLocalityFields
            city={orgCity}
            state={orgState}
            pin={orgPin}
            countryIso={coerceToLibphonenumberCountry(orgCountry || countryCode)}
            onChange={(patch) => {
              if (patch.city !== undefined) setOrgCity(patch.city);
              if (patch.state !== undefined) setOrgState(patch.state);
              if (patch.pin !== undefined) setOrgPin(patch.pin);
              if (patch.country !== undefined) setOrgCountry(patch.country);
            }}
            billingCountryCode={billingCountryCode}
            organizationCountryCode={countryCode}
            inputClassName={field}
            pinHelpId="company-comm-postal-hint"
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Email</span>
          <input
            type="email"
            value={orgEmail}
            onChange={(e) => setOrgEmail(e.target.value)}
            className={field}
            placeholder="info@company.com"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Mobile (optional)</span>
          <IntlMobileField
            value={orgMobile}
            onChange={setOrgMobile}
            organizationCountryIso={countryCode}
            billingCountryIso={billingCountryCode}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Default currency</h2>
        <p className="text-xs text-[var(--muted)]">
          Used as the default on new quotations; you can change per quotation, if required.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">ISO currency code</span>
          <select
            value={defaultCurrency}
            onChange={(e) => setDefaultCurrency(e.target.value)}
            className={field}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Bank details (to be printed on quotation, delivery challan, and similar)</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Account holder name</span>
          <input
            value={bankAccountHolderName}
            onChange={(e) => setBankAccountHolderName(e.target.value)}
            className={field}
            placeholder="As per bank records"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Bank name</span>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Bank account no.</span>
          <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Branch name</span>
            <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">IFSC code</span>
            <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className={field} />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Quotation — terms &amp; conditions</h2>
        <p className="text-xs text-[var(--muted)]">
          Update your other terms &amp; conditions to be printed on Quotation.
        </p>
        <textarea
          value={quotationTerms}
          onChange={(e) => setQuotationTerms(e.target.value)}
          rows={5}
          className={`${field} font-mono text-xs leading-relaxed`}
          placeholder={defaultQuotationTerms()}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Delivery challan — terms &amp; conditions</h2>
        <p className="text-xs text-[var(--muted)]">
          Update your standard terms &amp; conditions to be printed on delivery challans.
        </p>
        <textarea
          value={deliveryChallanTerms}
          onChange={(e) => setDeliveryChallanTerms(e.target.value)}
          rows={4}
          className={`${field} font-mono text-xs leading-relaxed`}
          placeholder={defaultDeliveryChallanTerms()}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Packing list — terms and conditions</h2>
        <p className="text-xs text-[var(--muted)]">
          Update your other terms &amp; conditions to be printed on Packing List.
        </p>
        <textarea
          value={packingTerms}
          onChange={(e) => setPackingTerms(e.target.value)}
          rows={6}
          className={`${field} font-mono text-xs leading-relaxed`}
          placeholder={defaultPackingTerms()}
        />
      </section>

      {info ? <p className="text-sm text-sky-800 dark:text-sky-200">{info}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className={primaryButtonMd}
      >
        {loading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
