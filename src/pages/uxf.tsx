import { useMemo, useState, type ComponentType } from "react";
import { sectionForSlug, sectionLabel } from "../lib/pageSections";
import { accentForSection, metaForSlug } from "../lib/galleryMeta";
import { navigateToPage } from "../lib/navigation";
import GalleryThumb from "../components/gallery/GalleryThumb";
import Modal from "../components/patterns/Modal";

export const title = "UXF";
export const section = "patterns";
export const fullWidth = true;

/* UXF — documentation-style catalogue mirroring untitledui.com/react/components:
 * hero + explainer up top, then a searchable/filterable grid of examples below.
 * "Examples" are the app's own pages, reused as stand-in screenshots — clicking
 * one opens the real page, same click-through as the File Gallery. */

type PageModule = {
  default: ComponentType;
  title?: string;
  section?: string;
};

const pageModules = import.meta.glob<PageModule>("./*.tsx", { eager: true });

type Category = "component" | "pattern" | "template";

const CATEGORY_LABEL: Record<Category, string> = {
  component: "Components",
  pattern: "Patterns",
  template: "Templates",
};

function categoryFor(slug: string, sectionId: string): Category {
  if (slug.startsWith("date-picker")) return "component";
  if (sectionId === "patterns") return "pattern";
  return "template";
}

function formatTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ExampleItem = {
  slug: string;
  title: string;
  section: string;
  sectionLabel: string;
  description: string;
  tags: string[];
  motif: ReturnType<typeof metaForSlug>["motif"];
  accent: ReturnType<typeof accentForSection>;
  category: Category;
};

