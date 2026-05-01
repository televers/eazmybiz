import Link from "next/link";

export function LegalDocLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl px-4 py-10 pb-16">
        <p className="mb-6 text-sm">
          <Link href="/" className="text-sky-600 hover:underline dark:text-sky-400">
            ← Back to home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Last updated: {lastUpdated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--foreground)]">{children}</div>
      </div>
    </div>
  );
}
