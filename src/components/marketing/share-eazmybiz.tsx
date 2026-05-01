"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { secondarySkyButtonMd } from "@/lib/ui/primary-button";

const SHARE_BLURB =
  "I'm using eazmybiz for everyday business documentation — quotations, packing lists, delivery challans, and visitor passes. Take a look:";

function IconShare(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.314l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186z"
      />
    </svg>
  );
}

function useAppOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
    setOrigin(fromEnv || window.location.origin);
  }, []);
  return origin;
}

function shareLinks(url: string, encodedUrl: string, encodedText: string) {
  return [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_BLURB} ${url}`)}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: "X (Twitter)",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
  ];
}

export function ShareEazmybizMarketing() {
  const origin = useAppOrigin();
  const url = useMemo(() => (origin ? `${origin}/` : ""), [origin]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const encodedUrl = useMemo(() => (url ? encodeURIComponent(url) : ""), [url]);
  const encodedText = useMemo(() => encodeURIComponent(SHARE_BLURB), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const tryDeviceShare = useCallback(async () => {
    if (!url || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: "eazmybiz", text: SHARE_BLURB, url });
      setOpen(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setOpen(true);
    }
  }, [url]);

  const copyLink = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setOpen(false);
    } catch {
      /* ignore */
    }
  }, [url]);

  const canDeviceShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${secondarySkyButtonMd} inline-flex items-center gap-2`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IconShare className="h-4 w-4" />
        Share
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg dark:shadow-black/40"
          role="menu"
        >
          <p className="px-2 pb-2 text-xs text-[var(--muted)]">Share eazmybiz</p>
          {url && canDeviceShare ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
              onClick={() => void tryDeviceShare()}
            >
              Share via this device…
            </button>
          ) : null}
          {url && canDeviceShare ? <div className="my-1 border-t border-[var(--border)]" /> : null}
          {url
            ? shareLinks(url, encodedUrl, encodedText).map((item) => (
                <a
                  key={item.label}
                  role="menuitem"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
                >
                  {item.label}
                </a>
              ))
            : null}
          <button
            type="button"
            role="menuitem"
            className="mt-1 flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
            onClick={() => void copyLink()}
            disabled={!url}
          >
            Copy link
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ShareEazmybizSidebarProps = {
  expanded: boolean;
  hydrated: boolean;
};

export function ShareEazmybizSidebar({ expanded, hydrated }: ShareEazmybizSidebarProps) {
  const origin = useAppOrigin();
  const url = useMemo(() => (origin ? `${origin}/` : ""), [origin]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const encodedUrl = useMemo(() => (url ? encodeURIComponent(url) : ""), [url]);
  const encodedText = useMemo(() => encodeURIComponent(SHARE_BLURB), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const tryDeviceShare = useCallback(async () => {
    if (!url || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: "eazmybiz", text: SHARE_BLURB, url });
      setOpen(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setOpen(true);
    }
  }, [url]);

  const copyLink = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setOpen(false);
    } catch {
      /* ignore */
    }
  }, [url]);

  const canDeviceShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const baseBtn =
    "flex w-full items-center gap-3 rounded-md py-2 text-sm transition-colors text-[var(--foreground)] hover:bg-[var(--border)] " +
    (expanded ? "px-3" : "justify-center px-0");

  return (
    <div
      ref={wrapRef}
      className={
        "relative w-full " + (expanded ? "px-1" : "flex flex-col items-center gap-1")
      }
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={!hydrated || expanded ? undefined : "Share eazmybiz"}
        className={baseBtn}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IconShare className="h-5 w-5 shrink-0" />
        {expanded ? <span className="truncate">Share eazmybiz</span> : null}
      </button>
      {open ? (
        <div
          className={
            "absolute bottom-full z-[60] mb-2 w-[min(16rem,calc(100vw-2.5rem))] rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg " +
            (expanded ? "left-2 right-2" : "left-1/2 -translate-x-1/2")
          }
          role="menu"
        >
          <p className="px-2 pb-2 text-xs text-[var(--muted)]">Share eazmybiz</p>
          {url && canDeviceShare ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
              onClick={() => void tryDeviceShare()}
            >
              This device…
            </button>
          ) : null}
          {url && canDeviceShare ? <div className="my-1 border-t border-[var(--border)]" /> : null}
          {url
            ? shareLinks(url, encodedUrl, encodedText).map((item) => (
                <a
                  key={item.label}
                  role="menuitem"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
                >
                  {item.label}
                </a>
              ))
            : null}
          <button
            type="button"
            role="menuitem"
            className="mt-1 flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--border)]"
            onClick={() => void copyLink()}
            disabled={!url}
          >
            Copy link
          </button>
        </div>
      ) : null}
    </div>
  );
}
