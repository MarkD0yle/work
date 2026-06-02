import { useMemo, useState, type ComponentType } from "react";
import Sidebar from "./components/Sidebar";
import { sectionForSlug } from "./lib/pageSections";

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

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string>(
    () => pages[0]?.slug ?? "",
  );
  const [recentSlugs, setRecentSlugs] = useState<string[]>(
    () => (pages[0]?.slug ? [pages[0].slug] : []),
  );

  const activePage = useMemo(
    () => pages.find((p) => p.slug === activeSlug),
    [activeSlug],
  );
  const ActivePage = activePage?.Component;

  function handleSelect(slug: string) {
    setActiveSlug(slug);
    setRecentSlugs((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 8));
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 antialiased">
      <Sidebar
        pages={pages.map(({ slug, title, section }) => ({
          slug,
          title,
          section,
        }))}
        activeSlug={activeSlug}
        onSelect={handleSelect}
        recentSlugs={recentSlugs}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
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
