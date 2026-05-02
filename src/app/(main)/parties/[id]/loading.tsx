export default function PartyDetailLoading() {
  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div className="space-y-3">
        <div className="h-8 max-w-xs animate-pulse rounded-md bg-[var(--muted)]/15" />
        <div className="h-4 max-w-md animate-pulse rounded-md bg-[var(--muted)]/10" />
      </div>
      <div className="h-48 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/10" />
      <div className="h-48 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--muted)]/10" />
    </div>
  );
}
