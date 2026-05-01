"use client";

import { useEffect } from "react";

/** Smooth-scroll to `#visitor-gate-checkin` when opening from the visitors list with `?gate=1`. */
export function ScrollToVisitorGate({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const el = document.getElementById("visitor-gate-checkin");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);
  return null;
}
