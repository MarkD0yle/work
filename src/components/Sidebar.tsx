import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SECTIONS, OTHER_SECTION_ID } from "../lib/pageSections";
import { useLocalStorage } from "../hooks/useLocalStorage";

type PageEntry = {
  slug: string;
  title: string;
  section: string;
};

type SidebarProps = {
  pages: PageEntry[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

type SectionGroup = {
  id: string;
  label: string;
  iconPath: string;
  pages: PageEntry[];
};

// Section order for rendering. Known sections first (in declared order),
// then a synthetic "Other" bucket for anything unmapped.
const OTHER_DEF = {
  id: OTHER_SECTION_ID,
  label: "Other",
  iconPath:
    "M3 4.75A.75.75 0 0 1 3.75 4h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75ZM3 10a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10Zm0 5.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z",
};

const ALL_SECTION_DEFS = [...SECTIONS, OTHER_DEF];

const RECENT_MAX = 4;

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0 opacity-70"
    >
      <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5C2 16.216 2.784 17 3.75 17h12.5A1.75 1.75 0 0 0 18 15.25V7.75A1.75 1.75 0 0 0 16.25 6H10.5a.75.75 0 0 1-.53-.22L8.69 4.5A1.75 1.75 0 0 0 7.46 4H3.75Z" />
    </svg>
  );
}

