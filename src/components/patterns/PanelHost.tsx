import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { border, button, cx, focus, surface, text } from "./tokens";

/* PanelHost — the work surface plus the side panel that docks beside it.
 *
 * SplitView fixes the panel open at one width. PanelHost is for screens where
 * the panel comes and goes:
 *  - push:    the main area makes room (grid column). Use when the user reads
 *             the panel against the list, so both must stay visible.
 *  - overlay: the panel floats over the right edge, main does not reflow. Use
 *             over wide tables, where a reflow would shift the row you clicked.
 *  - Below `lg` the panel is always an overlay.
 *
 * The user can step the width (S / M / L) and collapse the panel to a rail
 * that keeps the selection. Width is stepped, not dragged, because patterns
 * carry no inline styles; the separator is a keyboard control too
 * (← wider, → narrower). Esc closes from inside the panel. Focus is not moved
 * on open; if it was inside the panel when it closes, it returns to where it
 * was before. */

const WIDTHS = ["sm", "md", "lg"] as const;
export type PanelWidth = (typeof WIDTHS)[number];

const PUSH: Record<PanelWidth, { open: string; rail: string }> = {
  sm: { open: "lg:grid-cols-[1fr_20rem]", rail: "lg:grid-cols-[1fr_2.5rem]" },
  md: { open: "lg:grid-cols-[1fr_26rem]", rail: "lg:grid-cols-[1fr_2.5rem]" },
  lg: { open: "lg:grid-cols-[1fr_32rem]", rail: "lg:grid-cols-[1fr_2.5rem]" },
};
const OVERLAY: Record<PanelWidth, string> = { sm: "lg:w-80", md: "lg:w-[26rem]", lg: "lg:w-[32rem]" };

export function PanelHost({
  main,
  panel,
  open,
  onClose,
  mode = "push",
  initialWidth = "md",
  label,
}: {
  main: ReactNode;
  panel: ReactNode;
  /** Whether something is selected. False hides the panel and the rail. */
  open: boolean;
  onClose: () => void;
  mode?: "push" | "overlay";
  initialWidth?: PanelWidth;
  /** Accessible name for the panel region, e.g. "Order detail". */
  label: string;
}) {
  const [size, setSize] = useState<PanelWidth>(initialWidth);
  const [collapsed, setCollapsed] = useState(false);

  // Remember where focus was when the panel opened. When the panel closes
  // with focus inside it, the browser drops focus to <body>; give it back.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (document.activeElement === document.body) opener?.focus?.();
    };
  }, [open]);

  function step(dir: 1 | -1) {
    setSize((s) => WIDTHS[Math.min(WIDTHS.length - 1, Math.max(0, WIDTHS.indexOf(s) + dir))]);
  }

  function onResizeKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(-1);
    }
  }

  const showRail = open && collapsed;
  const showPanel = open && !collapsed;

  return (
    <div
      className={cx(
        "relative grid h-full min-h-0 grid-cols-1",
        mode === "push" && open && (collapsed ? PUSH[size].rail : PUSH[size].open),
        border.default,
        surface.card,
      )}
    >
      <div className="min-h-0 min-w-0 overflow-auto">{main}</div>

      {showRail && (
        <div className={cx("flex min-h-0 flex-col items-center border-l pt-2", border.divider, surface.sunken, mode === "overlay" && "absolute inset-y-0 right-0 w-10")}>
          <button type="button" onClick={() => setCollapsed(false)} aria-label={`Expand ${label}`} className={cx(button.ghost, "px-1.5")}>
            «
          </button>
          <span className={cx("mt-3 [writing-mode:vertical-rl]", text.eyebrow)}>{label}</span>
        </div>
      )}

      {showPanel && (
        <div
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          className={cx(
            "flex min-h-0 min-w-0 border-l shadow-lg lg:shadow-none",
            border.divider,
            surface.card,
            "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:w-full max-lg:max-w-md",
            mode === "overlay" && cx("absolute inset-y-0 right-0 z-20 lg:shadow-lg", OVERLAY[size]),
          )}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${label}`}
            aria-valuemin={0}
            aria-valuemax={WIDTHS.length - 1}
            aria-valuenow={WIDTHS.indexOf(size)}
            aria-valuetext={{ sm: "Narrow", md: "Medium", lg: "Wide" }[size]}
            tabIndex={0}
            onKeyDown={onResizeKey}
            onDoubleClick={() => setSize("md")}
            className={cx("hidden w-1 shrink-0 cursor-col-resize hover:bg-neutral-300 focus-visible:bg-neutral-900 lg:block", focus)}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className={cx("flex items-center justify-between border-b px-3 py-1", border.divider, surface.sunken)}>
              <div role="group" aria-label="Panel width" className="flex">
                {WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={size === w}
                    onClick={() => setSize(w)}
                    className={cx("px-1.5 py-0.5 text-[10px] font-semibold uppercase", size === w ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-200", focus)}
                  >
                    {w === "sm" ? "S" : w === "md" ? "M" : "L"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setCollapsed(true)} aria-label={`Collapse ${label}`} className={cx(button.ghost, "px-1.5 py-0.5")}>
                »
              </button>
            </div>
            <div className="min-h-0 flex-1" role="region" aria-label={label}>
              {panel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
