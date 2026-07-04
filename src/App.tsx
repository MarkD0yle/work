import { useEffect, useMemo, type ComponentType } from "react";
import { sectionForSlug } from "./lib/pageSections";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { onNavigate } from "./lib/navigation";

type PageModule = {
  default: ComponentType;
  title?: string;
  fullWidth?: boolean;
  section?: string;
};

const pageModules = import.meta.glob<PageModule>("./pages/*.tsx", {
  eager: true,
});

function formatTitle(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type PageEntry = {
  slug: string;
  title: string;
  section: string;
  Component: ComponentType;
  fullWidth: boolean;
};

const pages: PageEntry[] = Object.entries(pageModules)
  .map(([path, mod]) => {
    const slug = path.replace(/^\.\/pages\//, "").replace(/\.tsx$/, "");
    return {
      slug,
      title: mod.title ?? formatTitle(slug),
      section: sectionForSlug(slug, mod.section),
      Component: mod.default,
      fullWidth: mod.fullWidth ?? false,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

// Prefer the File Gallery as the landing page when present; otherwise fall
// back to the first page alphabetically.
const DEFAULT_SLUG = pages.some((p) => p.slug === "gallery")
  ? "gallery"
  : (pages[0]?.slug ?? "");

function App() {
  const [storedSlug, setActiveSlug] = useLocalStorage<string>(
    "active.slug",
    DEFAULT_SLUG,
  );

  // Pages render standalone, so in-app navigation (e.g. opening a card from
  // the File Gallery) comes through a window event.
  useEffect(() => onNavigate(setActiveSlug), [setActiveSlug]);
  // Guard against a persisted slug whose page no longer exists.
  const activeSlug = pages.some((p) => p.slug === storedSlug)
    ? storedSlug
    : DEFAULT_SLUG;

  const activePage = useMemo(
    () => pages.find((p) => p.slug === activeSlug),
    [activeSlug],
  );
  const ActivePage = activePage?.Component;

  // The home page (File Gallery) is the primary navigation surface, so the
  // sidebar is hidden. When drilled into another page, a floating pill returns
  // you home.
  const onHome = activeSlug === DEFAULT_SLUG;

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 antialiased">
      {!onHome && DEFAULT_SLUG && (
        <button
          type="button"
          onClick={() => setActiveSlug(DEFAULT_SLUG)}
          className="fixed left-5 top-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-2 text-sm font-medium text-neutral-800 shadow-lg shadow-neutral-900/10 backdrop-blur-md transition hover:bg-white/90 hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
          aria-label="Back to home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7a1 1 0 0 1-1.414 1.414L16 10.414V17a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3H9v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6.586l-.293.293a1 1 0 0 1-1.414-1.414l7-7Z" />
          </svg>
          Home
        </button>
      )}
      <main className="flex-1 overflow-hidden">
        {ActivePage ? (
          activePage?.fullWidth ? (
            <div className="h-screen overflow-hidden">
              <ActivePage />
            </div>
          ) : (
            <div className="h-screen overflow-y-auto">
              <div className="mx-auto max-w-5xl px-8 py-10">
                <ActivePage />
              </div>
            </div>
          )
        ) : (
          <div className="h-screen overflow-y-auto">
            <div className="mx-auto max-w-5xl px-8 py-10">
              <div className="text-neutral-500">
                No pages yet. Add a file to{" "}
                <code className="font-mono">src/pages</code>.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
