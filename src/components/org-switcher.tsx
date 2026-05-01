"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActiveOrganizationAction } from "@/app/(main)/org-switch-actions";

export function OrgSwitcher({
  organizations,
  activeOrgId,
  expanded,
}: {
  organizations: { id: string; name: string }[];
  activeOrgId: string;
  expanded: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (organizations.length <= 1) {
    return null;
  }

  return (
    <label className={"flex flex-col gap-1 " + (expanded ? "px-2" : "items-center")}>
      {expanded ? <span className="text-xs text-[var(--muted)]">Active company</span> : null}
      <select
        className={
          "max-w-full rounded-md border border-[var(--border)] bg-[var(--card)] py-1.5 text-sm text-[var(--foreground)] " +
          (expanded ? "px-2" : "w-10 px-0 text-center")
        }
        value={activeOrgId}
        disabled={pending}
        title="Switch company"
        aria-label="Active company"
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await setActiveOrganizationAction(id);
            router.refresh();
          });
        }}
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
