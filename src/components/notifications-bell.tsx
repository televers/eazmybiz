"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPreview } from "@/lib/notifications-preview";

function IconBell({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

export function NotificationsBell({
  preview,
  isAccountOwner,
}: {
  preview: NotificationPreview;
  isAccountOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const notificationsHref = "/settings/notifications";
  const showBadge = isAccountOwner && preview.pendingApprovalCount > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--border)]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
      >
        <IconBell className="h-5 w-5" />
        {showBadge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
            {preview.pendingApprovalCount > 9 ? "9+" : preview.pendingApprovalCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,22rem)] rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 shadow-lg"
          role="menu"
        >
          <div className="border-b border-[var(--border)] px-3 pb-2">
            <p className="text-xs font-medium text-[var(--muted)]">Notifications</p>
            {isAccountOwner && preview.pendingApprovalCount > 0 ? (
              <Link
                href={notificationsHref}
                className="mt-1 block text-sm font-medium text-amber-800 hover:underline dark:text-amber-200"
                onClick={close}
              >
                {preview.pendingApprovalCount} profile change
                {preview.pendingApprovalCount === 1 ? "" : "s"} awaiting your approval
              </Link>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto text-sm">
            {preview.items.length === 0 ? (
              <li className="px-3 py-4 text-[var(--muted)]">No recent activity.</li>
            ) : (
              preview.items.map((item) => (
                <li key={item.id} className="border-b border-[var(--border)] px-3 py-2 last:border-b-0">
                  <p className="text-xs text-[var(--muted)]">
                    {item.company_name} ·{" "}
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-0.5 text-[var(--foreground)]">{item.summary}</p>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-[var(--border)] px-3 pt-2">
            <Link
              href={notificationsHref}
              className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
              onClick={close}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
