import { useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS, OTHER_SECTION_ID } from "../lib/pageSections";
import { navigateToPage } from "../lib/navigation";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  getAtlasItems,
  isNew,
  NEW_WINDOW_DAYS,
  type AtlasItem,
} from "../lib/atlasCatalog";
import MasonryCard from "../components/atlas/MasonryCard";
import BoardCard from "../components/atlas/BoardCard";
import ListRow from "../components/atlas/ListRow";
import RecentRail from "../components/atlas/RecentRail";

export const title = "Pattern Atlas";
export const section = "patterns";
export const fullWidth = true;

/* Pattern Atlas — an exploration of gallery layouts for finding patterns in
 * the workspace fast. One catalogue, three ways to browse it:
 *
 *   · Masonry — a Pinterest-style staggered pin board for visual browsing
 *   · Board   — kanban columns grouped by section, for orienting by domain
 *   · List    — a dense, keyboard-friendly table for going straight to a name
 *
 * A Dribbble-style "Recently added" rail surfaces the newest work, and
 * search ("/" to focus), Recent/A–Z sorting, section chips and tag facets
 * narrow every view the same way. */

type ViewKey = "masonry" | "board" | "list";
type SortKey = "recent" | "title";

const VIEWS: { key: ViewKey; label: string; iconPath: string }[] = [
  {
    key: "masonry",
    label: "Masonry",
    // staggered columns
    iconPath:
      "M3 3.5A1.5 1.5 0 0 1 4.5 2h3A1.5 1.5 0 0 1 9 3.5v6A1.5 1.5 0 0 1 7.5 11h-3A1.5 1.5 0 0 1 3 9.5v-6ZM11 3.5A1.5 1.5 0 0 1 12.5 2h3A1.5 1.5 0 0 1 17 3.5v3A1.5 1.5 0 0 1 15.5 8h-3A1.5 1.5 0 0 1 11 6.5v-3ZM3 14.5A1.5 1.5 0 0 1 4.5 13h3A1.5 1.5 0 0 1 9 14.5v2A1.5 1.5 0 0 1 7.5 18h-3A1.5 1.5 0 0 1 3 16.5v-2ZM11 11.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-5Z",
  },
  {
    key: "board",
    label: "Board",
    // kanban columns
    iconPath:
      "M3 3.5A1.5 1.5 0 0 1 4.5 2h2A1.5 1.5 0 0 1 8 3.5v13A1.5 1.5 0 0 1 6.5 18h-2A1.5 1.5 0 0 1 3 16.5v-13ZM9.5 3.5A1.5 1.5 0 0 1 11 2h2a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 13 14h-2a1.5 1.5 0 0 1-1.5-1.5v-9ZM16 3.5A1.5 1.5 0 0 1 17.5 2h.25A1.5 1.5 0 0 1 19.25 3.5v5A1.5 1.5 0 0 1 17.75 10h-.25A1.5 1.5 0 0 1 16 8.5v-5Z",
  },
  {
    key: "list",
    label: "List",
    // stacked rows
    iconPath:
      "M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z",
  },
];

// Section chip order: known sections first, then Other if present.
const SECTION_ORDER = [
  ...SECTIONS.map((s) => ({ id: s.id, label: s.label })),
  { id: OTHER_SECTION_ID, label: "Other" },
];

const TAG_PREVIEW_COUNT = 12;