function SectionIcon({ path }: { path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
    >
      <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .27.144.518.378.651l3 1.714a.75.75 0 0 0 .744-1.302L10.75 9.566V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Splits a title around the matched query so the match can be emphasised.
function highlight(title: string, query: string): ReactNode {
  if (!query) return title;
  const idx = title.toLowerCase().indexOf(query);
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark className="rounded bg-amber-200/70 px-0.5 text-inherit">
        {title.slice(idx, idx + query.length)}
      </mark>
      {title.slice(idx + query.length)}
    </>
  );
}

export default function Sidebar({
  pages,
  activeSlug,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  // Progressive disclosure: the category filters stay hidden until the user
  // opens them, keeping the default sidebar uncluttered.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Empty set = no section filter active (show all). Otherwise only the
  // chosen sections are shown.
  const [sectionFilter, setSectionFilter] = useState<Set<string>>(new Set());
  // Sections the user has manually collapsed (accordion), persisted so the
  // sidebar reopens the way they left it. Default expanded.
  const [collapsedSectionList, setCollapsedSectionList] = useLocalStorage<string[]>(
    "sidebar.collapsedSections",
    [],
  );
  const collapsedSections = useMemo(
    () => new Set(collapsedSectionList),
    [collapsedSectionList],
  );
  // Recently visited slugs, most-recent first.
  const [recent, setRecent] = useLocalStorage<string[]>("sidebar.recent", []);
  // Index of the keyboard-highlighted result (-1 = none).
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  const pageBySlug = useMemo(() => {
    const m = new Map<string, PageEntry>();
    for (const p of pages) m.set(p.slug, p);
    return m;
  }, [pages]);

  // Build the ordered, filtered section groups.
  const groups = useMemo<SectionGroup[]>(() => {
    const bySection = new Map<string, PageEntry[]>();
    for (const page of pages) {
      const matchesQuery =
        !searching || page.title.toLowerCase().includes(trimmedQuery);
      if (!matchesQuery) continue;
      const list = bySection.get(page.section) ?? [];
      list.push(page);
      bySection.set(page.section, list);
    }

    return ALL_SECTION_DEFS.map((def) => ({
      ...def,
      pages: bySection.get(def.id) ?? [],
    })).filter((group) => {
      if (group.pages.length === 0) return false;
      if (sectionFilter.size > 0 && !sectionFilter.has(group.id)) return false;
      return true;
    });
  }, [pages, searching, trimmedQuery, sectionFilter]);

  const totalMatches = groups.reduce((sum, g) => sum + g.pages.length, 0);

  // Flattened list of currently-visible pages, in render order, respecting
  // each section's open/closed state. Drives arrow-key navigation.
  const visiblePages = useMemo<PageEntry[]>(() => {
    const out: PageEntry[] = [];
    for (const group of groups) {
      const isOpen = searching || !collapsedSections.has(group.id);
      if (isOpen) out.push(...group.pages);
    }
    return out;
  }, [groups, searching, collapsedSections]);

  // Which section defs to expose as filter chips — only sections that
  // actually contain pages.
  const availableSections = useMemo(() => {
    const present = new Set(pages.map((p) => p.section));
    return ALL_SECTION_DEFS.filter((def) => present.has(def.id));
  }, [pages]);

  const recentPages = useMemo(
    () =>
      recent
        .map((slug) => pageBySlug.get(slug))
        .filter((p): p is PageEntry => Boolean(p)),
    [recent, pageBySlug],
  );

  function toggleSectionFilter(id: string) {
    setHighlightIdx(-1);
    setSectionFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSectionCollapse(id: string) {
    setCollapsedSectionList((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function clearFilters() {
    setSectionFilter(new Set());
    setQuery("");
    setHighlightIdx(-1);
  }

  // Record a visit and route the selection up.
  const select = useCallback(
    (slug: string) => {
      onSelect(slug);
      setRecent((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, RECENT_MAX));
    },
    [onSelect, setRecent],
  );

  // Global shortcuts: ⌘K / Ctrl+K and "/" focus the search box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (collapsed) {
          // The search input only mounts when expanded — focus next frame.
          onToggleCollapsed();
          requestAnimationFrame(() => searchRef.current?.focus());
        } else {
          searchRef.current?.focus();
          searchRef.current?.select();
        }
      } else if (e.key === "/" && !typing && !collapsed) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collapsed, onToggleCollapsed]);

  // Keep the active page visible: expand its section and scroll it into view.
  useEffect(() => {
    const active = pageBySlug.get(activeSlug);
    if (active) {
      setCollapsedSectionList((prev) =>
        prev.includes(active.section)
          ? prev.filter((s) => s !== active.section)
          : prev,
      );
    }
    const el = itemRefs.current[activeSlug];
    el?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug, pageBySlug]);

  // Scroll the keyboard-highlighted result into view as it moves.
  useEffect(() => {
    if (highlightIdx < 0) return;
    const page = visiblePages[highlightIdx];
    if (page) itemRefs.current[page.slug]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, visiblePages]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, visiblePages.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target =
        visiblePages[highlightIdx >= 0 ? highlightIdx : 0] ?? visiblePages[0];
      if (target) {
        select(target.slug);
        searchRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        searchRef.current?.blur();
      }
    }
  }

  const filterCount = sectionFilter.size;
  const showRecent = !searching && filterCount === 0 && recentPages.length > 0;

  return (
    <aside
      className={`flex h-screen flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-3">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            pages
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform duration-200 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M12.78 5.22a.75.75 0 0 1 0 1.06L9.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Search + progressive-disclosure filters (expanded mode only). */}
      {!collapsed && (
        <div className="border-b border-neutral-200 px-3 py-2.5">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(-1);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search pages…"
              aria-label="Search pages"
              role="combobox"
              aria-expanded={searching}
              aria-controls="sidebar-nav"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pr-12 pl-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-neutral-400">
                ⌘K
              </kbd>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
                filterCount > 0
                  ? "font-semibold text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Filters</span>
              {filterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold text-white">
                  {filterCount}
                </span>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-3 w-3 text-neutral-400 transition-transform ${
                  filtersOpen ? "rotate-180" : ""
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {(filterCount > 0 || query) && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md px-2 py-1 text-xs text-neutral-500 hover:text-neutral-900"
              >
                Clear
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {availableSections.map((def) => {
                const active = sectionFilter.has(def.id);
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => toggleSectionFilter(def.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
                      active
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    {def.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <nav id="sidebar-nav" ref={navRef} className="flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          !collapsed && (
            <div className="px-4 py-6 text-center text-xs text-neutral-400">
              No pages match{query ? ` “${query.trim()}”` : " the filters"}.
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1">
            {/* Recently visited — quick return to where you were. */}
            {!collapsed && showRecent && (
              <div className="px-2 pb-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                  <span className="text-neutral-400">
                    <ClockIcon />
                  </span>
                  <span>Recent</span>
                </div>
                <ul className="mt-0.5 flex flex-col gap-0.5 pl-1.5">
                  {recentPages.map((page) => {
                    const isActive = page.slug === activeSlug;
                    return (
                      <li key={page.slug}>
                        <button
                          type="button"
                          onClick={() => select(page.slug)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                            isActive
                              ? "bg-neutral-900 text-white"
                              : "text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <FolderIcon />
                          <span className="truncate">{page.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mx-2 mt-1.5 border-t border-neutral-100" />
              </div>
            )}

            {groups.map((group) => {
              // While searching, force every matching section open so results
              // are never hidden behind a collapsed header.
              const isOpen = searching || !collapsedSections.has(group.id);

              if (collapsed) {
                // Narrow mode: icon-only list, grouped with a thin divider.
                return (
                  <div key={group.id} className="px-2">
                    <div
                      className="flex h-7 items-center justify-center text-neutral-400"
                      title={group.label}
                    >
                      <SectionIcon path={group.iconPath} />
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {group.pages.map((page) => {
                        const isActive = page.slug === activeSlug;
                        return (
                          <li key={page.slug}>
                            <button
                              type="button"
                              ref={(el) => {
                                itemRefs.current[page.slug] = el;
                              }}
                              onClick={() => select(page.slug)}
                              title={page.title}
                              className={`flex w-full items-center justify-center rounded-md px-2 py-1.5 transition ${
                                isActive
                                  ? "bg-neutral-900 text-white"
                                  : "text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              <FolderIcon />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }

              return (
                <div key={group.id} className="px-2">
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapse(group.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase transition hover:bg-neutral-50 hover:text-neutral-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-3 w-3 shrink-0 text-neutral-400 transition-transform ${
                        isOpen ? "" : "-rotate-90"
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-neutral-400">
                      <SectionIcon path={group.iconPath} />
                    </span>
                    <span className="truncate">{group.label}</span>
                    <span className="ml-auto text-[10px] font-medium text-neutral-400 tabular-nums">
                      {group.pages.length}
                    </span>
                  </button>

                  {isOpen && (
                    <ul className="mt-0.5 flex flex-col gap-0.5 pl-1.5">
                      {group.pages.map((page) => {
                        const isActive = page.slug === activeSlug;
                        const flatIdx = visiblePages.indexOf(page);
                        const isHighlighted =
                          highlightIdx >= 0 && flatIdx === highlightIdx;
                        return (
                          <li key={page.slug}>
                            <button
                              type="button"
                              ref={(el) => {
                                itemRefs.current[page.slug] = el;
                              }}
                              onClick={() => select(page.slug)}
                              onMouseEnter={() =>
                                highlightIdx >= 0 && setHighlightIdx(flatIdx)
                              }
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                                isActive
                                  ? "bg-neutral-900 text-white"
                                  : isHighlighted
                                    ? "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-900/10"
                                    : "text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              <FolderIcon />
                              <span className="truncate">
                                {highlight(page.title, trimmedQuery)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="border-t border-neutral-200 p-3 text-[11px] text-neutral-400">
          {searching || filterCount > 0 ? (
            <span>
              {totalMatches} {totalMatches === 1 ? "page" : "pages"} shown
            </span>
          ) : (
            <span>
              Press <kbd className="rounded border border-neutral-200 bg-white px-1 py-0.5 font-sans text-[10px] text-neutral-500">⌘K</kbd>{" "}
              to search ·{" "}
              <kbd className="rounded border border-neutral-200 bg-white px-1 py-0.5 font-sans text-[10px] text-neutral-500">↑↓</kbd>{" "}
              to move
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
