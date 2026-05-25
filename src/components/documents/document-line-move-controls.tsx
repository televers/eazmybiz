"use client";

const moveBtn =
  "h-6 w-7 shrink-0 rounded border border-[var(--border)] bg-[var(--card)] text-xs leading-none text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40";

export function DocumentLineMoveControls({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  if (total <= 1) {
    return <span className="tabular-nums text-[var(--muted)]">{index + 1}</span>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        className={moveBtn}
        disabled={index === 0}
        title="Move line up"
        aria-label="Move line up"
        onClick={() => onMove(index, -1)}
      >
        ↑
      </button>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">{index + 1}</span>
      <button
        type="button"
        className={moveBtn}
        disabled={index === total - 1}
        title="Move line down"
        aria-label="Move line down"
        onClick={() => onMove(index, 1)}
      >
        ↓
      </button>
    </div>
  );
}
