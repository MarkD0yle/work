import { useMemo, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Icon } from "../components/app-home/Icon";
import { ICON } from "../components/app-home/icons";
import { APPS } from "../components/app-home/data";
import CardsView from "../components/app-home/CardsView";
import SheetView from "../components/app-home/SheetView";

export const title = "App Home";
export const section = "patterns";
export const fullWidth = true;

/* App Home — the landing surface for a multi-app platform.
 *
 * Three stacked bands, each answering a different question:
 *   1. Launchpad     — "where do I go?"  Four-across app tiles carrying
 *      nothing but an icon and a title.
 *   2. Release notes — "what changed?"   Dated, newest first.
 *   3. Key contacts  — "who do I ask?"   Grouped directory rows.
 *
 * Two layouts of the same content, switched from the top bar and remembered
 * in localStorage so a refresh keeps your pick:
 *
 *   Cards — airy. Discrete tiles on a grey field, icon above title, a resting
 *           accent colour per app so you target by colour before reading.
 *   Sheet — dense. One continuous hairline grid, icon beside title, colour
 *           held back until hover. Roughly 40% shorter.
 *
 * This page owns only the chrome both layouts share — brand, search, layout
 * toggle, account. Everything below the top bar belongs to the active layout,
 * so the two are free to differ all the way up to the header band. */

const LAYOUTS = [
  { id: "cards", label: "Cards" },
  { id: "sheet", label: "Sheet" },
] as const;

type LayoutId = (typeof LAYOUTS)[number]["id"];

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function AppHomePage() {
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useLocalStorage<LayoutId>(
    "app-home.layout",
    "cards",
  );

  const trimmed = query.trim().toLowerCase();
  const visibleApps = useMemo(
    () =>
      trimmed
        ? APPS.filter((app) => app.name.toLowerCase().includes(trimmed))
        : APPS,
    [trimmed],
  );

  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const View = layout === "sheet" ? SheetView : CardsView;

  return (
    <div className="h-full overflow-y-auto bg-neutral-100 text-neutral-900">
      {/* ---------- Top bar ----------
       * Sticky so search and the layout toggle stay reachable once the page
       * scrolls past the launchpad. */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-8 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center bg-neutral-900 text-xs font-bold text-white">
              M
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Meridian
            </span>
            <span className="border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              UAT
            </span>
          </div>

          <div className="relative ml-auto w-full max-w-xs">
            <Icon
              path={ICON.search}
              className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search applications"
              aria-label="Search applications"
              className="w-full border border-neutral-200 bg-neutral-50 py-1.5 pr-3 pl-8 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Layout toggle — segmented, active segment inverts. */}
          <div
            className="flex border border-neutral-200"
            role="group"
            aria-label="Home layout"
          >
            {LAYOUTS.map((option) => {
              const active = option.id === layout;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLayout(option.id)}
                  aria-pressed={active}
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-inset ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="relative shrink-0 text-neutral-500 transition hover:text-neutral-900"
            aria-label="Notifications"
          >
            <Icon path={ICON.bell} className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-rose-500" />
          </button>

          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-neutral-200 text-[11px] font-semibold text-neutral-700">
            MD
          </span>
        </div>
      </header>

      <View
        apps={visibleApps}
        query={query}
        greeting={greeting}
        today={today}
      />
    </div>
  );
}
