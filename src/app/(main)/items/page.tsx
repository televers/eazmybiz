import { getOrgContext } from "@/lib/org";
import { NewItemForm } from "@/app/(main)/packing-lists/saved/items/ui";

export default async function ItemsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Add New Item or Edit Saved Item</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Add a new item below, or select an item in the list to edit it.
        </p>
      </div>

      <div id="add-item" className="scroll-mt-6">
        <NewItemForm />
      </div>
    </div>
  );
}
