import { useState } from "react";
import { PANEL_EXAMPLES, type PanelId } from "../lib/rightPanels";
import { HostSurface } from "../components/right-panels/HostSurface";
import { OrderTicketPanel } from "../components/right-panels/OrderTicketPanel";
import { InstrumentReferencePanel } from "../components/right-panels/InstrumentReferencePanel";
import { Counterparty360Panel } from "../components/right-panels/Counterparty360Panel";
import { LimitBreachPanel } from "../components/right-panels/LimitBreachPanel";
import { MarketDepthPanel } from "../components/right-panels/MarketDepthPanel";
import { ResearchCopilotPanel } from "../components/right-panels/ResearchCopilotPanel";
import { TradeLifecyclePanel } from "../components/right-panels/TradeLifecyclePanel";
import { BulkAllocationPanel } from "../components/right-panels/BulkAllocationPanel";
import { ScreenFiltersPanel } from "../components/right-panels/ScreenFiltersPanel";
import { DeskCommentaryPanel } from "../components/right-panels/DeskCommentaryPanel";

export const title = "Right Panel Patterns";
export const section = "patterns";
export const fullWidth = true;

/* Right Panel Patterns — ten contextual right panels from across a global
 * markets division, shown in situ rather than as swatches.
 *
 * Each example pairs a panel with the surface it would actually dock beside,
 * because the interesting decisions in this component are all relational: what
 * the panel owes the grid behind it, whether it may take an action on the
 * user's behalf, how much it is allowed to hide, and what happens when it
 * changes on its own. Picking one from the rail swaps both halves.
 *
 * The panels share one chrome (components/right-panels/PanelKit) so the
 * differences between them are differences of pattern, not of styling.
 */

const PANELS: Record<PanelId, (props: { onClose: () => void }) => React.ReactElement> = {
  "order-ticket": OrderTicketPanel,
  "instrument-reference": InstrumentReferencePanel,
  "counterparty-360": Counterparty360Panel,
  "limit-breach": LimitBreachPanel,
  "market-depth": MarketDepthPanel,
  "research-copilot": ResearchCopilotPanel,
  "trade-lifecycle": TradeLifecyclePanel,
  "bulk-allocation": BulkAllocationPanel,
  "screen-filters": ScreenFiltersPanel,
  "desk-commentary": DeskCommentaryPanel,
};

export default function RightPanelPatternsPage() {
  const [activeId, setActiveId] = useState<PanelId>("order-ticket");
  const [open, setOpen] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  const example = PANEL_EXAMPLES.find((e) => e.id === activeId)!;
  const Panel = PANELS[activeId];

  function select(id: PanelId) {
    setActiveId(id);
    setOpen(true);
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed "Home" pill, which floats over the
          top-left corner of every full-width page. */}
      <header className="flex shrink-0 items-end justify-between gap-4 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Global markets · UI patterns
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Contextual Right Panels
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Ten panels, one chrome — transact, inspect, triage, filter and
            discuss, each shown against the surface it docks beside.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            {showNotes ? "Hide notes" : "Show notes"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            {open ? "Collapse panel" : "Open panel"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Example rail */}
        <nav
          aria-label="Panel examples"
          className="hidden w-64 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white md:block"
        >
          <ul className="py-2">
            {PANEL_EXAMPLES.map((e) => {
              const on = e.id === activeId;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => select(e.id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-start gap-2.5 border-l-2 px-4 py-2.5 text-left transition ${
                      on
                        ? "border-l-neutral-900 bg-neutral-50"
                        : "border-l-transparent hover:bg-neutral-50"
                    }`}
                  >
                    <span
                      className={`mt-px w-4 shrink-0 text-right text-[11px] tabular-nums ${
                        on ? "text-neutral-900" : "text-neutral-300"
                      }`}
                    >
                      {e.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs font-medium ${
                          on ? "text-neutral-900" : "text-neutral-700"
                        }`}
                      >
                        {e.name}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-400">
                        {e.pattern} · {e.desk}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Host surface + design note */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
          {/* Below lg the column would crowd the host, so the split stacks
              instead. The panel is rendered exactly once either way — a second
              copy behind a `lg:hidden` would duplicate its state, its live
              intervals and its landmark role. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1">
              <HostSurface example={example} />
            </div>

            <div
              className="h-[440px] w-full shrink-0 border-t border-neutral-200 lg:h-auto lg:w-(--panel-w) lg:border-t-0"
              style={
                {
                  "--panel-w": `${open ? example.width : 56}px`,
                } as React.CSSProperties
              }
            >
              {open ? (
                <Panel onClose={() => setOpen(false)} />
              ) : (
                /* Collapsed rail — the panel's resting state, not its absence. */
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label={`Open ${example.name} panel`}
                  className="flex h-full w-full flex-row items-center justify-center gap-3 bg-neutral-50 py-4 hover:bg-neutral-100 lg:flex-col lg:border-l lg:border-neutral-200"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 text-neutral-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.53 4.28a.75.75 0 0 1 0 1.06L7.81 10l4.72 4.66a.75.75 0 1 1-1.06 1.06l-5.25-5.19a.75.75 0 0 1 0-1.06l5.25-5.19a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase lg:[writing-mode:vertical-rl]">
                    {example.pattern}
                  </span>
                </button>
              )}
            </div>
          </div>

          {showNotes && (
            <section className="mt-3 shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {example.pattern}
                </span>
                <h3 className="text-sm font-semibold text-neutral-900">
                  {example.name}
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {example.desk} · {example.width}px wide
                </span>
              </div>
              <p className="mt-1.5 text-xs text-neutral-600">{example.summary}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                {example.rationale}
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
