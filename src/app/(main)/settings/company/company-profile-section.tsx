"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import {
  approveOrgProfileChangeRequest,
  rejectOrgProfileChangeRequest,
  updateCompany,
} from "./actions";
import { primaryButtonCompact, primaryButtonMd } from "@/lib/ui/primary-button";
import { IsoCountrySelect } from "@/components/iso-country-select";
import { AddressLocalityFields } from "@/components/address/address-locality-fields";
import { coerceToLibphonenumberCountry } from "@/lib/geo/iso-country-select-options";
import { normalizeIndianGstinInput } from "@/lib/tax/gstin-india";
import type { ProfileChangeDiffRow } from "./profile-diff";
import type { PendingOrgProfileChange } from "./profile-types";
import { LogoBlock } from "./logo-block";

export type CompanyPendingRequest = PendingOrgProfileChange & { diffRows: ProfileChangeDiffRow[] };

const field =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm w-full";

function dash(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : "—";
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5 space-y-1">
      <p className="text-xs font-medium text-[var(--muted)]">{title}</p>
      <div className="text-sm leading-snug text-[var(--foreground)]">{children}</div>
    </div>
  );
}

function formatAddressSummary(input: {
  orgAddressLine1: string;
  orgAddressLine2: string;
  orgCity: string;
  orgState: string;
  orgPin: string;
  orgCountry: string;
  orgEmail: string;
  orgMobile: string;
}): string[] {
  const lines: string[] = [];
  if (input.orgAddressLine1.trim()) lines.push(input.orgAddressLine1.trim());
  if (input.orgAddressLine2.trim()) lines.push(input.orgAddressLine2.trim());
  const locality = [input.orgCity, input.orgState, input.orgPin].map((s) => s.trim()).filter(Boolean);
  if (locality.length) lines.push(locality.join(", "));
  if (input.orgCountry.trim()) lines.push(input.orgCountry.trim());
  if (input.orgEmail.trim()) lines.push(input.orgEmail.trim());
  if (input.orgMobile.trim()) lines.push(input.orgMobile.trim());
  return lines;
}

function formatBankSummary(input: {
  bankAccountHolderName: string;
  bankName: string;
  bankAccountNo: string;
  bankBranch: string;
  bankIfsc: string;
}): string[] {
  const lines: string[] = [];
  if (input.bankAccountHolderName.trim()) lines.push(input.bankAccountHolderName.trim());
  if (input.bankName.trim()) lines.push(input.bankName.trim());
  if (input.bankAccountNo.trim()) lines.push(`A/c ${input.bankAccountNo.trim()}`);
  const tail = [input.bankBranch.trim(), input.bankIfsc.trim()].filter(Boolean);
  if (tail.length) lines.push(tail.join(" · "));
  return lines;
}

