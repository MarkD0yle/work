import GalleryThumb from "../gallery/GalleryThumb";
import { cx, tone, type Tone } from "../patterns/tokens";
import type { CatalogueItem } from "../../hooks/usePageCatalogue";
import { accentForSection, metaForSlug } from "../../lib/galleryMeta";
import type { DriftLevel } from "../../lib/pageIntel";
import { formatFeedDate, type FeedItem } from "../../lib/whatsNew";

/* Landing-page previews — the small visuals shown in each rotating feature
 * section. They are drawn from live data (real screens, real drift counts,
 * the real feed) so the landing page never promises something that is not
 * there. Each fills the fixed-height stage FeatureShowcase gives it. */

function Thumb({ item, seed }: { item: CatalogueItem; seed: number }) {
  return (
    <GalleryThumb
      motif={metaForSlug(item.slug, item.section).motif}
      accent={accentForSection(item.section)}
      seed={seed}
    />
  );
}

function Caption({ children }: { children: string }) {
  return <p className="truncate text-xs font-medium text-neutral-800">{children}</p>;
}

/** Three screens from one area of the gallery. */
export function ScreensPreview({ items, total, label }: { items: CatalogueItem[]; total: number; label: string }) {
  return (
    <div className="flex min-h-0 flex-col justify-center gap-4">
      <p className="text-sm text-neutral-500">
        <span className="font-semibold text-neutral-950 tabular-nums">{total}</span> screens in {label}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={item.slug} className="min-w-0">
            <div className="aspect-[16/10] overflow-hidden border border-neutral-200">
              <Thumb item={item} seed={i + 1} />
            </div>
            <div className="mt-2">
              <Caption>{item.title}</Caption>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A prompt, as it would be copied. */
export function PromptPreview({ lines }: { lines: string[] }) {
  return (
    <div className="flex min-h-0 flex-col bg-neutral-950">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-neutral-700" />
        <span className="h-2 w-2 rounded-full bg-neutral-700" />
        <span className="ml-2 font-mono text-[11px] text-neutral-500">prompt.txt</span>
      </div>
      <pre className="min-h-0 flex-1 overflow-hidden p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-200">
        {lines.join("\n")}
      </pre>
    </div>
  );
}

const LEVEL_TONE: Record<DriftLevel, Tone> = {
  high: "negative",
  medium: "warning",
  low: "info",
  clean: "positive",
};

export type DriftRow = {
  slug: string;
  title: string;
  points: number;
  level: DriftLevel;
  drift: { radius: number; hex: number; inlineStyle: number };
};

/** The screens with the most drift right now. */
export function DriftPreview({ rows }: { rows: DriftRow[] }) {
  return (
    <div className="flex min-h-0 flex-col justify-center">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b border-neutral-200 pb-2 text-[11px] font-medium text-neutral-500">
        <span>Screen</span>
        <span className="text-right">Points</span>
        <span>Level</span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <li key={row.slug} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-neutral-900">{row.title}</span>
              <span className="block truncate text-[11px] text-neutral-500">
                {row.drift.radius} rounded · {row.drift.hex} hex · {row.drift.inlineStyle} inline
              </span>
            </span>
            <span className="text-right text-sm font-semibold tabular-nums">{row.points}</span>
            <span
              className={cx(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                tone[LEVEL_TONE[row.level]].soft,
              )}
            >
              {row.level}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How many screens sit at each drift level. */
export function DriftSummaryPreview({ counts }: { counts: Record<DriftLevel, number> }) {
  const order: DriftLevel[] = ["clean", "low", "medium", "high"];
  return (
    <div className="grid grid-cols-2 content-center gap-3">
      {order.map((level) => (
        <div key={level} className={cx("border-l-4 bg-neutral-50 p-4", tone[LEVEL_TONE[level]].rail)}>
          <div className="text-3xl font-semibold tracking-tight text-neutral-950 tabular-nums">{counts[level]}</div>
          <div className="mt-1 text-xs text-neutral-600 capitalize">{level}</div>
        </div>
      ))}
    </div>
  );
}

/** A running order of screens. */
export function ReelPreview({ items }: { items: CatalogueItem[] }) {
  return (
    <div className="flex min-h-0 flex-col justify-center gap-4">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item, i) => (
          <div key={item.slug} className="min-w-0">
            <div className={cx("relative aspect-[16/10] overflow-hidden border", i === 0 ? "border-neutral-950" : "border-neutral-200")}>
              <Thumb item={item} seed={i + 3} />
              <span className="absolute top-1 left-1 bg-neutral-950 px-1 text-[10px] font-semibold text-white tabular-nums">
                {i + 1}
              </span>
            </div>
            <div className="mt-1.5">
              <Caption>{item.title}</Caption>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 bg-neutral-950 px-3 py-2 text-xs text-white">
        <span className="tabular-nums text-neutral-400">1 / {items.length}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{items[0]?.title}</span>
        <span className="text-neutral-400">Back</span>
        <span>Pause</span>
        <span className="text-neutral-400">Next</span>
      </div>
    </div>
  );
}

/** Two screens next to each other. */
export function ComparePreview({ a, b }: { a?: CatalogueItem; b?: CatalogueItem }) {
  const panes = [
    { label: "A", item: a },
    { label: "B", item: b },
  ];
  return (
    <div className="grid grid-cols-2 content-center gap-3">
      {panes.map(
        ({ label, item }, i) =>
          item && (
            <div key={label} className="min-w-0 border border-neutral-200">
              <div className="flex items-center gap-2 border-b border-neutral-200 p-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center bg-neutral-950 text-[10px] font-semibold text-white">
                  {label}
                </span>
                <Caption>{item.title}</Caption>
              </div>
              <div className="aspect-[16/10]">
                <Thumb item={item} seed={i + 7} />
              </div>
            </div>
          ),
      )}
    </div>
  );
}

/** The latest entries in the What's New feed. */
export function FeedPreview({ items }: { items: FeedItem[] }) {
  return (
    <ul className="flex min-h-0 flex-col justify-center divide-y divide-neutral-100">
      {items.map((item) => (
        <li key={item.id} className="py-3">
          <p className="text-[11px] font-medium text-indigo-600">
            {item.kind === "feature" ? "New feature" : "New screen"} · {formatFeedDate(item.ts)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-950">{item.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">{item.summary}</p>
        </li>
      ))}
    </ul>
  );
}

/** A tour step card, as it appears during a walk-through. */
export function TourPreview() {
  return (
    <div className="grid place-items-center bg-neutral-50">
      <div className="w-full max-w-xs border border-neutral-950 bg-white shadow-lg">
        <div className="flex justify-between border-b border-neutral-200 px-3 py-2 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          <span>Welcome tour · 2 of 5</span>
          <span>Skip</span>
        </div>
        <div className="px-3 py-3">
          <p className="text-sm font-semibold text-neutral-950">Find a screen</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            Every screen lives in the gallery, grouped by area.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={cx("h-1.5 w-1.5 rounded-full", i === 1 ? "bg-neutral-950" : "bg-neutral-300")} />
            ))}
          </div>
          <span className="text-xs text-neutral-500">Back</span>
          <span className="bg-neutral-950 px-2 py-1 text-xs font-medium text-white">Next</span>
        </div>
      </div>
    </div>
  );
}
