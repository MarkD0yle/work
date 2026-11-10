import { useMemo, useState } from "react";
import { EmptyState, PageHeader, SectionCard, SegmentedControl } from "../components/patterns";
import { button, cx, focus, text, tone, type Tone } from "../components/patterns/tokens";
import { usePageCatalogue } from "../hooks/usePageCatalogue";
import { useCopy } from "../hooks/useCopy";
import { HOUSE_RULES } from "../lib/houseRules";
import { navigateToPage } from "../lib/navigation";
import { DRIFT_LEVELS, driftForSlug, type DriftLevel, type PageDrift } from "../lib/pageIntel";

export const title = "Drift Radar";
export const section = "patterns";
export const fullWidth = true;

/* Drift Radar — which screens have drifted from the design rules.
 *
 * Screens built by prompting pick up rounded corners, raw hex colours and
 * inline styles one prompt at a time. This page counts them per screen from
 * a build-time scan (scripts/pageIntel.ts) so the team can see where to tidy
 * up. The counts are estimates: a chart that needs a hex colour is fine.
 * Read a high score as "review this", not "this is wrong". */

type Row = { slug: string; title: string; sectionLabel: string } & PageDrift;

type Filter = "all" | DriftLevel;
type Sort = "points" | "density" | "title";

const LEVEL_TONE: Record<DriftLevel, Tone> = {
  high: "negative",
  medium: "warning",
  low: "info",
  clean: "positive",
};

const SORTS: { value: Sort; label: string }[] = [
  { value: "points", label: "Most drift" },
  { value: "density", label: "Densest" },
  { value: "title", label: "A–Z" },
];

const MEASURED_RULES = HOUSE_RULES.filter((r) =>
  ["radius", "colour", "inline-style"].includes(r.id),
);

function fixPrompt(row: Row) {
  return [
    `Tidy up src/pages/${row.slug}.tsx (${row.title}) and the files it imports so it follows the house rules.`,
    "",
    `A scan found: ${row.drift.radius} rounded-corner classes, ${row.drift.hex} hex colours, ${row.drift.inlineStyle} inline styles.`,
    "",
    "Rules:",
    ...MEASURED_RULES.map((r, i) => `${i + 1}. ${r.instruction}`),
    "",
    "Do not change behaviour, layout or copy. Leave a hex colour or inline style in place only where a chart or SVG needs a computed value, and say which ones you kept.",
    "When you are done, run `npm run lint` and `npm run build`.",
  ].join("\n");
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-neutral-200 bg-white p-4">
      <div className={text.eyebrow}>{label}</div>
      <div className={cx("mt-1", text.value)}>{value}</div>
      <div className={cx("mt-1", text.muted)}>{note}</div>
    </div>
  );
}

export default function DriftRadarPage() {
  const catalogue = usePageCatalogue();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("points");
  const [query, setQuery] = useState("");
  const { copied, copy } = useCopy();

  const rows = useMemo<Row[]>(
    () =>
      catalogue.flatMap((item) => {
        const drift = driftForSlug(item.slug);
        return drift ? [{ ...item, ...drift }] : [];
      }),
    [catalogue],
  );

  const counts = useMemo(() => {
    const by: Record<DriftLevel, number> = { high: 0, medium: 0, low: 0, clean: 0 };
    for (const row of rows) by[row.level] += 1;
    return by;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => filter === "all" || row.level === filter)
      .filter((row) => !q || `${row.title} ${row.slug} ${row.sectionLabel}`.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : b[sort] - a[sort] || a.title.localeCompare(b.title),
      );
  }, [rows, filter, sort, query]);

  const filterOptions = [
    { value: "all" as Filter, label: "All", count: rows.length },
    ...DRIFT_LEVELS.map((l) => ({ value: l.id as Filter, label: l.label, count: counts[l.id] })),
  ];

  return (
    <div className="h-screen overflow-y-auto bg-neutral-50">
      <PageHeader
        className="pl-32"
        eyebrow="Tools"
        title="Drift Radar"
        description="Which screens have drifted from the design rules. Estimates from a source scan: review, don't assume."
      />
      <div className="mx-auto grid max-w-6xl gap-4 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Screens scanned" value={String(rows.length)} note="Each page plus the files it imports" />
          <Stat label="Clean" value={String(counts.clean)} note="No drift found" />
          <Stat label="High drift" value={String(counts.high)} note="6+ points per 100 lines" />
          <Stat
            label="Rounded corners"
            value={String(rows.reduce((sum, row) => sum + row.drift.radius, 0))}
            note="Breaks the zero-radius rule"
          />
        </div>

        <SectionCard
          flush
          title="Screens"
          subtitle="Points = rounded corners × 3 + hex colours × 2 + inline styles × 1"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 p-3">
            <SegmentedControl label="Drift level" options={filterOptions} value={filter} onChange={setFilter} />
            <SegmentedControl label="Sort" options={SORTS} value={sort} onChange={setSort} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter screens…"
              aria-label="Filter screens"
              className={cx(
                "ml-auto w-full rounded-none border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:w-56",
                focus,
              )}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState
              kind="filtered"
              title="No screens match"
              description="Try a different level or clear the filter."
              action={{
                label: "Show all",
                onClick: () => {
                  setFilter("all");
                  setQuery("");
                },
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Screen</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Lines</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Rounded</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Hex</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Inline</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Points</th>
                    <th scope="col" className="px-3 py-2 font-medium">Level</th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visible.map((row) => (
                    <tr key={row.slug} className="hover:bg-neutral-50">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => navigateToPage(row.slug)}
                          className={cx("text-left font-medium text-neutral-900 hover:underline", focus)}
                        >
                          {row.title}
                        </button>
                        <div className="text-[11px] text-neutral-500">{row.sectionLabel}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{row.lines.toLocaleString("en-GB")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.drift.radius}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.drift.hex}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.drift.inlineStyle}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.points}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cx(
                            "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                            tone[LEVEL_TONE[row.level]].soft,
                          )}
                        >
                          {row.level}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.level !== "clean" && (
                          <button
                            type="button"
                            className={button.secondary}
                            onClick={() => copy(row.slug, fixPrompt(row))}
                          >
                            {copied === row.slug ? "Copied" : "Copy fix prompt"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
