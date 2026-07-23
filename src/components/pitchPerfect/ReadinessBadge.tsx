import type { Readiness } from "../../lib/pitchPerfect/types";

const DOT: Record<Readiness, string> = {
  empty: "bg-neutral-300",
  partial: "bg-amber-400",
  complete: "bg-emerald-500",
};

export function ReadinessBadge({ readiness, title }: { readiness: Readiness; title?: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[readiness]}`} aria-hidden title={title} />;
}
