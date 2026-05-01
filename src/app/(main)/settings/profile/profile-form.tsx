"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IntlMobileField } from "@/components/phone/intl-mobile-field";
import { primaryButtonMd } from "@/lib/ui/primary-button";
import { updateMyProfileAction } from "./actions";

export function ProfileForm(props: {
  email: string;
  /** Organization country (ISO) for mobile ISD default. */
  countryCode: string;
  billingCountryCode?: string | null;
  initial: {
    displayName: string;
    employeeId: string;
    department: string;
    mobile: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(props.initial.displayName);
  const [employeeId, setEmployeeId] = useState(props.initial.employeeId);
  const [department, setDepartment] = useState(props.initial.department);
  const [mobile, setMobile] = useState(props.initial.mobile);

  return (
    <form
      className="mt-6 flex max-w-lg flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          try {
            await updateMyProfileAction({
              displayName,
              employeeId,
              department,
              mobile,
            });
            setSuccess("Profile saved.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save profile");
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Name</span>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={pending}
          autoComplete="name"
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          placeholder="Your full name"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Employee ID (optional)</span>
        <input
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          disabled={pending}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          placeholder="e.g. EMP-1024"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Department (optional)</span>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          disabled={pending}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          placeholder="e.g. Operations"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Email ID</span>
        <input
          type="email"
          readOnly
          disabled
          value={props.email}
          className="cursor-not-allowed rounded-md border border-[var(--border)] bg-[var(--border)]/40 px-3 py-2 text-[var(--foreground)]"
          title="Sign-in email cannot be changed"
        />
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          This is your sign-in email. It cannot be changed after registration or invite.
        </p>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Mobile no. (optional)</span>
        <IntlMobileField
          value={mobile}
          onChange={setMobile}
          disabled={pending}
          organizationCountryIso={props.countryCode}
          billingCountryIso={props.billingCountryCode}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonMd + " w-fit"}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
