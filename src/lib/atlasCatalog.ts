/* Atlas catalogue.
 *
 * The Pattern Atlas (src/pages/pattern-atlas.tsx) explores several gallery
 * layouts — masonry, board, list — over the same auto-discovered set of pages
 * the File Gallery uses. This module builds that shared catalogue once and
 * adds the bits the Atlas needs on top of the gallery metadata: the date each
 * page was first added (for the Recent sort and the "New" badge) and a stable
 * per-item seed used to vary masonry card proportions. */

import type { ComponentType } from "react";
import { sectionForSlug, sectionLabel } from "./pageSections";
import {
  accentForSection,
  metaForSlug,
  type Accent,
  type Motif,
} from "./galleryMeta";

export type AtlasItem = {
  slug: string;
  title: string;
  section: string;
  sectionLabel: string;
  description: string;
  tags: string[];
  motif: Motif;
  accent: Accent;
  /** Unix seconds the page was first added (0 when unknown). */
  addedAt: number;
  /** Deterministic per-item seed for visual variation. */
  seed: number;
};

type PageModule = {
  default: ComponentType;
  title?: string;
  section?: string;
};

const pageModules = import.meta.glob<PageModule>("/src/pages/*.tsx", {
  eager: true,
});

// Unix time each page was first added (injected at build time — see
// vite.config.ts). Missing slugs sort last under "Recent".
const ADDED_AT: Record<string, number> = __PAGES_ADDED_AT__;

function formatTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Small string hash so each card keeps the same proportions across filters
// and renders (an index-based seed would reshuffle whenever the list narrows).
function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/* Build the catalogue lazily on first access, not at module load. This file
 * sits inside an import cycle (page → this module → glob of every page), so
 * touching another page's `export const title` during module evaluation could
 * hit its temporal dead zone. By first render every module has evaluated. */
let cached: AtlasItem[] | null = null;

export function getAtlasItems(): AtlasItem[] {
  if (cached) return cached;
  cached = Object.entries(pageModules)
    .map(([path, mod]) => {
      const slug = path.replace(/^\/src\/pages\//, "").replace(/\.tsx$/, "");
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
        addedAt: ADDED_AT[slug] ?? 0,
        seed: hashSlug(slug),
      };
    })
    .filter((item) => item.slug !== "pattern-atlas")
    .sort((a, b) => a.title.localeCompare(b.title));
  return cached;
}

/** Pages added within this many days wear a "New" badge. */
export const NEW_WINDOW_DAYS = 21;

export function isNew(item: AtlasItem): boolean {
  if (!item.addedAt) return false;
  return Date.now() / 1000 - item.addedAt < NEW_WINDOW_DAYS * 86400;
}

/** Compact relative date for card footers: "today", "3d ago", "Jun 2026". */
export function relativeAdded(addedAt: number): string {
  if (!addedAt) return "—";
  const days = Math.floor((Date.now() / 1000 - addedAt) / 86400);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return new Date(addedAt * 1000).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}
