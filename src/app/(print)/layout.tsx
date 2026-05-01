import type { ReactNode } from "react";

/** Print-friendly routes: no app shell so browser print / preview matches the document only. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