export function CompanyProfileSection({
  initial,
  logoPath,
  isAccountOwnerForOrg,
  pendingQueue,
  billingCountryCode = null,
  afterSaveRedirect = null,
  startEditing = false,
}: {
  billingCountryCode?: string | null;
  afterSaveRedirect?: string | null;
  startEditing?: boolean;
  logoPath: string | null;
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
    defaultCurrency: string;
    bankAccountHolderName: string;
    bankName: string;
    bankBranch: string;
    bankAccountNo: string;
    bankIfsc: string;
  };
  isAccountOwnerForOrg: boolean;
  pendingQueue: CompanyPendingRequest[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
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
  const [defaultCurrency, setDefaultCurrency] = useState(initial.defaultCurrency || "INR");
  const [bankAccountHolderName, setBankAccountHolderName] = useState(initial.bankAccountHolderName);
  const [bankName, setBankName] = useState(initial.bankName);
  const [bankBranch, setBankBranch] = useState(initial.bankBranch);
  const [bankAccountNo, setBankAccountNo] = useState(initial.bankAccountNo);
  const [bankIfsc, setBankIfsc] = useState(initial.bankIfsc);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolveBusy, setResolveBusy] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  function resetDraft() {
    setName(initial.name);
    setCountryCode(initial.countryCode);
    setRegion(initial.region);
    setGstin(initial.gstin);
    setOrgAddressLine1(initial.orgAddressLine1);
    setOrgAddressLine2(initial.orgAddressLine2);
    setOrgCity(initial.orgCity);
    setOrgState(initial.orgState);
    setOrgPin(initial.orgPin);
    setOrgCountry(initial.orgCountry);
    setOrgEmail(initial.orgEmail);
    setOrgMobile(initial.orgMobile);
    setDefaultCurrency(initial.defaultCurrency || "INR");
    setBankAccountHolderName(initial.bankAccountHolderName);
    setBankName(initial.bankName);
    setBankBranch(initial.bankBranch);
    setBankAccountNo(initial.bankAccountNo);
    setBankIfsc(initial.bankIfsc);
    setError(null);
    setInfo(null);
  }

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
        defaultCurrency,
        bankAccountHolderName,
        bankName,
        bankBranch,
        bankAccountNo,
        bankIfsc,
      });
      if (result.infoMessage) setInfo(result.infoMessage);
      if (afterSaveRedirect && !result.pendingLegalSubmitted) {
        router.replace(afterSaveRedirect);
        router.refresh();
        return;
      }
      setEditing(false);
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

  const addressLines = formatAddressSummary({
    orgAddressLine1,
    orgAddressLine2,
    orgCity,
    orgState,
    orgPin,
    orgCountry,
    orgEmail,
    orgMobile,
  });
  const bankLines = formatBankSummary({
    bankAccountHolderName,
    bankName,
    bankAccountNo,
    bankBranch,
    bankIfsc,
  });

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Company profile</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Logo, legal details, communication address, bank information, and default currency for documents.
        </p>
      </div>

      {!isAccountOwnerForOrg && pendingQueue.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Awaiting account owner approval</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            {pendingQueue.length === 1
              ? "One submission is queued."
              : `${pendingQueue.length} submissions are queued (oldest first).`}{" "}
            This page shows what is live today.
          </p>
        </div>
      ) : null}

      {isAccountOwnerForOrg && pendingQueue.length > 0 ? (
        <div className="space-y-3">
          {pendingQueue.map((q, idx) => {
            const busy = resolveBusy === q.id;
            return (
              <div
                key={q.id}
                className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5 text-sm"
              >
                <h3 className="font-medium text-[var(--foreground)]">
                  Approve profile change
                  {pendingQueue.length > 1 ? ` (${idx + 1} of ${pendingQueue.length})` : ""}
                </h3>
                {q.diffRows.length > 0 ? (
                  <dl className="grid gap-2 text-[var(--foreground)]">
                    {q.diffRows.map((row) => (
                      <div key={row.label}>
                        <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
                        <dd className="mt-0.5 space-y-0.5">
                          <div>
                            <span className="text-[var(--muted)]">Current: </span>
                            {row.current}
                          </div>
                          <div>
                            <span className="text-[var(--muted)]">Proposed: </span>
                            <span className="font-medium">{row.proposed}</span>
                          </div>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[var(--muted)]">No field differences vs live profile.</p>
                )}
                <input
                  value={rejectNotes[q.id] ?? ""}
                  onChange={(e) => setRejectNotes((m) => ({ ...m, [q.id]: e.target.value }))}
                  className={field}
                  disabled={busy}
                  placeholder="Rejection note (optional)"
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => onApprovePending(q.id)} className={primaryButtonCompact}>
                    {busy ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRejectPending(q.id)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!editing ? (
        <>
          <LogoBlock logoPath={logoPath} canEditLogo={isAccountOwnerForOrg} showControls={false} embedded />

          <div className="space-y-2">
            <SummaryCard title="Legal & tax">
              <p>{dash(name)}</p>
              <p className="text-xs text-[var(--muted)]">
                {dash(countryCode)}
                {region.trim() ? ` · ${region.trim()}` : ""}
                {gstin.trim() ? ` · GSTIN ${gstin.trim()}` : ""}
              </p>
            </SummaryCard>

            <SummaryCard title="Communication address & contact">
              {addressLines.length > 0 ? (
                addressLines.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p className="text-[var(--muted)]">Not set</p>
              )}
            </SummaryCard>

            <SummaryCard title="Bank details">
              {bankLines.length > 0 ? (
                bankLines.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p className="text-[var(--muted)]">Not set</p>
              )}
            </SummaryCard>

            <SummaryCard title="Default currency">
              <p>{dash(defaultCurrency)}</p>
            </SummaryCard>
          </div>

          <button
            type="button"
            onClick={() => {
              resetDraft();
              setEditing(true);
            }}
            className={primaryButtonCompact}
          >
            Edit profile
          </button>
        </>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {!isAccountOwnerForOrg ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-snug text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              <p>Only the account owner can change the company name.</p>
              <p className="mt-1">
                GSTIN, bank details, and communication address need account owner approval. Country code, email,
                mobile, and currency save immediately.
              </p>
            </div>
          ) : null}

          <LogoBlock logoPath={logoPath} canEditLogo={isAccountOwnerForOrg} embedded />

          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5">
            <h3 className="text-sm font-medium">Legal &amp; tax</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Company name</span>
              <input
                required
                value={name}
                readOnly={!isAccountOwnerForOrg}
                onChange={isAccountOwnerForOrg ? (e) => setName(e.target.value) : undefined}
                className={field + (!isAccountOwnerForOrg ? " cursor-not-allowed bg-[var(--border)]/25" : "")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Country (legal / tax)</span>
              <IsoCountrySelect
                required
                billingCountryCode={billingCountryCode}
                organizationCountryCode={countryCode}
                value={countryCode}
                onChange={setCountryCode}
                className={field}
              />
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
          </div>

          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5">
            <h3 className="text-sm font-medium">Communication address &amp; contact</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Address line 1</span>
              <input value={orgAddressLine1} onChange={(e) => setOrgAddressLine1(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Address line 2</span>
              <input value={orgAddressLine2} onChange={(e) => setOrgAddressLine2(e.target.value)} className={field} />
            </label>
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
          </div>

          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5">
            <h3 className="text-sm font-medium">Bank details</h3>
            <p className="text-xs text-[var(--muted)]">Printed on quotations, delivery challans, and similar.</p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Account holder name</span>
              <input
                value={bankAccountHolderName}
                onChange={(e) => setBankAccountHolderName(e.target.value)}
                className={field}
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
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">Branch name</span>
                <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">IFSC code</span>
                <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className={field} />
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)]/50 p-2.5">
            <h3 className="text-sm font-medium">Default currency</h3>
            <p className="text-xs text-[var(--muted)]">Default on new quotations; change per document if needed.</p>
            <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} className={field}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {info ? <p className="text-sm text-sky-800 dark:text-sky-200">{info}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={loading} className={primaryButtonMd}>
              {loading ? "Saving…" : "Save profile"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                resetDraft();
                setEditing(false);
              }}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
