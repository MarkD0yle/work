import type { CatalogueItem } from "../hooks/usePageCatalogue";
import { metaForSlug } from "./galleryMeta";

/* What's new — the feed behind the What's New tour and page.
 *
 * Two sources, merged newest first:
 *   1. ANNOUNCEMENTS: hand-written notes about features. To announce
 *      something, add one entry at the top. That is the whole release note.
 *   2. New screens: automatic, from the date git first saw each page
 *      (`__PAGES_ADDED_AT__`, see vite.config.ts). */

export type FeedItem = {
  id: string;
  /** Unix seconds. */
  ts: number;
  kind: "feature" | "screen";
  title: string;
  summary: string;
  /** Screen to open from the entry. */
  slug: string;
};

function day(year: number, month: number, date: number) {
  return Math.floor(Date.UTC(year, month - 1, date) / 1000);
}

export const ANNOUNCEMENTS: Omit<FeedItem, "kind">[] = [
  {
    id: "landing",
    ts: day(2026, 11, 10),
    title: "A new home page",
    summary:
      "Absurd Alpha now opens on a landing page that shows what you can find, build and share. The gallery is one click away.",
    slug: "gallery",
  },
  {
    id: "brief-builder",
    ts: day(2026, 11, 10),
    title: "Brief Builder",
    summary:
      "Pick a base screen, patterns and house rules, and copy one prompt your AI assistant can follow.",
    slug: "brief-builder",
  },
  {
    id: "drift-radar",
    ts: day(2026, 11, 10),
    title: "Drift Radar",
    summary:
      "See which screens have drifted from the design rules, and copy a prompt that fixes one.",
    slug: "drift-radar",
  },
  {
    id: "demo-reel",
    ts: day(2026, 11, 10),
    title: "Demo Reel",
    summary:
      "Queue up screens and play them full screen for a stakeholder walk-through.",
    slug: "demo-reel",
  },
  {
    id: "side-by-side",
    ts: day(2026, 11, 10),
    title: "Side by Side",
    summary: "Put two screens next to each other to compare variants.",
    slug: "side-by-side",
  },
  {
    id: "whats-new",
    ts: day(2026, 11, 10),
    title: "What's New tour",
    summary:
      "A short walk-through of what changed since your last visit. This is it.",
    slug: "whats-new",
  },
];

const ADDED_AT: Record<string, number> = __PAGES_ADDED_AT__;

export function buildFeed(catalogue: CatalogueItem[]): FeedItem[] {
  const announced = new Set(ANNOUNCEMENTS.map((a) => a.slug));
  const screens: FeedItem[] = catalogue
    .filter((item) => !announced.has(item.slug) && ADDED_AT[item.slug])
    .map((item) => ({
      id: `screen:${item.slug}`,
      ts: ADDED_AT[item.slug],
      kind: "screen",
      title: item.title,
      summary: metaForSlug(item.slug, item.section).description,
      slug: item.slug,
    }));
  const features: FeedItem[] = ANNOUNCEMENTS.map((a) => ({
    ...a,
    kind: "feature",
  }));
  return [...features, ...screens].sort(
    (a, b) =>
      b.ts - a.ts ||
      (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === "feature" ? -1 : 1),
  );
}

export function formatFeedDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** localStorage keys shared by the landing page and the What's New page. */
export const LAST_SEEN_KEY = "whatsNew.lastSeen";
export const WELCOME_SEEN_KEY = "tour.welcomeSeen";

/** Longest tour worth sitting through. */
export const TOUR_MAX_STEPS = 6;
