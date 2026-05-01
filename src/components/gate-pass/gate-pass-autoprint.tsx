"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function AutoprintInner() {
  const search = useSearchParams();
  useEffect(() => {
    if (search.get("autoprint") !== "1") return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [search]);
  return null;
}

export function GatePassAutoprint() {
  return (
    <Suspense fallback={null}>
      <AutoprintInner />
    </Suspense>
  );
}
