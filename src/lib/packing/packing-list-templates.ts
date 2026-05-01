import type { PlanTier } from "@/types/database";
import type { PackingListTemplateId } from "@/lib/packing/types";

export const PACKING_LIST_TEMPLATE_IDS: PackingListTemplateId[] = [
  "basic",
  "standard_pro",
  "pro_navy",
  "pro_burgundy",
  "pro_slate",
  "max_teal",
  "max_amber",
  "max_charcoal",
];

const PRO_PLUS: PackingListTemplateId[] = [
  "basic",
  "standard_pro",
  "pro_navy",
  "pro_burgundy",
  "pro_slate",
];

const MAX_PLUS: PackingListTemplateId[] = [...PRO_PLUS, "max_teal", "max_amber", "max_charcoal"];

export function packingListTemplateOptionsForPlan(
  plan: PlanTier,
): { id: PackingListTemplateId; label: string }[] {
  if (plan === "free") {
    return [{ id: "basic", label: "Basic (classic)" }];
  }
  if (plan === "pro") {
    return [
      { id: "basic", label: "Basic (classic)" },
      { id: "standard_pro", label: "Standard Pro (emerald accent)" },
      { id: "pro_navy", label: "Pro — Navy executive" },
      { id: "pro_burgundy", label: "Pro — Burgundy formal" },
      { id: "pro_slate", label: "Pro — Cool slate" },
    ];
  }
  return [
    { id: "basic", label: "Basic (classic)" },
    { id: "standard_pro", label: "Standard Pro (emerald accent)" },
    { id: "pro_navy", label: "Pro — Navy executive" },
    { id: "pro_burgundy", label: "Pro — Burgundy formal" },
    { id: "pro_slate", label: "Pro — Cool slate" },
    { id: "max_teal", label: "Max — Pacific teal" },
    { id: "max_amber", label: "Max — Brushed gold" },
    { id: "max_charcoal", label: "Max — Carbon accent" },
  ];
}

export function normalizePackingListTemplateForSave(plan: PlanTier, requested: string): PackingListTemplateId {
  const allowed =
    plan === "free" ? (["basic"] as const) : plan === "pro" ? PRO_PLUS : MAX_PLUS;
  const id = (requested || "basic") as PackingListTemplateId;
  if ((allowed as readonly string[]).includes(id)) return id;
  return "basic";
}

/** Parse stored DB value for print/PDF (invalid → basic). */
export function parsePackingListTemplateId(raw: string | null | undefined): PackingListTemplateId {
  const s = (raw || "basic").trim();
  if ((PACKING_LIST_TEMPLATE_IDS as readonly string[]).includes(s)) return s as PackingListTemplateId;
  return "basic";
}

const TEMPLATE_LABELS: Record<PackingListTemplateId, string> = Object.fromEntries(
  packingListTemplateOptionsForPlan("max").map((o) => [o.id, o.label]),
) as Record<PackingListTemplateId, string>;

export function packingListTemplateLabel(id: PackingListTemplateId): string {
  return TEMPLATE_LABELS[id] ?? id;
}

export type PackingListPrintTheme = {
  shell: string;
  titleAccent: string;
  titleUnderline: string;
  headerRule: string;
  partyRule: string;
  thead: string;
  theadMuted: string;
  tableOuter: string;
  cellBorder: string;
  totalRow: string;
};

