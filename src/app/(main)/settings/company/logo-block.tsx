"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { publicObjectUrl } from "@/lib/storage-public-url";
import { removeOrgLogo, uploadOrgLogo } from "./actions";

export function LogoBlock({
  logoPath,
  canEditLogo,
}: {
  logoPath: string | null;
  canEditLogo: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const url = logoPath ? publicObjectUrl("org-logos", logoPath) : null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      const res = await uploadOrgLogo(fd);
      if (!res.ok) setError(res.error ?? "Upload failed");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      await removeOrgLogo();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <h2 className="text-sm font-medium leading-tight">Company logo</h2>
      {!canEditLogo ? (
        <p className="mt-1.5 text-xs text-[var(--muted)] sm:text-sm">
          Only the account owner can upload or remove the company logo.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="relative h-20 w-40 overflow-hidden rounded border border-slate-200 bg-white">
          {url ? (
            <Image src={url} alt="Company logo" fill className="object-contain p-1" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No logo</div>
          )}
        </div>
        {canEditLogo ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm">
              <span className="mr-2 rounded-md border border-[var(--border)] px-3 py-2 hover:bg-[var(--border)]">
                {busy ? "…" : "Upload image"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={busy}
                onChange={onFile}
              />
            </label>
            {url ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRemove}
                className="text-left text-sm text-red-600 hover:underline"
              >
                Remove logo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
