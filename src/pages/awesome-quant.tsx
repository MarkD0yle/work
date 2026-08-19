import { useMemo, useState } from "react";
import {
  ALL_RESOURCES,
  AWESOME_QUANT,
  AWESOME_QUANT_SYNCED,
  AWESOME_QUANT_URL,
  PRIMARY_TAGS,
  TAG_COUNTS,
  type QuantResource,
} from "../lib/awesome-quant";

export const title = "Awesome Quant";
export const section = "patterns";
export const fullWidth = true;

/* Awesome Quant — a browsable mirror of the community-curated list of
 * quantitative-finance libraries, data sources and services. Pure reference:
 * the catalogue lives in lib/awesome-quant.ts and this page is the view over
 * it — search, a category filter, language chips, and a grouped directory. */

type Resource = QuantResource & { category: string };

/** Case-insensitive AND-match of every search term across the fields a reader
 * would plausibly search: name, description, tags, category, and sub-entries. */
function matchesQuery(resource: Resource, query: string): boolean {
  if (!query) return true;
  const haystack = `${resource.name} ${resource.description} ${resource.tags.join(
    " ",
  )} ${resource.category} ${(resource.children ?? [])
    .map((child) => `${child.name} ${child.description}`)
    .join(" ")}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export default function AwesomeQuant() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | "All">("All");
  const [tag, setTag] = useState<string | "All">("All");

  const categoryCounts = useMemo(
    () => new Map(AWESOME_QUANT.map((c) => [c.name, c.entries.length])),
    [],
  );
  const tagCounts = useMemo(() => new Map(TAG_COUNTS), []);

  const filtered = useMemo(
    () =>
      ALL_RESOURCES.filter(
        (resource) =>
          (category === "All" || resource.category === category) &&
          (tag === "All" || resource.tags.includes(tag)) &&
          matchesQuery(resource, query),
      ),
    [query, category, tag],
  );

  // Group the survivors back into categories, keeping the upstream ordering so
  // the page reads the same way every time.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Resource[]>();
    for (const resource of filtered) {
      const list = byCategory.get(resource.category) ?? [];
      list.push(resource);
      byCategory.set(resource.category, list);
    }
    return AWESOME_QUANT.filter((c) => byCategory.has(c.name)).map((c) => ({
      category: c.name,
      resources: byCategory.get(c.name)!,
    }));
  }, [filtered]);

  const filtersActive = Boolean(query) || category !== "All" || tag !== "All";

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Sticky header: title, search box, category select, language chips. */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            resource
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Awesome Quant
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {ALL_RESOURCES.length} financial charting libraries and front-end
            tools across {AWESOME_QUANT.length} categories. Narrowed from{" "}
            <a
              href={AWESOME_QUANT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
            >
              wilsonfreitas/awesome-quant
            </a>{" "}
            on {AWESOME_QUANT_SYNCED}.
          </p>

          {/* Search + category */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 3.473 9.785l3.121 3.122a.75.75 0 1 0 1.06-1.06l-3.12-3.122A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search libraries, e.g. 'backtest', 'options pricing', 'yield curve'…"
                className="w-full rounded-md border border-neutral-300 bg-white py-2 pr-9 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-2 text-xs text-neutral-600">
              <span className="text-neutral-400">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="max-w-56 bg-transparent font-medium text-neutral-800 outline-none"
              >
                <option value="All">All ({ALL_RESOURCES.length})</option>
                {AWESOME_QUANT.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.entries.length})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Language / interface filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <FilterChip
              label="All languages"
              count={ALL_RESOURCES.length}
              active={tag === "All"}
              onClick={() => setTag("All")}
            />
            {PRIMARY_TAGS.map((name) => (
              <FilterChip
                key={name}
                label={name}
                count={tagCounts.get(name) ?? 0}
                active={tag === name}
                onClick={() => setTag(name)}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-neutral-700">
                No resources match these filters.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Try a broader keyword, or reset the category and language
                filters.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ category: name, resources }) => (
                <section key={name}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                    {name}
                    <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                      {resources.length}
                      {resources.length !== categoryCounts.get(name) &&
                        ` / ${categoryCounts.get(name)}`}
                    </span>
                  </h2>
                  <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {resources.map((resource) => (
                      <ResourceRow
                        key={`${name}-${resource.name}-${resource.url}`}
                        resource={resource}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Result count footer */}
          <p className="mt-6 text-center text-xs text-neutral-400">
            Showing {filtered.length} of {ALL_RESOURCES.length} resources
            {category !== "All" && ` in ${category}`}
            {tag !== "All" && ` tagged ${tag}`}
            {query && ` matching “${query}”`}.
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                  setTag("All");
                }}
                className="ml-1 font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
              >
                Reset filters
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  // The upstream list links to docs or a homepage where one exists and adds a
  // separate GitHub link; only show the repo link when it differs.
  const showRepo = resource.repo && resource.repo !== resource.url;

  return (
    <li className="border-b border-neutral-100 px-4 py-3 last:border-b-0 hover:bg-neutral-50">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
        >
          {resource.name}
        </a>
        {resource.tags.map((name) => (
          <span
            key={name}
            className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500"
          >
            {name}
          </span>
        ))}
        {resource.archived && (
          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            archived
          </span>
        )}
        {showRepo && (
          <a
            href={resource.repo}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700"
          >
            GitHub ↗
          </a>
        )}
      </div>

      <p className="mt-1 text-sm text-neutral-600">{resource.description}</p>

      {resource.children && (
        <ul className="mt-2 space-y-1 border-l border-neutral-200 pl-3">
          {resource.children.map((child) => (
            <li key={child.name} className="text-xs text-neutral-500">
              {child.url ? (
                <a
                  href={child.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-700"
                >
                  {child.name}
                </a>
              ) : (
                <span className="font-medium text-neutral-700">
                  {child.name}
                </span>
              )}
              {child.description && <> — {child.description}</>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] ${
          active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
