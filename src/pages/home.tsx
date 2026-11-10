import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FeatureShowcase, type ShowcaseExample } from "../components/landing/FeatureShowcase";
import { Tour, type TourStep } from "../components/landing/Tour";
import {
  ComparePreview,
  DriftPreview,
  DriftSummaryPreview,
  FeedPreview,
  PromptPreview,
  ReelPreview,
  ScreensPreview,
  TourPreview,
} from "../components/landing/previews";
import { cx, focus } from "../components/patterns/tokens";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { usePageCatalogue } from "../hooks/usePageCatalogue";
import { clearNavParams, navigateToPage, peekNavParams } from "../lib/navigation";
import { driftForSlug, type DriftLevel } from "../lib/pageIntel";
import {
  LAST_SEEN_KEY,
  TOUR_MAX_STEPS,
  WELCOME_SEEN_KEY,
  buildFeed,
  formatFeedDate,
} from "../lib/whatsNew";

export const title = "Home";
export const section = "patterns";
export const fullWidth = true;

/* Home — the Absurd Alpha landing page.
 *
 * It answers three questions in order: what is here (Find), how do I make
 * more of it (Build), and how do I show it to someone (Share). Each answer
 * is a FeatureShowcase that rotates through real examples, and every example
 * ends in one button that opens the real thing.
 *
 * The page also hosts the two tours: the welcome tour, which opens once on a
 * first visit, and the What's New tour, which the top-bar button starts. */

/** Areas shown in the Find section, with one line on what is inside. */
const DISTRICTS: { id: string; detail: string }[] = [
  { id: "trading", detail: "Blotters, order tickets and liquidity views for the desk." },
  { id: "risk", detail: "Exposure, limits and stress views for risk managers." },
  { id: "dashboards", detail: "One dashboard for each corner of financial services." },
  { id: "wealth", detail: "Client, portfolio and goal views for advisers." },
];

type TourKind = "welcome" | "news";

const primaryButton = cx(
  "bg-neutral-950 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700",
  focus,
);
const secondaryButton = cx(
  "border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100",
  focus,
);
const navLink = cx("px-2 py-1 text-sm text-neutral-600 hover:text-neutral-950", focus);

