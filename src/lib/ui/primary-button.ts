/**
 * Canonical solid primary actions (sky) for the portal.
 * Use for main CTAs: Add, New, Save, Submit. Keep destructive (red) and ghost/link styles separate.
 */
const base =
  "rounded-md bg-sky-600 font-medium text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50";

/** Page / form default (e.g. Save, New quotation). */
export const primaryButtonMd = `${base} px-4 py-2 text-sm`;

const secondarySkyBase =
  "rounded-md border border-sky-600 bg-transparent font-medium text-sky-600 hover:bg-sky-600/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50 dark:border-sky-500 dark:text-sky-400 dark:hover:bg-sky-500/15";

/** Outlined sky — secondary action beside primary (e.g. Issue pass next to Save). */
export const secondarySkyButtonMd = `${secondarySkyBase} px-4 py-2 text-sm`;

/** Table / dense secondary (e.g. Open detail to issue pass). */
export const secondarySkyButtonXs = `${secondarySkyBase} shrink-0 px-2.5 py-1 text-xs`;

/** Toolbar / card header (e.g. Add new quotation in a table section). */
export const primaryButtonCompact = `${base} shrink-0 px-3 py-1.5 text-sm`;

/** Narrow sidebar header (e.g. Add new item next to list title). */
export const primaryButtonXs = `${base} shrink-0 px-2.5 py-1 text-xs`;

/** Full-width sidebar primary (e.g. Add party). */
export const primaryButtonBlock = `${base} w-full px-3 py-2 text-sm`;
