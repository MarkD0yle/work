import { useState } from "react";
import { SIDEBAR_EXAMPLES, type SidebarId } from "../lib/leftSidebars";
import { button, cx, focus } from "../components/patterns/tokens";
import type { SidebarProps } from "../components/left-sidebars/nav-model";
import { HostSurface } from "../components/left-sidebars/HostSurface";
import { GroupedSidebar } from "../components/left-sidebars/GroupedSidebar";
import { IconRailSidebar } from "../components/left-sidebars/IconRailSidebar";
import { DualRailSidebar } from "../components/left-sidebars/DualRailSidebar";
import { TreeSidebar } from "../components/left-sidebars/TreeSidebar";
import { ScopeSwitcherSidebar } from "../components/left-sidebars/ScopeSwitcherSidebar";
import { CycleSidebar } from "../components/left-sidebars/CycleSidebar";
import { WorkQueueSidebar } from "../components/left-sidebars/WorkQueueSidebar";
import { CommandSidebar } from "../components/left-sidebars/CommandSidebar";
import { TerminalSidebar } from "../components/left-sidebars/TerminalSidebar";
import { RoleSidebar } from "../components/left-sidebars/RoleSidebar";

export const title = "Left Sidebar Patterns";
export const section = "patterns";
export const fullWidth = true;

/* Left Sidebar Patterns — ten primary-navigation sidebars for one investment
 * services platform, each shown docked beside a working page.
 *
 * All ten render the same menu (components/left-sidebars/nav-model) and share
 * the same parts (SidebarKit), so the differences are differences of pattern:
 * what the list is ordered by, how much width it takes, and what it tells you
 * besides where the links are.
 *
 * The variations are picked from a strip across the top rather than a rail
 * down the side, so the only left sidebar on screen is the one being shown.
 * The selected page carries over when the variation changes, which makes it
 * easy to compare how each one marks the same location.
 */

const SIDEBARS: Record<SidebarId, (props: SidebarProps) => React.ReactElement> = {
  grouped: GroupedSidebar,
  "icon-rail": IconRailSidebar,
  "dual-rail": DualRailSidebar,
  tree: TreeSidebar,
  scope: ScopeSwitcherSidebar,
  cycle: CycleSidebar,
  queue: WorkQueueSidebar,
  command: CommandSidebar,
  terminal: TerminalSidebar,
  role: RoleSidebar,
};

export default function LeftSidebarPatternsPage() {
  const [variantId, setVariantId] = useState<SidebarId>("grouped");
  const [pageId, setPageId] = useState("cash-rec");
  const [showNotes, setShowNotes] = useState(true);

  const example = SIDEBAR_EXAMPLES.find((e) => e.id === variantId)!;
  const Sidebar = SIDEBARS[variantId];

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed "Home" pill, which floats over the
          top-left corner of every full-width page. */}
      <header className="flex shrink-0 items-end justify-between gap-4 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Investment services · UI patterns
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Left Sidebars
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Ten ways to navigate one fund services platform. Same menu every
            time; only the pattern changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNotes((s) => !s)}
          aria-pressed={showNotes}
          className={cx(button.secondary, "shrink-0")}
        >
          {showNotes ? "Hide notes" : "Show notes"}
        </button>
      </header>

      {/* Variation picker */}
      <nav
        aria-label="Sidebar variations"
        className="shrink-0 overflow-x-auto border-b border-neutral-200 bg-white"
      >
        <ul className="flex min-w-max px-4">
          {SIDEBAR_EXAMPLES.map((e) => {
            const on = e.id === variantId;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setVariantId(e.id)}
                  aria-current={on ? "true" : undefined}
                  className={cx(
                    "flex items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-xs whitespace-nowrap",
                    on
                      ? "border-b-neutral-900 font-semibold text-neutral-900"
                      : "border-b-transparent font-medium text-neutral-500 hover:text-neutral-900",
                    focus,
                    "focus-visible:-outline-offset-2",
                  )}
                >
                  <span className={cx("tabular-nums", on ? "text-neutral-500" : "text-neutral-400")}>
                    {e.n}
                  </span>
                  {e.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        {/* The stage: the sidebar and the page it navigates, as one app. */}
        <div className="flex min-h-0 flex-1 overflow-hidden border border-neutral-200 bg-white">
          {/* key resets a variation's own state (open branches, role, scope)
              when another one is picked. */}
          <Sidebar key={variantId} activeId={pageId} onNavigate={setPageId} />
          <div className="hidden min-w-0 flex-1 sm:block">
            <HostSurface activeId={pageId} />
          </div>
        </div>

        {showNotes && (
          <section
            aria-label="Design notes"
            className="max-h-56 shrink-0 overflow-y-auto border border-neutral-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                {example.pattern}
              </span>
              <h2 className="text-sm font-semibold text-neutral-900">{example.name}</h2>
              <span className="text-[11px] text-neutral-500 tabular-nums">
                {example.width}px wide
              </span>
            </div>
            <p className="mt-1.5 text-xs font-medium text-neutral-900">{example.summary}</p>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-neutral-600">
              {example.rationale}
            </p>
            <dl className="mt-2 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-neutral-900">Best for</dt>
                <dd className="text-neutral-600">{example.bestFor}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-neutral-900">Watch out</dt>
                <dd className="text-neutral-600">{example.watchOut}</dd>
              </div>
            </dl>
          </section>
        )}
      </main>
    </div>
  );
}
