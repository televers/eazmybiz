/**
 * Wide document lists (quotations, packing lists, etc.): horizontal scroll below `lg` only.
 * At `lg` and up, tables stay full-width inside the card with no scroll — same as before.
 */

/** Wrap the `<table>` (inside a bordered card). Enables touch panning and overflow-x scroll on narrow viewports. */
export const documentListTableScrollAreaClassName =
  "max-lg:-mx-1 max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:touch-pan-x max-lg:[-webkit-overflow-scrolling:touch] max-lg:pb-1 max-lg:[scrollbar-width:thin] lg:mx-0 lg:overflow-visible lg:pb-0";

/** Keep columns from collapsing when the viewport is narrower than the table. */
export const documentListTableMinWidthClassName = "min-w-[960px]";

export const documentListTableClassName = `w-full ${documentListTableMinWidthClassName} text-left text-sm`;

/** Bordered list card (no horizontal scroll on the root — use scroll area around the table). */
export const documentListTableCardClassName = "overflow-hidden rounded-lg border border-[var(--border)]";

export const documentListTableCardWithBgClassName = `${documentListTableCardClassName} bg-[var(--card)]`;
