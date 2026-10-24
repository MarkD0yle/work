import type { ReactNode } from "react";
import { border, cx, surface } from "./tokens";

/* Skeleton — the shape of what is loading, in grey.
 *
 * Use while data for a known layout is on its way: a table, a card, a side
 * panel. It beats a spinner because the page doesn't jump when the data lands,
 * and the user can see what is coming. Build the skeleton from the same
 * layout as the loaded view (same columns, same card heights) or the jump
 * comes back.
 *
 * Don't use it for waits under about 300ms (it flashes), or for work with no
 * known shape, like running a report; show progress text for that. The
 * wrapper is `aria-busy` with one hidden "Loading" label, so a screen reader
 * hears one message instead of forty grey boxes. Pulse stops for people who
 * ask for reduced motion. */

const PULSE = "bg-neutral-200 motion-safe:animate-pulse";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cx(PULSE, className)} />;
}

/** Text placeholder. `width` is a Tailwind width class so lines vary. */
export function SkeletonLine({ width = "w-full", className }: { width?: string; className?: string }) {
  return <div aria-hidden className={cx("h-3", PULSE, width, className)} />;
}

function Busy({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const LINE_WIDTHS = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-1/3"] as const;

export function SkeletonTable({ rows = 6, columns = 5, label = "Loading table" }: { rows?: number; columns?: number; label?: string }) {
  return (
    <Busy label={label} className={cx(border.default, surface.card)}>
      <div className="flex gap-4 border-b border-neutral-200 px-3 py-2.5">
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className="flex-1">
            <SkeletonLine width="w-1/2" className="h-2.5 bg-neutral-300" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-neutral-100 px-3 py-2.5 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="flex-1">
              <SkeletonLine width={LINE_WIDTHS[(r + c) % LINE_WIDTHS.length]} />
            </div>
          ))}
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonCard({ label = "Loading" }: { label?: string }) {
  return (
    <Busy label={label} className={cx("p-4", border.default, surface.card)}>
      <SkeletonLine width="w-1/3" className="h-2.5" />
      <SkeletonBlock className="mt-3 h-7 w-1/2" />
      <SkeletonLine width="w-2/3" className="mt-3" />
    </Busy>
  );
}

/** Stands in for a ContextPanel while its record loads. */
export function SkeletonPanel({ label = "Loading details" }: { label?: string }) {
  return (
    <Busy label={label} className="flex h-full flex-col bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <SkeletonLine width="w-1/4" className="h-2.5" />
        <SkeletonBlock className="mt-2 h-5 w-2/3" />
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="border-b border-neutral-200 px-5 py-4">
          <SkeletonLine width="w-1/4" className="h-2.5" />
          <div className="mt-3 flex flex-col gap-2.5">
            {LINE_WIDTHS.slice(0, 4).map((w) => (
              <SkeletonLine key={w} width={w} />
            ))}
          </div>
        </div>
      ))}
    </Busy>
  );
}