export default function PatternAtlasPage() {
  // Lazily built and cached — a stable reference across renders.
  const ATLAS_ITEMS = getAtlasItems();
  const [view, setView] = useLocalStorage<ViewKey>("atlas.view", "masonry");
  const [sort, setSort] = useState<SortKey>("recent");
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [showAllTags, setShowAllTags] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim().toLowerCase();
  const hasFilters =
    Boolean(trimmed) || activeSection !== null || activeTags.size > 0;

  // "/" focuses search from anywhere on the page (unless already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Only show section chips that actually have pages.
  const sectionChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of ATLAS_ITEMS)
      counts.set(item.section, (counts.get(item.section) ?? 0) + 1);
    return SECTION_ORDER.filter((s) => counts.has(s.id)).map((s) => ({
      ...s,
      count: counts.get(s.id) ?? 0,
    }));
  }, [ATLAS_ITEMS]);

  // Tag facets ranked by frequency; a preview by default, expandable to all.
  const tagChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of ATLAS_ITEMS)
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [ATLAS_ITEMS]);
  const visibleTagChips = showAllTags
    ? tagChips
    : tagChips.slice(0, TAG_PREVIEW_COUNT);

  const filtered = useMemo(() => {
    const items = ATLAS_ITEMS.filter((item) => {
      if (activeSection && item.section !== activeSection) return false;
      if (activeTags.size > 0 && !item.tags.some((t) => activeTags.has(t)))
        return false;
      if (trimmed) {
        const haystack =
          `${item.title} ${item.slug} ${item.description} ` +
          `${item.sectionLabel} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.toLowerCase().includes(trimmed)) return false;
      }
      return true;
    });
    if (sort === "recent") {
      return [...items].sort(
        (a, b) => b.addedAt - a.addedAt || a.title.localeCompare(b.title),
      );
    }
    return items; // already A–Z
  }, [ATLAS_ITEMS, trimmed, activeSection, activeTags, sort]);

  // Board view: the filtered items regrouped into section columns.
  const boardColumns = useMemo(() => {
    const bySection = new Map<string, AtlasItem[]>();
    for (const item of filtered) {
      const list = bySection.get(item.section);
      if (list) list.push(item);
      else bySection.set(item.section, [item]);
    }
    return SECTION_ORDER.filter((s) => bySection.has(s.id)).map((s) => ({
      ...s,
      items: bySection.get(s.id) ?? [],
    }));
  }, [filtered]);

  const recentItems = useMemo(
    () =>
      [...ATLAS_ITEMS]
        .filter((i) => i.addedAt > 0)
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 10),
    [ATLAS_ITEMS],
  );

  const newCount = useMemo(
    () => ATLAS_ITEMS.filter(isNew).length,
    [ATLAS_ITEMS],
  );

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setActiveSection(null);
    setActiveTags(new Set());
  }

  // Arrow keys move focus between list rows; Enter opens via the row button.
  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [
      ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button[data-atlas-row]",
      ),
    ];
    if (rows.length === 0) return;
    const idx = rows.findIndex((r) => r === document.activeElement);
    const next =
      e.key === "ArrowDown"
        ? Math.min(idx + 1, rows.length - 1)
        : Math.max(idx - 1, 0);
    rows[next]?.focus();
    e.preventDefault();
  }

  return (
    <div className="relative h-screen overflow-y-auto bg-stone-100 text-neutral-900">
      {/* Subtle paper texture: a dot grid fading out below the header. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(#a8a29e 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />

      {/* ---------- Header ---------- */}
      <header className="relative mx-auto max-w-7xl px-8 pb-6 pt-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-neutral-500 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {ATLAS_ITEMS.length} patterns · {sectionChips.length} sections
          {newCount > 0 && (
            <span className="text-emerald-600">
              · {newCount} new in {NEW_WINDOW_DAYS}d
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pattern Atlas
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
          Every pattern in the sandbox, three ways to find it: pin-board
          masonry for browsing, section boards for orienting, a dense list for
          going straight to a name. Press{" "}
          <kbd className="rounded border border-stone-300 bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">
            /
          </kbd>{" "}
          to search.
        </p>
      </header>

      {/* ---------- Sticky toolbar ---------- */}
      <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-100/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-8 py-3">
          {/* Search */}
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Search patterns, tags, sections…"
              aria-label="Search patterns"
              className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>

          {/* View switcher */}
          <div
            role="group"
            aria-label="View"
            className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm"
          >
            {VIEWS.map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                    className="h-3.5 w-3.5"
                  >
                    <path d={v.iconPath} />
                  </svg>
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div
            role="group"
            aria-label="Sort"
            className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm"
          >
            {(
              [
                { key: "recent", label: "Recent" },
                { key: "title", label: "A–Z" },
              ] as { key: SortKey; label: string }[]
            ).map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={active}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              Clear
            </button>
          )}

          <div className="ml-auto text-xs tabular-nums text-neutral-400">
            {filtered.length} / {ATLAS_ITEMS.length}
          </div>
        </div>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="relative mx-auto max-w-7xl px-8 pt-5">
        {/* Section chips (the board view already groups by section) */}
        {view !== "board" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              aria-pressed={activeSection === null}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeSection === null
                  ? "bg-neutral-900 text-white"
                  : "border border-stone-200 bg-white text-neutral-600 shadow-sm hover:border-stone-300 hover:text-neutral-900"
              }`}
            >
              All
            </button>
            {sectionChips.map((chip) => {
              const active = activeSection === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveSection(active ? null : chip.id)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "border border-stone-200 bg-white text-neutral-600 shadow-sm hover:border-stone-300 hover:text-neutral-900"
                  }`}
                >
                  {chip.label}
                  <span className="ml-1.5 opacity-50">{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tag facets */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Tags
          </span>
          {visibleTagChips.map(({ tag, count }) => {
            const active = activeTags.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "border border-stone-200 bg-white text-neutral-500 hover:border-stone-300 hover:text-neutral-900"
                }`}
              >
                #{tag}
                <span className="ml-1 opacity-50">{count}</span>
              </button>
            );
          })}
          {tagChips.length > TAG_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllTags((v) => !v)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-neutral-400 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              {showAllTags
                ? "Show fewer"
                : `+${tagChips.length - TAG_PREVIEW_COUNT} more`}
            </button>
          )}
        </div>
      </div>

      {/* ---------- Content ---------- */}
      <div className="relative mx-auto max-w-7xl px-8 py-8">
        {!hasFilters && view !== "board" && (
          <RecentRail items={recentItems} onOpen={navigateToPage} />
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
            <div className="text-3xl text-neutral-300">🗺️</div>
            <p className="mt-2 text-sm font-medium text-neutral-700">
              Nothing in the atlas matches
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Try a different search or clear the filters.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Clear filters
            </button>
          </div>
        ) : view === "masonry" ? (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
            {filtered.map((item) => (
              <MasonryCard
                key={item.slug}
                item={item}
                query={trimmed}
                onOpen={navigateToPage}
                onTagClick={toggleTag}
              />
            ))}
          </div>
        ) : view === "board" ? (
          <div className="-mx-2 flex items-start gap-4 overflow-x-auto px-2 pb-4 [scrollbar-width:thin]">
            {boardColumns.map((col) => (
              <section
                key={col.id}
                aria-label={col.label}
                className="w-72 shrink-0 rounded-2xl border border-stone-200/80 bg-stone-50/80"
              >
                <header className="sticky top-0 z-10 flex items-center gap-2 rounded-t-2xl border-b border-stone-200/80 bg-stone-50/95 px-4 py-3 backdrop-blur-sm">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: col.items[0]?.accent.from ?? "#64748b",
                    }}
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    {col.label}
                  </h3>
                  <span className="ml-auto rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-500">
                    {col.items.length}
                  </span>
                </header>
                <div className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:thin]">
                  {col.items.map((item) => (
                    <BoardCard
                      key={item.slug}
                      item={item}
                      query={trimmed}
                      onOpen={navigateToPage}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div
            role="list"
            aria-label="Patterns"
            onKeyDown={onListKeyDown}
            className="flex flex-col gap-1"
          >
            {/* Column legend (desktop only) */}
            <div className="hidden grid-cols-[72px_minmax(0,2fr)_minmax(0,1fr)_110px_90px] gap-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 sm:grid">
              <span />
              <span>Pattern</span>
              <span>Tags</span>
              <span>Section</span>
              <span className="text-right">Added</span>
            </div>
            {filtered.map((item) => (
              <ListRow
                key={item.slug}
                item={item}
                query={trimmed}
                onOpen={navigateToPage}
              />
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-stone-200 pt-4 text-[11px] text-neutral-400">
          Auto-generated from <code className="font-mono">src/pages</code> —
          new files appear here and in the Recently added rail. Views and
          filters: masonry / board / list, Recent and A–Z sort, section and
          tag facets, <kbd className="font-mono">/</kbd> to search,{" "}
          <kbd className="font-mono">↑↓</kbd> to move through the list view.
        </div>
      </div>
    </div>
  );
}