export function packingListPrintTheme(id: PackingListTemplateId): PackingListPrintTheme {
  const baseShell =
    "rounded-lg border bg-white p-6 text-slate-900 shadow-sm print:border-0 print:shadow-none md:p-10";
  switch (id) {
    case "standard_pro":
      return {
        shell: `${baseShell} border-emerald-100`,
        titleAccent: "border-emerald-700 text-emerald-900",
        titleUnderline: "decoration-emerald-700",
        headerRule: "border-slate-200",
        partyRule: "border-slate-300",
        thead: "bg-emerald-50",
        theadMuted: "text-slate-500",
        tableOuter: "border-slate-300",
        cellBorder: "border-slate-300",
        totalRow: "bg-emerald-50",
      };
    case "pro_navy":
      return {
        shell: `${baseShell} border-blue-200/90`,
        titleAccent: "border-blue-950 text-blue-950",
        titleUnderline: "decoration-blue-900",
        headerRule: "border-blue-200/80",
        partyRule: "border-blue-200/80",
        thead: "bg-[#0c1f3f] text-white",
        theadMuted: "text-blue-200",
        tableOuter: "border-blue-200/90",
        cellBorder: "border-blue-200/90",
        totalRow: "bg-blue-50",
      };
    case "pro_burgundy":
      return {
        shell: `${baseShell} border-rose-200/90`,
        titleAccent: "border-rose-900 text-rose-950",
        titleUnderline: "decoration-rose-800",
        headerRule: "border-rose-200/70",
        partyRule: "border-rose-200/70",
        thead: "bg-rose-100 text-rose-950",
        theadMuted: "text-rose-700/90",
        tableOuter: "border-rose-200/90",
        cellBorder: "border-rose-200/90",
        totalRow: "bg-rose-50",
      };
    case "pro_slate":
      return {
        shell: `${baseShell} border-slate-300`,
        titleAccent: "border-slate-700 text-slate-900",
        titleUnderline: "decoration-slate-600",
        headerRule: "border-slate-200",
        partyRule: "border-slate-300",
        thead: "bg-slate-200/90 text-slate-900",
        theadMuted: "text-slate-600",
        tableOuter: "border-slate-300",
        cellBorder: "border-slate-300",
        totalRow: "bg-slate-100",
      };
    case "max_teal":
      return {
        shell: `${baseShell} border-teal-200/80`,
        titleAccent: "border-teal-800 text-teal-950",
        titleUnderline: "decoration-teal-700",
        headerRule: "border-teal-100",
        partyRule: "border-teal-200/70",
        thead: "bg-teal-800 text-white",
        theadMuted: "text-teal-100",
        tableOuter: "border-teal-200/80",
        cellBorder: "border-teal-200/80",
        totalRow: "bg-teal-50",
      };
    case "max_amber":
      return {
        shell: `${baseShell} border-amber-200/90`,
        titleAccent: "border-amber-900 text-amber-950",
        titleUnderline: "decoration-amber-800",
        headerRule: "border-amber-200/70",
        partyRule: "border-amber-200/70",
        thead: "bg-amber-100 text-amber-950",
        theadMuted: "text-amber-800/90",
        tableOuter: "border-amber-200/90",
        cellBorder: "border-amber-200/90",
        totalRow: "bg-amber-50/90",
      };
    case "max_charcoal":
      return {
        shell: `${baseShell} border-slate-600 shadow-md print:shadow-none`,
        titleAccent: "border-slate-900 text-slate-900",
        titleUnderline: "decoration-slate-800",
        headerRule: "border-slate-300",
        partyRule: "border-slate-300",
        thead: "bg-slate-800 text-white",
        theadMuted: "text-slate-300",
        tableOuter: "border-slate-400",
        cellBorder: "border-slate-400",
        totalRow: "bg-slate-100",
      };
    default:
      return {
        shell: `${baseShell} border-slate-200`,
        titleAccent: "border-slate-800 text-slate-900",
        titleUnderline: "decoration-slate-800",
        headerRule: "border-slate-200",
        partyRule: "border-slate-300",
        thead: "bg-slate-100",
        theadMuted: "text-slate-500",
        tableOuter: "border-slate-300",
        cellBorder: "border-slate-300",
        totalRow: "bg-slate-100",
      };
  }
}

export type PackingListPdfTheme = {
  border: string;
  headerBg: string;
  headerFg: string;
  headerSub: string;
  accent: string;
  totalBg: string;
  optionalSub: string;
};

export function packingListPdfTheme(id: PackingListTemplateId): PackingListPdfTheme {
  switch (id) {
    case "standard_pro":
      return {
        border: "#a7f3d0",
        headerBg: "#ecfdf5",
        headerFg: "#0f172a",
        headerSub: "#64748b",
        accent: "#047857",
        totalBg: "#ecfdf5",
        optionalSub: "#475569",
      };
    case "pro_navy":
      return {
        border: "#93c5fd",
        headerBg: "#0c1f3f",
        headerFg: "#ffffff",
        headerSub: "#93c5fd",
        accent: "#0f2847",
        totalBg: "#eff6ff",
        optionalSub: "#475569",
      };
    case "pro_burgundy":
      return {
        border: "#fecdd3",
        headerBg: "#ffe4e6",
        headerFg: "#4c0519",
        headerSub: "#9f1239",
        accent: "#881337",
        totalBg: "#fff1f2",
        optionalSub: "#881337",
      };
    case "pro_slate":
      return {
        border: "#94a3b8",
        headerBg: "#e2e8f0",
        headerFg: "#0f172a",
        headerSub: "#475569",
        accent: "#334155",
        totalBg: "#f1f5f9",
        optionalSub: "#475569",
      };
    case "max_teal":
      return {
        border: "#5eead4",
        headerBg: "#115e59",
        headerFg: "#ffffff",
        headerSub: "#99f6e4",
        accent: "#0f766e",
        totalBg: "#ccfbf1",
        optionalSub: "#115e59",
      };
    case "max_amber":
      return {
        border: "#fcd34d",
        headerBg: "#fef3c7",
        headerFg: "#451a03",
        headerSub: "#b45309",
        accent: "#b45309",
        totalBg: "#fffbeb",
        optionalSub: "#92400e",
      };
    case "max_charcoal":
      return {
        border: "#475569",
        headerBg: "#1e293b",
        headerFg: "#f8fafc",
        headerSub: "#94a3b8",
        accent: "#0f172a",
        totalBg: "#e2e8f0",
        optionalSub: "#475569",
      };
    default:
      return {
        border: "#cbd5e1",
        headerBg: "#f1f5f9",
        headerFg: "#0f172a",
        headerSub: "#64748b",
        accent: "#0f172a",
        totalBg: "#f1f5f9",
        optionalSub: "#475569",
      };
  }
}
