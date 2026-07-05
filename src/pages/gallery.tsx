import { useMemo, useState, type ComponentType } from "react";
import {
  SECTIONS,
  OTHER_SECTION_ID,
  sectionForSlug,
  sectionLabel,
} from "../lib/pageSections";
import {
  accentForSection,
  metaForSlug,
} from "../lib/galleryMeta";
import { navigateToPage } from "../lib/navigation";
import GalleryCard, {
  type GalleryItem,
} from "../components/gallery/GalleryCard";

export const title = "File Gallery";
export const section = "patterns";
export const fullWidth = true;

/* File Gallery — a Dribbble / Pinterest-style showcase of every page in the
 * workspace. Pages are auto-discovered (same glob App uses), enriched with the
 * gallery metadata (description, tags, motif, accent), and rendered as
 * thumbnail cards under a hero. Search, section filters and tag filters narrow
 * the grid; clicking a card navigates to that page via a window event. */

type PageModule = {
  default: ComponentType;
  title?: string;
  section?: string;
};

const pageModules = import.meta.glob<PageModule>("./*.tsx", { eager: true });

function formatTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Build the full catalogue once at module load. Exclude the gallery itself.
const ALL_ITEMS: GalleryItem[] = Object.entries(pageModules)
  .map(([path, mod]) => {
    const slug = path.replace(/^\.\//, "").replace(/\.tsx$/, "");
    const section = sectionForSlug(slug, mod.section);
    const meta = metaForSlug(slug, section);
    return {
      slug,
      title: mod.title ?? formatTitle(slug),
      section,
      sectionLabel: sectionLabel(section),
      description: meta.description,
      tags: meta.tags,
      motif: meta.motif,
      accent: accentForSection(section),
    };
  })
  .filter((item) => item.slug !== "gallery")
  .sort((a, b) => a.title.localeCompare(b.title));

type SortKey = "title" | "section";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "title", label: "A–Z" },
  { key: "section", label: "Section" },
];

// Section chip order: known sections first, then Other if present.
const SECTION_ORDER = [
  ...SECTIONS.map((s) => ({ id: s.id, label: s.label })),
  { id: OTHER_SECTION_ID, label: "Other" },
];

export default function GalleryPage() {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("title");

  const trimmed = query.trim().toLowerCase();

  // Only show section chips that actually have pages.
  const sectionChips = useMemo(() => {
    const present = new Set(ALL_ITEMS.map((i) => i.section));
    return SECTION_ORDER.filter((s) => present.has(s.id)).map((s) => ({
      ...s,
      count: ALL_ITEMS.filter((i) => i.section === s.id).length,
    }));
  }, []);

  const filtered = useMemo(() => {
    const items = ALL_ITEMS.filter((item) => {
      if (activeSection && item.section !== activeSection) return false;
      if (activeTags.size > 0 && !item.tags.some((t) => activeTags.has(t)))
        return false;
      if (trimmed) {
        const haystack = `${item.title} ${item.description} ${item.tags.join(
          " ",
        )}`.toLowerCase();
        if (!haystack.includes(trimmed)) return false;
      }
      return true;
    });
    if (sort === "section") {
      return [...items].sort(
        (a, b) =>
          a.sectionLabel.localeCompare(b.sectionLabel) ||
          a.title.localeCompare(b.title),
      );
    }
    return items; // already A–Z
  }, [trimmed, activeSection, activeTags, sort]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const hasFilters = Boolean(trimmed) || activeSection !== null || activeTags.size > 0;

  function clearAll() {
    setQuery("");
    setActiveSection(null);
    setActiveTags(new Set());
  }

  return (
    <div className="relative h-screen overflow-y-auto bg-neutral-100 text-neutral-900">
      {/* ---------- Ambient glass backdrop ----------
       * Soft colour fields fixed behind the whole page so the frosted-glass
       * cards and bars have something to refract. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-neutral-50 to-rose-50" />
        <div
          className="absolute -left-32 top-1/4 h-[32rem] w-[32rem] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #818cf8 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 top-1/2 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #fb7185 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[30rem] w-[30rem] rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #34d399 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-white/60 bg-gradient-to-b from-white via-indigo-50/40 to-white text-neutral-900">
        {/* decorative gradient blobs */}
        <div
          aria-hidden
          className="animate-blob-a pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #93c5fd 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="animate-blob-b pointer-events-none absolute -right-16 top-10 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #a5b4fc 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="animate-blob-c pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at center, #60a5fa 0%, transparent 70%)",
          }}
        />

        {/* pencil grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-8 py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-neutral-600 shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {ALL_ITEMS.length} files
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            UX Markets Gallery
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
            Inspiration board
          </p>

          {/* Search */}
          <div className="mt-8 max-w-xl">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
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
                placeholder="Search files, descriptions, tags…"
                aria-label="Search files"
                className="w-full rounded-xl border border-white/70 bg-white/70 py-3.5 pl-12 pr-4 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 backdrop-blur-sm focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Filter bar ---------- */}
      <div className="sticky top-0 z-20 border-b border-white/40 bg-white/50 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto max-w-6xl px-8 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection(null)}
              aria-pressed={activeSection === null}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                activeSection === null
                  ? "bg-neutral-900 text-white"
                  : "border border-white/50 bg-white/40 text-neutral-600 backdrop-blur-sm hover:border-white/70 hover:bg-white/70 hover:text-neutral-900"
              }`}
            >
              All
              <span className="ml-1.5 opacity-60">{ALL_ITEMS.length}</span>
            </button>
            {sectionChips.map((chip) => {
              const active = activeSection === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(active ? null : chip.id)
                  }
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "border border-white/50 bg-white/40 text-neutral-600 backdrop-blur-sm hover:border-white/70 hover:bg-white/70 hover:text-neutral-900"
                  }`}
                >
                  {chip.label}
                  <span className="ml-1.5 opacity-60">{chip.count}</span>
                </button>
              );
            })}

            {/* Sort + clear, pushed right */}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-full border border-white/50 bg-white/40 p-0.5 backdrop-blur-sm">
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    aria-pressed={sort === s.key}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      sort === s.key
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Active tag chips (only the ones currently selected) */}
          {activeTags.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Tags
              </span>
              {[...activeTags].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[11px] font-medium text-white"
                >
                  #{tag}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3 w-3 opacity-70"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Grid ---------- */}
      <div className="relative z-10 mx-auto max-w-6xl px-8 py-8">
        <div className="mb-4 text-xs text-neutral-500">
          {filtered.length} {filtered.length === 1 ? "file" : "files"}
          {hasFilters ? " match your filters" : ""}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 bg-white/40 px-6 py-16 text-center backdrop-blur-xl">
            <div className="text-3xl text-neutral-300">🔍</div>
            <p className="mt-2 text-sm font-medium text-neutral-700">
              No files match
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
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item, i) => (
              <GalleryCard
                key={item.slug}
                item={item}
                index={i}
                query={trimmed}
                onOpen={navigateToPage}
                onTagClick={toggleTag}
              />
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-neutral-200 pt-4 text-[11px] text-neutral-400">
          Auto-generated from <code className="font-mono">src/pages</code> — add
          a file and it shows up here.
        </div>
      </div>
    </div>
  );
}
