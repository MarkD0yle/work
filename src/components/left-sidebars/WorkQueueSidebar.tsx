import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cx, focus, tone as toneTokens, type Tone } from "../patterns/tokens";
import { ALL_ITEMS, findItem, type SidebarProps } from "./nav-model";
import { Brand, NavLink, SidebarFrame, UserFooter } from "./SidebarKit";

/* 7 — Work queue.
 *
 * Navigation sorted by what needs doing rather than by where it lives. Pages
 * with open items rise to the top, most urgent first, each with its count and
 * the deadline that makes it urgent. Pages with nothing waiting fold into one
 * line at the bottom.
 *
 * The order moves during the day. That is the trade: an operator's eye goes
 * to the top row instead of to a remembered position.
 */

type QueueRow = {
  id: string;
  tone: Tone;
  mine: number;
  team: number;
  /** Why this is where it is in the list. */
  due: string;
};

/* Already in urgency order: breaching first, then by deadline. */
const QUEUE: QueueRow[] = [
  { id: "cash-rec", tone: "negative", mine: 5, team: 14, due: "3 past SLA · oldest 4 days" },
  { id: "settlements", tone: "negative", mine: 2, team: 5, due: "Fails · CSD cut-off 15:00" },
  { id: "breaks", tone: "negative", mine: 6, team: 23, due: "8 over USD 1m" },
  { id: "position-rec", tone: "warning", mine: 3, team: 6, due: "Blocking pricing · due 15:30" },
  { id: "pricing", tone: "warning", mine: 4, team: 12, due: "Stale prices · due 16:00" },
  { id: "nav-production", tone: "warning", mine: 1, team: 4, due: "Funds not started · due 17:30" },
  { id: "corporate-actions", tone: "warning", mine: 0, team: 9, due: "Elections close tomorrow" },
  { id: "investor-kyc", tone: "warning", mine: 0, team: 5, due: "Refresh overdue" },
  { id: "nav-signoff", tone: "info", mine: 2, team: 7, due: "Awaiting checker" },
  { id: "dealing", tone: "info", mine: 0, team: 31, due: "Next dealing point 12:00 Thu" },
  { id: "transaction-rec", tone: "neutral", mine: 1, team: 3, due: "Due end of day" },
  { id: "tax-reclaims", tone: "neutral", mine: 0, team: 2, due: "Filing window to 30 Nov" },
  { id: "regulatory", tone: "neutral", mine: 0, team: 1, due: "Annex IV · due 30 Nov" },
];

type View = "mine" | "team";

export function WorkQueueSidebar({ activeId, onNavigate }: SidebarProps) {
  const [view, setView] = useState<View>("team");
  const [showQuiet, setShowQuiet] = useState(false);

  const rows = QUEUE.filter((r) => r[view] > 0);
  const total = rows.reduce((sum, r) => sum + r[view], 0);
  const urgent = rows.filter((r) => r.tone === "negative").reduce((sum, r) => sum + r[view], 0);
  const busy = new Set(rows.map((r) => r.id));
  const quiet = ALL_ITEMS.filter((item) => !busy.has(item.id));

  return (
    <SidebarFrame label="Work queue sidebar" className="w-72">
      <Brand />

      <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="leading-tight">
            <div className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
              {total}
            </div>
            <div className="text-[11px] text-neutral-500">
              open items ·{" "}
              <span className="font-medium text-red-700 tabular-nums">{urgent} urgent</span>
            </div>
          </div>
          <div role="group" aria-label="Whose work" className="flex border border-neutral-300">
            {(["mine", "team"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cx(
                  "px-2.5 py-1 text-[11px] font-medium",
                  view === v
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-100",
                  focus,
                )}
              >
                {v === "mine" ? "Mine" : "Team"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto">
        <ul>
          {rows.map((row) => {
            const item = findItem(row.id);
            const on = row.id === activeId;
            return (
              <li key={row.id} className="border-b border-neutral-100">
                <button
                  type="button"
                  onClick={() => onNavigate(row.id)}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex w-full items-center gap-3 border-l-4 py-2 pr-4 pl-3 text-left",
                    toneTokens[row.tone].rail,
                    on ? "bg-neutral-100" : "hover:bg-neutral-50",
                    focus,
                    "focus-visible:-outline-offset-2",
                  )}
                >
                  <span className="min-w-0 flex-1 leading-tight">
                    <span
                      className={cx(
                        "block truncate text-neutral-900",
                        on ? "font-semibold" : "font-medium",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">{row.due}</span>
                  </span>
                  <span
                    className={cx(
                      "shrink-0 text-base font-semibold tabular-nums",
                      row.tone === "neutral" ? "text-neutral-900" : toneTokens[row.tone].text,
                    )}
                  >
                    {row[view]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setShowQuiet((s) => !s)}
          aria-expanded={showQuiet}
          className={cx(
            "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            focus,
            "focus-visible:-outline-offset-2",
          )}
        >
          <ChevronRight
            aria-hidden
            className={cx(
              "h-3.5 w-3.5 text-neutral-400 transition-transform motion-reduce:transition-none",
              showQuiet && "rotate-90",
            )}
          />
          Nothing waiting
          <span className="text-neutral-400 tabular-nums">{quiet.length}</span>
        </button>
        {showQuiet && (
          <ul className="pb-3">
            {quiet.map((item) => (
              <li key={item.id}>
                <NavLink
                  label={item.label}
                  active={item.id === activeId}
                  onClick={() => onNavigate(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}
