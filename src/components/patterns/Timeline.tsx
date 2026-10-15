import type { ReactNode } from "react";
import { cx, radius, text, tone as toneTokens, type Tone } from "./tokens";

/* Timeline — what happened, in order.
 *
 * Audit trails, order history, activity feeds. Each event: who, what,
 * when, and an optional detail (diff, comment, reason code). Newest first
 * by default, because the latest state is usually the question. Never
 * edit or collapse audit events; filter them instead. */

export type TimelineEvent = {
  id: string;
  /** Display time, e.g. "14:32:05" or "12 Oct, 09:10". */
  at: string;
  /** Machine time for <time dateTime>. */
  iso?: string;
  title: ReactNode;
  actor?: string;
  detail?: ReactNode;
  tone?: Tone;
};

export function Timeline({
  events,
  label,
  emptyText = "No activity yet",
}: {
  events: TimelineEvent[];
  /** Accessible name, e.g. "Order history". */
  label: string;
  emptyText?: string;
}) {
  if (events.length === 0) return <p className={cx("px-1 py-4", text.muted)}>{emptyText}</p>;
  return (
    <ol aria-label={label} className="relative">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute top-3 bottom-0 left-[4.5px] w-px bg-neutral-200" />}
          <span aria-hidden className={cx("relative mt-1 h-2.5 w-2.5 shrink-0 ring-2 ring-white", radius.pill, toneTokens[e.tone ?? "neutral"].solid)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <div className="text-xs font-medium text-neutral-900">{e.title}</div>
              <time dateTime={e.iso} className="text-[11px] text-neutral-500 tabular-nums">
                {e.at}
              </time>
            </div>
            {e.actor && <div className={text.muted}>{e.actor}</div>}
            {e.detail && <div className="mt-1 border-l-2 border-neutral-200 pl-2 text-xs text-neutral-600">{e.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
