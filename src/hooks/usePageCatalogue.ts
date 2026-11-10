import { useEffect, useState, type ComponentType } from "react";
import { sectionForSlug, sectionLabel } from "../lib/pageSections";

/* usePageCatalogue — the list of every screen, for pages that list or embed
 * other pages (the landing page, Demo Reel, Side by Side, Brief Builder).
 *
 * The glob is lazy on purpose. A page that eagerly globs its siblings joins
 * an import cycle with the other catalogue pages and reads their exports
 * before they exist. App has already loaded every module by the time these
 * loaders run, so resolving them is instant. */

type PageModule = {
  default: ComponentType;
  title?: string;
  section?: string;
  fullWidth?: boolean;
};

export type CatalogueItem = {
  slug: string;
  title: string;
  section: string;
  sectionLabel: string;
};

export type LoadedPage = {
  slug: string;
  Component: ComponentType;
  fullWidth: boolean;
};

const loaders = import.meta.glob<PageModule>("../pages/*.tsx");

function slugOf(path: string) {
  return path.replace(/^\.\.\/pages\//, "").replace(/\.tsx$/, "");
}

function formatTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

let cache: Promise<CatalogueItem[]> | null = null;

function loadCatalogue(): Promise<CatalogueItem[]> {
  cache ??= Promise.all(
    Object.entries(loaders).map(async ([path, load]) => {
      const slug = slugOf(path);
      const mod = await load();
      const section = sectionForSlug(slug, mod.section);
      return {
        slug,
        title: mod.title ?? formatTitle(slug),
        section,
        sectionLabel: sectionLabel(section),
      };
    }),
  ).then((all) => all.sort((a, b) => a.title.localeCompare(b.title)));
  return cache;
}

/** Every screen, A to Z. Empty for one tick while the modules resolve. */
export function usePageCatalogue(): CatalogueItem[] {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  useEffect(() => {
    let alive = true;
    loadCatalogue().then((all) => {
      if (alive) setItems(all);
    });
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

/** The component for one screen, or null while it loads or if it is unknown. */
export function usePageComponent(slug: string | null): LoadedPage | null {
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  useEffect(() => {
    if (!slug) return;
    const load = loaders[`../pages/${slug}.tsx`];
    if (!load) return;
    let alive = true;
    load().then((mod) => {
      if (!alive) return;
      setLoaded({
        slug,
        Component: mod.default,
        fullWidth: mod.fullWidth ?? false,
      });
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  return loaded && loaded.slug === slug ? loaded : null;
}
