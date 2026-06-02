import { useMemo, useState } from "react";
import { SECTIONS, OTHER_SECTION_ID } from "../lib/pageSections";

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
  // Sections the user has manually collapsed (accordion). Default expanded.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

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

  // Which section defs to expose as filter chips — only sections that
  // actually contain pages.
  const availableSections = useMemo(() => {
    const present = new Set(pages.map((p) => p.section));
    return ALL_SECTION_DEFS.filter((def) => present.has(def.id));
  }, [pages]);

  function toggleSectionFilter(id: string) {
    setSectionFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSectionCollapse(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSectionFilter(new Set());
    setQuery("");
  }

  const filterCount = sectionFilter.size;

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
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              aria-label="Search pages"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pr-7 pl-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
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

      <nav className="flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          !collapsed && (
            <div className="px-4 py-6 text-center text-xs text-neutral-400">
              No pages match{query ? ` “${query.trim()}”` : " the filters"}.
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1">
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
                              onClick={() => onSelect(page.slug)}
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
                        return (
                          <li key={page.slug}>
                            <button
                              type="button"
                              onClick={() => onSelect(page.slug)}
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
              Files in <code className="font-mono">src/pages</code> appear here
              automatically.
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