export default function HomePage() {
  const catalogue = usePageCatalogue();
  const [query, setQuery] = useState("");
  const [welcomeSeen, setWelcomeSeen] = useLocalStorage(WELCOME_SEEN_KEY, false);
  const [lastSeen, setLastSeen] = useLocalStorage(LAST_SEEN_KEY, 0);
  const [tour, setTour] = useState<TourKind | null>(() => {
    const requested = peekNavParams("home").tour;
    if (requested === "welcome" || requested === "news") return requested;
    return welcomeSeen ? null : "welcome";
  });

  useEffect(() => clearNavParams(), []);

  const bySlug = useMemo(
    () => Object.fromEntries(catalogue.map((item) => [item.slug, item])),
    [catalogue],
  );
  const areaCount = useMemo(() => new Set(catalogue.map((item) => item.section)).size, [catalogue]);

  const feed = useMemo(() => buildFeed(catalogue), [catalogue]);
  const unseen = useMemo(() => feed.filter((item) => item.ts > lastSeen), [feed, lastSeen]);

  const drift = useMemo(() => {
    const rows = catalogue
      .flatMap((item) => {
        const d = driftForSlug(item.slug);
        return d ? [{ slug: item.slug, title: item.title, ...d }] : [];
      })
      .sort((a, b) => b.points - a.points);
    const counts: Record<DriftLevel, number> = { clean: 0, low: 0, medium: 0, high: 0 };
    for (const row of rows) counts[row.level] += 1;
    return { rows, counts };
  }, [catalogue]);

  function closeTour() {
    if (tour === "welcome") setWelcomeSeen(true);
    if (tour === "news") setLastSeen(Math.floor(Date.now() / 1000));
    setTour(null);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigateToPage("gallery", q ? { query: q } : undefined);
  }

  function surprise() {
    if (catalogue.length === 0) return;
    navigateToPage(catalogue[Math.floor(Math.random() * catalogue.length)].slug);
  }

  /* ---------- Find: real screens, one example per area ---------- */
  const findExamples: ShowcaseExample[] = DISTRICTS.flatMap((district) => {
    const items = catalogue.filter((item) => item.section === district.id);
    if (items.length === 0) return [];
    const label = items[0].sectionLabel;
    return [
      {
        id: district.id,
        label,
        detail: district.detail,
        preview: <ScreensPreview items={items.slice(0, 3)} total={items.length} label={label} />,
        cta: {
          label: `Browse ${label}`,
          onClick: () => navigateToPage("gallery", { section: district.id }),
        },
      },
    ];
  });

  /* ---------- Build: brief the AI, then check what it made ---------- */
  const worst = drift.rows[0];
  const buildExamples: ShowcaseExample[] = [
    {
      id: "brief",
      label: "Brief a new screen",
      detail: "Name it, state the goal, tick the rules. Copy one prompt your AI assistant can follow.",
      preview: (
        <PromptPreview
          lines={[
            "Build a new screen for the Absurd Alpha prototype gallery.",
            "",
            "Screen: FX Swap Blotter",
            "File: src/pages/fx-swap-blotter.tsx",
            "Goal: A trader rolls the swaps maturing tomorrow.",
            "",
            "House rules:",
            "1. Use square corners everywhere.",
            "2. Do not write hex colours.",
            "3. Do not use the `style` prop.",
          ]}
        />
      ),
      cta: { label: "Open Brief Builder", onClick: () => navigateToPage("brief-builder") },
    },
    {
      id: "remix",
      label: "Start from a screen that works",
      detail: "Point the AI at an existing screen so it copies a layout the team already likes.",
      preview: (
        <PromptPreview
          lines={[
            "Start from: src/pages/blotter.tsx (Blotter)",
            "Read it first. Keep its layout and data shape,",
            "and change only what the goal needs.",
            "",
            "Reuse these patterns:",
            'import { DataTable, FilterBar, StatusBadge }',
            '  from "../components/patterns";',
          ]}
        />
      ),
      cta: {
        label: "Remix the Blotter",
        onClick: () => navigateToPage("brief-builder", { base: "blotter" }),
      },
    },
    {
      id: "drift",
      label: "Spot the drift",
      detail: "See which screens picked up rounded corners, raw hex colours and inline styles.",
      preview: <DriftPreview rows={drift.rows.slice(0, 4)} />,
      cta: { label: "Open Drift Radar", onClick: () => navigateToPage("drift-radar") },
    },
    {
      id: "health",
      label: "Check the whole gallery",
      detail: worst
        ? `Most drift right now: ${worst.title}. Copy a fix prompt for any screen in one click.`
        : "Every screen gets a drift level. Copy a fix prompt for any of them in one click.",
      preview: <DriftSummaryPreview counts={drift.counts} />,
      cta: { label: "See every screen", onClick: () => navigateToPage("drift-radar") },
    },
  ];

  /* ---------- Share: show the work to someone else ---------- */
  const reelItems = catalogue.filter((item) => item.section === "dashboards").slice(0, 4);
  const shareExamples: ShowcaseExample[] = [
    {
      id: "reel",
      label: "Play a demo reel",
      detail: "Queue up screens once, then let them play full screen in the meeting.",
      preview: <ReelPreview items={reelItems} />,
      cta: { label: "Open Demo Reel", onClick: () => navigateToPage("demo-reel") },
    },
    {
      id: "compare",
      label: "Compare two variants",
      detail: "Put two screens next to each other at the same scale and decide which one wins.",
      preview: <ComparePreview a={bySlug["fund-connect"]} b={bySlug["fund-connect-2"]} />,
      cta: { label: "Open Side by Side", onClick: () => navigateToPage("side-by-side") },
    },
    {
      id: "news",
      label: "See what's new",
      detail: "A short walk-through of the features and screens added since your last visit.",
      preview: <FeedPreview items={feed.slice(0, 3)} />,
      cta: { label: "Start the What's New tour", onClick: () => setTour("news") },
    },
    {
      id: "welcome",
      label: "Take the welcome tour",
      detail: "New here? Five steps cover where things are and what each tool is for.",
      preview: <TourPreview />,
      cta: { label: "Start the welcome tour", onClick: () => setTour("welcome") },
    },
  ];

  /* ---------- Tours ---------- */
  const welcomeSteps: TourStep[] = [
    {
      id: "hero",
      target: "hero",
      title: "Welcome to Absurd Alpha",
      body: "A gallery of capital-markets screens the team builds by prompting AI. Search here to jump straight to one.",
    },
    {
      id: "find",
      target: "find",
      title: "Find a screen",
      body: "Every screen lives in the gallery, grouped by area. These sections rotate through examples; click one to hold it.",
    },
    {
      id: "build",
      target: "build",
      title: "Build with a brief",
      body: "Brief Builder writes the prompt, with the house rules included. Drift Radar shows where a screen needs tidying.",
    },
    {
      id: "share",
      target: "share",
      title: "Share the result",
      body: "Play screens as a demo reel, or put two variants side by side.",
    },
    {
      id: "news",
      target: "whats-new",
      title: "Keep up",
      body: "A dot on What's new means something was added since your last visit. You can replay this tour from the Share section.",
    },
  ];

  const newsSource = unseen.length > 0 ? unseen : feed;
  const newsSteps: TourStep[] = newsSource.slice(0, TOUR_MAX_STEPS).map((item) => ({
    id: item.id,
    kicker: `${item.kind === "feature" ? "New feature" : "New screen"} · ${formatFeedDate(item.ts)}`,
    title: item.title,
    body: item.summary,
    action: { label: "Open it", onClick: () => navigateToPage(item.slug) },
  }));
  if (newsSource.length > TOUR_MAX_STEPS) {
    newsSteps.push({
      id: "more",
      title: `${newsSource.length - TOUR_MAX_STEPS} more`,
      body: "That covers the latest. The What's New page lists everything.",
      action: { label: "See the full list", onClick: () => navigateToPage("whats-new") },
    });
  }

  const steps = tour === "welcome" ? welcomeSteps : newsSteps;

  return (
    <div className="h-screen overflow-y-auto bg-white text-neutral-900">
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-8">
          <span className="mr-auto text-sm font-semibold tracking-tight text-neutral-950">Absurd Alpha</span>
          <nav aria-label="Main" className="flex items-center gap-1">
            <button type="button" className={navLink} onClick={() => navigateToPage("gallery")}>
              Gallery
            </button>
            <button
              type="button"
              className={cx(navLink, "hidden sm:inline-block")}
              onClick={() => navigateToPage("pattern-library")}
            >
              Pattern library
            </button>
            <button
              type="button"
              data-tour="whats-new"
              className={cx(navLink, "inline-flex items-center gap-1.5")}
              onClick={() => setTour("news")}
            >
              What's new
              {unseen.length > 0 && (
                <>
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  <span className="sr-only">({unseen.length} unread)</span>
                </>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section data-tour="hero" className="relative overflow-hidden">
        <div aria-hidden className="landing-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-8 sm:py-28">
          <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">
            {catalogue.length} screens · {areaCount} areas
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance text-neutral-950 sm:text-6xl">
            Capital-markets screens, built by prompting.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            Find a screen. Brief your AI to build the next one. Show the result.
          </p>

          <form onSubmit={onSearch} role="search" className="mx-auto mt-10 flex max-w-xl">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search screens, e.g. blotter, margin, onboarding"
              aria-label="Search screens"
              className={cx(
                "min-w-0 flex-1 rounded-none border border-r-0 border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400",
                focus,
              )}
            />
            <button type="submit" className={primaryButton}>
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className={secondaryButton} onClick={() => navigateToPage("gallery")}>
              Open the gallery
            </button>
            <button type="button" className={secondaryButton} onClick={surprise}>
              Surprise me
            </button>
          </div>
        </div>
      </section>

      {/* ---------- Rotating feature sections ---------- */}
      {findExamples.length > 0 && (
        <FeatureShowcase
          tourId="find"
          eyebrow="Find"
          title="Every screen, by area."
          blurb="Start from something that already exists. The gallery groups every screen by the desk it serves."
          examples={findExamples}
        />
      )}
      <FeatureShowcase
        tourId="build"
        eyebrow="Build"
        title="Brief the AI. Then check its work."
        blurb="A good prompt carries the house rules with it. A quick scan shows where a screen drifted anyway."
        examples={buildExamples}
        flip
      />
      <FeatureShowcase
        tourId="share"
        eyebrow="Share"
        title="Show it to someone."
        blurb="Walk a stakeholder through the work, compare options, and keep the team up to date."
        examples={shareExamples}
      />

      <footer className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-500 sm:px-8">
          Add a file to <code className="font-mono">src/pages</code> and it shows up here.
        </div>
      </footer>

      {tour && steps.length > 0 && (
        <Tour
          key={tour}
          label={tour === "welcome" ? "Welcome tour" : "What's new"}
          steps={steps}
          onClose={closeTour}
        />
      )}
    </div>
  );
}