// Filtered before mapping — this file's own eager self-import (via the glob
// below) leaves its own module bindings (title/section/fullWidth) in the
// temporal dead zone, so its entry must never be read. gallery.tsx is
// excluded too since it's the app's separate landing-page catalogue.
const ALL_ITEMS: ExampleItem[] = Object.entries(pageModules)
  .filter(
    ([path]) => !path.endsWith("/uxf.tsx") && !path.endsWith("/gallery.tsx"),
  )
  .map(([path, mod]) => {
    const slug = path.replace(/^\.\//, "").replace(/\.tsx$/, "");
    const sec = sectionForSlug(slug, mod.section);
    const meta = metaForSlug(slug, sec);
    return {
      slug,
      title: mod.title ?? formatTitle(slug),
      section: sec,
      sectionLabel: sectionLabel(sec),
      description: meta.description,
      tags: meta.tags,
      motif: meta.motif,
      accent: accentForSection(sec),
      category: categoryFor(slug, sec),
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

const CATEGORY_ORDER: Category[] = ["component", "pattern", "template"];

const STEPS: { category: Category; title: string; body: string }[] = [
  {
    category: "component",
    title: "1. Components",
    body: "The raw building blocks — inputs, pickers, buttons — each one documented and ready to drop in.",
  },
  {
    category: "pattern",
    title: "2. Patterns",
    body: "Components composed into reusable interactions: grids, panels, modals. Proven shapes, not one-offs.",
  },
  {
    category: "template",
    title: "3. Templates",
    body: "Full pages assembled from patterns — a finished screen your team can fork and ship.",
  },
];

export default function UxfPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const trimmed = query.trim().toLowerCase();

  const categoryChips = useMemo(
    () =>
      CATEGORY_ORDER.map((c) => ({
        id: c,
        label: CATEGORY_LABEL[c],
        count: ALL_ITEMS.filter((i) => i.category === c).length,
      })),
    [],
  );

  const filtered = useMemo(() => {
    return ALL_ITEMS.filter((item) => {
      if (activeCategory && item.category !== activeCategory) return false;
      if (trimmed) {
        const haystack =
          `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(trimmed)) return false;
      }
      return true;
    });
  }, [trimmed, activeCategory]);

  const hasFilters = Boolean(trimmed) || activeCategory !== null;

  function clearAll() {
    setQuery("");
    setActiveCategory(null);
  }

  return (
    <div className="h-screen overflow-y-auto bg-white text-neutral-900">
      {/* ---------- Hero ---------- */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-8 py-20">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            UXF
          </div>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            Components, patterns and templates — ready for your team
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-500">
            UXF turns individual components into reusable patterns, then
            templates full pages from them. Browse the library below, or
            describe what you need and let the assistant assemble it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setGenOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M9.05 2.276a.75.75 0 0 1 1.4 0l1.145 2.964a1.75 1.75 0 0 0 1.001 1.001l2.964 1.145a.75.75 0 0 1 0 1.4l-2.964 1.145a1.75 1.75 0 0 0-1.001 1.001l-1.145 2.964a.75.75 0 0 1-1.4 0l-1.145-2.964a1.75 1.75 0 0 0-1.001-1.001l-2.964-1.145a.75.75 0 0 1 0-1.4l2.964-1.145a1.75 1.75 0 0 0 1.001-1.001l1.145-2.964ZM3.5 12a.5.5 0 0 1 .928-.256l.464.928a.75.75 0 0 0 .336.336l.928.464a.5.5 0 0 1 0 .928l-.928.464a.75.75 0 0 0-.336.336l-.464.928a.5.5 0 0 1-.928 0l-.464-.928a.75.75 0 0 0-.336-.336l-.928-.464a.5.5 0 0 1 0-.928l.928-.464a.75.75 0 0 0 .336-.336l.464-.928A.5.5 0 0 1 3.5 12Z" />
              </svg>
              Generate with AI
            </button>
            <a
              href="#library"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Browse library
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Explainer: the three-stage pipeline ---------- */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-8 py-14">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.category} className="relative">
                {i < STEPS.length - 1 && (
                  <svg
                    aria-hidden
                    className="absolute -right-4 top-3 hidden h-4 w-8 text-neutral-300 sm:block"
                    viewBox="0 0 32 16"
                    fill="none"
                  >
                    <path
                      d="M1 8h28m0 0-6-6m6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <h3 className="text-sm font-semibold text-neutral-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Library: search, filters, grid ---------- */}
      <section id="library" className="scroll-mt-4">
        <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-8 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-sm">
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
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search components, patterns, templates…"
                  aria-label="Search the library"
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                aria-pressed={activeCategory === null}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeCategory === null
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                }`}
              >
                All
                <span className="ml-1.5 opacity-60">{ALL_ITEMS.length}</span>
              </button>
              {categoryChips.map((chip) => {
                const active = activeCategory === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setActiveCategory(active ? null : chip.id)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                    }`}
                  >
                    {chip.label}
                    <span className="ml-1.5 opacity-60">{chip.count}</span>
                  </button>
                );
              })}

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="mb-4 text-xs text-neutral-500">
            {filtered.length} {filtered.length === 1 ? "example" : "examples"}
            {hasFilters ? " match your filters" : ""}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center">
              <p className="text-sm font-medium text-neutral-700">
                No examples match
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item, i) => (
                <article
                  key={item.slug}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-900/5"
                >
                  <button
                    type="button"
                    onClick={() => navigateToPage(item.slug)}
                    aria-label={`Open ${item.title}`}
                    className="relative block aspect-[16/10] w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40"
                  >
                    <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]">
                      <GalleryThumb
                        motif={item.motif}
                        accent={item.accent}
                        seed={i + 1}
                      />
                    </div>
                    <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm">
                        Open example
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {item.sectionLabel}
                    </div>
                    <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Generate with AI"
        description="Placeholder — no assistant is wired up yet."
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setGenOpen(false)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Got it
          </button>
        }
      >
        <p className="text-sm text-neutral-700">
          This button is where a prompt-to-template flow would live: describe
          a screen, and the assistant assembles it from the components and
          patterns in this library. Wire up a real model call here when
          you're ready.
        </p>
      </Modal>
    </div>
  );
}
