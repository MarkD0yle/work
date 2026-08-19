import { useMemo, useState } from "react";
import {
  GhostButton,
  PanelBody,
  PanelFooter,
  PanelFrame,
  PanelHeader,
  PanelSection,
  PrimaryButton,
} from "./PanelKit";

/* 9 · Filter — faceted screen builder.
 *
 * The one panel that modifies the surface instead of describing it, which
 * inverts the usual relationship: the left pane is the output, and this column
 * is the control. So the result count updates live as facets are toggled while
 * the grid itself only redraws on Apply — feedback without thrash.
 *
 * Active facets are echoed as removable chips at the top because a filter you
 * cannot see is a filter you will blame the data for. Facet counts are shown
 * against the current result set, and zero-count options stay visible but
 * disabled rather than disappearing, so the list never shifts underfoot.
 */

type Facet = { id: string; label: string; count: number };

const FACET_GROUPS: { id: string; title: string; options: Facet[] }[] = [
  {
    id: "asset",
    title: "Asset class",
    options: [
      { id: "govt", label: "Government", count: 412 },
      { id: "credit", label: "Credit", count: 638 },
      { id: "agency", label: "Agency / supra", count: 154 },
      { id: "em", label: "Emerging markets", count: 0 },
    ],
  },
  {
    id: "ccy",
    title: "Currency",
    options: [
      { id: "eur", label: "EUR", count: 704 },
      { id: "gbp", label: "GBP", count: 231 },
      { id: "usd", label: "USD", count: 189 },
      { id: "chf", label: "CHF", count: 80 },
    ],
  },
  {
    id: "rating",
    title: "Rating band",
    options: [
      { id: "aaa", label: "AAA / AA", count: 296 },
      { id: "a", label: "A", count: 501 },
      { id: "bbb", label: "BBB", count: 407 },
      { id: "hy", label: "Sub-IG", count: 0 },
    ],
  },
];

const SAVED_VIEWS = ["EUR IG core", "Short duration", "New issues 30d"];

const ALL_OPTIONS = FACET_GROUPS.flatMap((g) =>
  g.options.map((o) => ({ ...o, group: g.title })),
);

export function ScreenFiltersPanel({ onClose }: { onClose?: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["eur", "credit"]),
  );
  const [maxDuration, setMaxDuration] = useState(8);
  const [savedView, setSavedView] = useState("EUR IG core");
  const [applied, setApplied] = useState(true);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setApplied(false);
  }

  // Live count as facets change — the panel's feedback loop.
  const resultCount = useMemo(() => {
    const base = 8730;
    const narrowed = ALL_OPTIONS.filter((o) => selected.has(o.id)).reduce(
      (acc, o) => acc + o.count,
      0,
    );
    const byDuration = Math.round((maxDuration / 15) * (narrowed || base));
    return Math.max(12, byDuration);
  }, [selected, maxDuration]);

  const activeChips = ALL_OPTIONS.filter((o) => selected.has(o.id));

  return (
    <PanelFrame label="Screen filters">
      <PanelHeader
        eyebrow="Filters"
        title="Cross-asset screen"
        subtitle={`${resultCount.toLocaleString()} of 8,730 instruments match`}
        onClose={onClose}
      />

      <PanelBody>
        <PanelSection title="Saved views" dense>
          <div className="flex flex-wrap gap-1.5">
            {SAVED_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSavedView(v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  savedView === v
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </PanelSection>

        {activeChips.length > 0 && (
          <PanelSection
            title="Active"
            dense
            trailing={
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setApplied(false);
                }}
                className="text-[11px] font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
              >
                Clear all
              </button>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-0.5 pr-1.5 pl-2 text-[11px] text-neutral-700 hover:bg-neutral-200"
                >
                  {c.label}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-neutral-400">
                    <path
                      fillRule="evenodd"
                      d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </PanelSection>
        )}

        {FACET_GROUPS.map((g) => (
          <PanelSection key={g.id} title={g.title} dense>
            <ul className="space-y-0.5">
              {g.options.map((o) => {
                const empty = o.count === 0;
                return (
                  <li key={o.id}>
                    <label
                      className={`flex items-center gap-2.5 rounded px-1 py-1 ${
                        empty
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={empty}
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                        className="h-3.5 w-3.5 accent-neutral-900"
                      />
                      <span className="min-w-0 flex-1 text-xs text-neutral-900">
                        {o.label}
                      </span>
                      <span className="shrink-0 text-[11px] text-neutral-400 tabular-nums">
                        {o.count.toLocaleString()}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </PanelSection>
        ))}

        <PanelSection title="Modified duration" dense last>
          <input
            type="range"
            min={1}
            max={15}
            value={maxDuration}
            onChange={(e) => {
              setMaxDuration(Number(e.target.value));
              setApplied(false);
            }}
            aria-label="Maximum modified duration"
            className="w-full accent-neutral-900"
          />
          <div className="flex justify-between text-[11px] text-neutral-500 tabular-nums">
            <span>1.0</span>
            <span className="font-medium text-neutral-900">
              up to {maxDuration.toFixed(1)}
            </span>
            <span>15.0</span>
          </div>
        </PanelSection>
      </PanelBody>

      <PanelFooter
        note={
          applied
            ? "Grid is in sync with these filters."
            : `${resultCount.toLocaleString()} rows pending — apply to update the grid.`
        }
      >
        <PrimaryButton onClick={() => setApplied(true)} disabled={applied}>
          {applied ? "Applied" : `Apply (${resultCount.toLocaleString()})`}
        </PrimaryButton>
        <GhostButton
          onClick={() => {
            setSelected(new Set(["eur", "credit"]));
            setMaxDuration(8);
            setApplied(true);
          }}
        >
          Reset
        </GhostButton>
      </PanelFooter>
    </PanelFrame>
  );
}
