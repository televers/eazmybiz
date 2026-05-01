"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSavedItemPreset, updateSavedItemPreset } from "@/app/(main)/packing-lists/masters-actions";
import type { SavedItemRow } from "@/lib/items/saved-item-types";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function NewItemForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("Pcs");
  const [make_service_provider, setMakeServiceProvider] = useState("");
  const [model_part_no_description, setModelPartNoDescription] = useState("");
  const [hsn_sac, setHsnSac] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createSavedItemPreset({
        description,
        defaultUnit,
        make_service_provider,
        model_part_no_description,
        hsn_sac,
      });
      setDescription("");
      setDefaultUnit("Pcs");
      setMakeServiceProvider("");
      setModelPartNoDescription("");
      setHsnSac("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-sm font-semibold">Add New Item</h2>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Item / product / service name *</span>
            <input
              required
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Unit *</span>
            <input
              required
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={defaultUnit}
              onChange={(e) => setDefaultUnit(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">HSN / SAC</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={hsn_sac}
              onChange={(e) => setHsnSac(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Model / part no / description</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={model_part_no_description}
              onChange={(e) => setModelPartNoDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Make / service provider</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={make_service_provider}
              onChange={(e) => setMakeServiceProvider(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`w-fit ${primaryButtonMd}`}
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function EditItemForm({
  item,
  canEditNameAndUnit,
}: {
  item: SavedItemRow;
  /** Company admin or account owner — may change name and unit; others may still edit HSN, make, model. */
  canEditNameAndUnit: boolean;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(item.description);
  const [default_unit, setDefaultUnit] = useState(item.default_unit);
  const [make_service_provider, setMakeServiceProvider] = useState(item.make_service_provider);
  const [model_part_no_description, setModelPartNoDescription] = useState(item.model_part_no_description);
  const [hsn_sac, setHsnSac] = useState(item.hsn_sac);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDescription(item.description);
    setDefaultUnit(item.default_unit);
    setMakeServiceProvider(item.make_service_provider);
    setModelPartNoDescription(item.model_part_no_description);
    setHsnSac(item.hsn_sac);
  }, [
    item.id,
    item.description,
    item.default_unit,
    item.make_service_provider,
    item.model_part_no_description,
    item.hsn_sac,
    item.managed_by_user_id,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateSavedItemPreset(item.id, {
        description,
        default_unit,
        make_service_provider,
        model_part_no_description,
        hsn_sac,
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Edit item</h2>
        <p className="text-[10px] text-[var(--muted)]">Updates apply wherever this item is linked.</p>
      </div>
      {!canEditNameAndUnit ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Name and unit are read-only for you. HSN/SAC, make, and model can be edited here — see Activity below.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-[var(--muted)]">Name *</span>
          <input
            required
            disabled={!canEditNameAndUnit}
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm disabled:opacity-60"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-[var(--muted)]">Unit *</span>
            <input
              required
              disabled={!canEditNameAndUnit}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm disabled:opacity-60"
              value={default_unit}
              onChange={(e) => setDefaultUnit(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-[var(--muted)]">HSN / SAC</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              value={hsn_sac}
              onChange={(e) => setHsnSac(e.target.value)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-[var(--muted)]">Model / part no / description</span>
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={model_part_no_description}
            onChange={(e) => setModelPartNoDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium text-[var(--muted)]">Make / service provider</span>
          <input
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={make_service_provider}
            onChange={(e) => setMakeServiceProvider(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading} className={primaryButtonMd}>
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
