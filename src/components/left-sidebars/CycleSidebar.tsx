import { Check, Lock, LoaderCircle, TriangleAlert } from "lucide-react";
import { cx, focus } from "../patterns/tokens";
import { NAV_MODULES, VALUATION_DATE, findItem, type SidebarProps } from "./nav-model";
import { Brand, GroupLabel, NavLink, SidebarFrame, UserFooter } from "./SidebarKit";

/* 6 — NAV cycle.
 *
 * The daily NAV is a dependency chain, so the sidebar is ordered as one.
 * Each step is a page, listed in the order the work has to happen, with its
 * state. Reading down the column answers "where is today's NAV and what is
 * holding it up" before any page is opened.
 *
 * Locked steps stay reachable. Locking describes the workflow, not the
 * user's access, and people still need to look ahead.
 */

type StepState = "done" | "attention" | "active" | "waiting" | "locked";

type Step = { id: string; state: StepState; note: string };

const STEPS: Step[] = [
  { id: "dealing", state: "done", note: "Orders loaded 14:02" },
  { id: "corporate-actions", state: "done", note: "9 events applied" },
  { id: "cash-rec", state: "done", note: "Matched, 2 breaks accepted" },
  { id: "position-rec", state: "attention", note: "6 breaks blocking pricing" },
  { id: "pricing", state: "active", note: "38 of 42 funds priced" },
  { id: "accruals", state: "waiting", note: "Starts after pricing" },
  { id: "fees", state: "waiting", note: "Starts after accruals" },
  { id: "nav-production", state: "waiting", note: "Due 17:30 GMT" },
  { id: "nav-signoff", state: "locked", note: "Checker review" },
  { id: "client-reporting", state: "locked", note: "Publish to clients 18:00" },
];

const STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  attention: "Needs attention",
  active: "In progress",
  waiting: "Waiting",
  locked: "Locked",
};

const MARKER: Record<StepState, string> = {
  done: "border-emerald-600 bg-emerald-600 text-white",
  attention: "border-amber-400 bg-amber-400 text-neutral-900",
  active: "border-neutral-900 bg-white text-neutral-900",
  waiting: "border-neutral-300 bg-white text-neutral-400",
  locked: "border-neutral-200 bg-neutral-100 text-neutral-400",
};

const STEP_IDS = new Set(STEPS.map((s) => s.id));
const DONE = STEPS.filter((s) => s.state === "done").length;

export function CycleSidebar({ activeId, onNavigate }: SidebarProps) {
  return (
    <SidebarFrame label="NAV cycle sidebar" className="w-72">
      <Brand />

      <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Daily NAV cycle
          </span>
          <span className="text-[11px] text-neutral-500 tabular-nums">{VALUATION_DATE}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-neutral-900">
            Step {DONE + 1} of {STEPS.length}
          </span>
          <span className="text-[11px] font-medium text-amber-700">NAV due in 2h 14m</span>
        </div>
        <div
          role="progressbar"
          aria-label="Cycle progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={DONE}
          className="mt-2 flex gap-0.5"
        >
          {STEPS.map((step) => (
            <span
              key={step.id}
              className={cx(
                "h-1 flex-1",
                step.state === "done" && "bg-emerald-600",
                step.state === "attention" && "bg-amber-400",
                step.state === "active" && "bg-neutral-900",
                (step.state === "waiting" || step.state === "locked") && "bg-neutral-200",
              )}
            />
          ))}
        </div>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-3">
        <ol className="py-2">
          {STEPS.map((step, i) => {
            const item = findItem(step.id);
            const on = step.id === activeId;
            const last = i === STEPS.length - 1;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(step.id)}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex w-full items-stretch gap-3 border-l-2 pr-3 pl-3.5 text-left",
                    on
                      ? "border-l-neutral-900 bg-neutral-100"
                      : "border-l-transparent hover:bg-neutral-50",
                    focus,
                    "focus-visible:-outline-offset-2",
                  )}
                >
                  <span className="flex w-5 shrink-0 flex-col items-center">
                    <span
                      className={cx(
                        "mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        MARKER[step.state],
                      )}
                    >
                      <StepIcon state={step.state} n={i + 1} />
                    </span>
                    {!last && (
                      <span
                        aria-hidden
                        className={cx(
                          "mt-0.5 w-px flex-1",
                          step.state === "done" ? "bg-emerald-600" : "bg-neutral-200",
                        )}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-1.5 leading-tight">
                    <span
                      className={cx(
                        "block truncate",
                        on || step.state === "active" || step.state === "attention"
                          ? "font-semibold text-neutral-900"
                          : step.state === "locked"
                            ? "text-neutral-500"
                            : "text-neutral-700",
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cx(
                        "block truncate text-[11px]",
                        step.state === "attention" ? "text-amber-700" : "text-neutral-500",
                      )}
                    >
                      <span className="sr-only">{STATE_LABEL[step.state]}. </span>
                      {step.note}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="border-t border-neutral-200">
          <GroupLabel>Outside the cycle</GroupLabel>
          <ul>
            {NAV_MODULES.flatMap((m) => m.items)
              .filter((item) => !STEP_IDS.has(item.id))
              .map((item) => (
                <li key={item.id}>
                  <NavLink
                    label={item.label}
                    active={item.id === activeId}
                    onClick={() => onNavigate(item.id)}
                    count={item.count}
                    tone={item.tone}
                  />
                </li>
              ))}
          </ul>
        </div>
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}

function StepIcon({ state, n }: { state: StepState; n: number }) {
  const cls = "h-3 w-3";
  if (state === "done") return <Check aria-hidden className={cls} />;
  if (state === "attention") return <TriangleAlert aria-hidden className={cls} />;
  if (state === "active")
    return <LoaderCircle aria-hidden className={cx(cls, "animate-spin motion-reduce:animate-none")} />;
  if (state === "locked") return <Lock aria-hidden className="h-2.5 w-2.5" />;
  return <span className="text-[9px] font-semibold tabular-nums">{n}</span>;
}
