export type SectionNavStatus = "empty" | "partial" | "complete";

export type SectionNavItem = { id: string; label: string; status: SectionNavStatus; summary: string };

const DOT: Record<SectionNavStatus, string> = {
  empty: "bg-neutral-300",
  partial: "bg-amber-400",
  complete: "bg-emerald-500",
};

/* Persistent step navigation: every section's status and a one-line summary
 * of what it already contains are visible without clicking into it — only
 * the active section's full content is shown, one at a time, but nothing is
 * hidden behind a collapse/expand click. Same pattern as NarrativeRail. */
export function SectionNav({
  items,
  activeId,
  onSelect,
}: {
  items: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition ${
                active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
              }`}
            >
              <span
                className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : DOT[item.status]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${active ? "text-white" : "text-neutral-800"}`}>{item.label}</span>
                <span className={`mt-0.5 block truncate text-[11px] ${active ? "text-white/60" : "text-neutral-400"}`}>{item.summary}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
