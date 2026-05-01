"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCompanyAction } from "@/app/(main)/settings/account/actions";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function AccountPanel(props: {
  companies: { id: string; name: string }[];
  companyCount: number;
  companyLimit: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canAdd = props.companyCount < props.companyLimit;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-medium">Companies on this account</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          You are the account owner (master admin). Switch the active company from the sidebar.{" "}
          {props.companyCount} / {props.companyLimit} companies used.
        </p>
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {props.companies.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{c.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Add company</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Only the account owner can add another legal entity (company) to the subscription.
        </p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canAdd) return;
            setError(null);
            startTransition(async () => {
              try {
                await createCompanyAction(name);
                setName("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create company");
              }
            });
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Company name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!canAdd || pending}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              placeholder="e.g. Acme Logistics Pvt Ltd"
            />
          </label>
          <button type="submit" disabled={!canAdd || pending} className={primaryButtonMd}>
            {pending ? "Creating…" : "Create company"}
          </button>
        </form>
        {!canAdd ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Upgrade your plan to add more companies.</p>
        ) : null}
      </section>
    </div>
  );
}
