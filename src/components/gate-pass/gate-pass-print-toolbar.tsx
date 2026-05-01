"use client";

import Link from "next/link";
import { primaryButtonMd } from "@/lib/ui/primary-button";

export function GatePassPrintToolbar() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <Link href="/gate-passes" className="text-sky-600 underline">
        ← Back to gate passes
      </Link>
      <button type="button" className={primaryButtonMd} onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
