import { useMemo, useState } from "react";
import {
  CATEGORY_ORDER,
  GIT_COMMANDS,
  type CommandCategory,
  type GitCommand,
} from "../lib/git-commands";

export const title = "GitHub Cheat Sheet";
export const fullWidth = true;

/* GitHub Cheat Sheet — a searchable, filterable reference of the Git and
 * GitHub CLI commands you reach for day to day. The command catalogue lives in
 * lib/git-commands.ts; this page is the view over it: a sticky search box, a
 * row of category filter chips, and a grouped, copy-able list of commands. */

/** Case-insensitive substring match across the fields a reader would search. */
function matchesQuery(cmd: GitCommand, query: string): boolean {
  if (!query) return true;
  const haystack = `${cmd.command} ${cmd.description} ${cmd.category} ${
    cmd.example ?? ""
  }`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {
        /* clipboard may be unavailable (e.g. insecure context) — ignore */
      },
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy command: ${text}`}
      className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-800"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function GithubCheatSheet() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CommandCategory | "All">(
    "All",
  );

  // Commands left after applying the category filter and the search query.
  const filtered = useMemo(
    () =>
      GIT_COMMANDS.filter(
        (cmd) =>
          (activeCategory === "All" || cmd.category === activeCategory) &&
          matchesQuery(cmd, query),
      ),
    [query, activeCategory],
  );

  // Group the survivors by category, preserving the canonical chip order so
  // the page reads top-to-bottom the same way every time.
  const grouped = useMemo(() => {
    const byCategory = new Map<CommandCategory, GitCommand[]>();
    for (const cmd of filtered) {
      const list = byCategory.get(cmd.category) ?? [];
      list.push(cmd);
      byCategory.set(cmd.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      commands: byCategory.get(category)!,
    }));
  }, [filtered]);

  // Per-category counts drive the little badges on each filter chip.
  const counts = useMemo(() => {
    const map = new Map<CommandCategory, number>();
    for (const cmd of GIT_COMMANDS) {
      map.set(cmd.category, (map.get(cmd.category) ?? 0) + 1);
    }
    return map;
  }, []);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Sticky header: title, search box, and category filter chips. */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            reference
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            GitHub Cheat Sheet
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {GIT_COMMANDS.length} Git &amp; GitHub CLI commands, explained.
            Search by keyword or filter by category.
          </p>

          {/* Search */}
          <div className="relative mt-4">
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
              placeholder="Search commands, e.g. 'rebase', 'undo commit', 'push tag'…"
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

          {/* Category filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <FilterChip
              label="All"
              count={GIT_COMMANDS.length}
              active={activeCategory === "All"}
              onClick={() => setActiveCategory("All")}
            />
            {CATEGORY_ORDER.map((category) => (
              <FilterChip
                key={category}
                label={category}
                count={counts.get(category) ?? 0}
                active={activeCategory === category}
                onClick={() => setActiveCategory(category)}
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
                No commands match “{query}”.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Try a different keyword or clear the filters.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ category, commands }) => (
                <section key={category}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                    {category}
                    <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                      {commands.length}
                    </span>
                  </h2>
                  <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {commands.map((cmd) => (
                      <li
                        key={cmd.command}
                        className="border-b border-neutral-100 px-4 py-3 last:border-b-0 hover:bg-neutral-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <code className="font-mono text-sm break-all text-neutral-900">
                            {cmd.command}
                          </code>
                          <CopyButton text={cmd.command} />
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">
                          {cmd.description}
                        </p>
                        {cmd.example && (
                          <p className="mt-1.5 text-xs text-neutral-400">
                            <span className="font-medium text-neutral-400">
                              e.g.{" "}
                            </span>
                            <code className="font-mono text-neutral-500">
                              {cmd.example}
                            </code>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Result count footer */}
          <p className="mt-6 text-center text-xs text-neutral-400">
            Showing {filtered.length} of {GIT_COMMANDS.length} commands
            {activeCategory !== "All" && ` in ${activeCategory}`}
            {query && ` matching “${query}”`}.
          </p>
        </div>
      </div>
    </div>
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
