import { getOrgContext } from "@/lib/org";

export default async function PartiesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Parties</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Use <strong>Add party</strong> to add a party, select one on the left to see related documents, or use the edit
          icon to manage addresses.
        </p>
      </div>
    </div>
  );
}
