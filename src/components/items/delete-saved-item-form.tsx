"use client";

import { useFormStatus } from "react-dom";
import { deleteSavedItemPresetForm } from "@/app/(main)/packing-lists/masters-actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/50"
    >
      {pending ? "Removing…" : "Remove item"}
    </button>
  );
}

export function DeleteSavedItemForm({ itemId, blocked }: { itemId: string; blocked: boolean }) {
  return (
    <form
      action={deleteSavedItemPresetForm}
      onSubmit={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        if (
          !window.confirm(
            "Remove this item permanently? This cannot be undone. You can add it again later if it is not used on any document.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={itemId} />
      <SubmitButton disabled={blocked} />
    </form>
  );
}
