import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cx, focus, type Tone } from "../patterns/tokens";
import { NAV_MODULES, VALUATION_DATE, type SidebarProps } from "./nav-model";
import { Brand, GroupLabel, NavLink, SidebarFrame, ToneDot, UserFooter } from "./SidebarKit";

/* 5 — Scope switcher.
 *
 * In fund administration the first question is never "which page" but "which
 * fund". The scope control sits above the navigation and everything under it
 * follows: the counts on every link are for the fund in scope, so the sidebar
 * doubles as that fund's status board.
 *
 * Changing scope does not change the page. An accountant on Cash
 * Reconciliation stays there and sees the next fund's breaks.
 */

type Scope = {
  id: string;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  /** Open items per page for this scope. `null` uses the platform totals. */
  counts: Record<string, number> | null;
};

const SCOPES: Scope[] = [
  {
    id: "all",
    name: "All funds",
    detail: "Aldgate Asset Management · 42 funds",
    status: "31 of 42 NAVs released",
    tone: "info",
    counts: null,
  },
  {
    id: "global-equity",
    name: "Aldgate Global Equity UCITS",
    detail: "USD · Daily · 6 share classes",
    status: "Pricing in progress",
    tone: "warning",
    counts: { "nav-production": 1, pricing: 4, "cash-rec": 2, "position-rec": 1, breaks: 3, dealing: 8, "corporate-actions": 3 },
  },
  {
    id: "sterling-credit",
    name: "Aldgate Sterling Corporate Bond",
    detail: "GBP · Daily · 4 share classes",
    status: "Cash break blocking NAV",
    tone: "negative",
    counts: { "nav-production": 1, "cash-rec": 5, breaks: 6, pricing: 2, settlements: 2, dealing: 3 },
  },
  {
    id: "em-debt",
    name: "Aldgate Emerging Markets Debt",
    detail: "USD · Daily · 5 share classes",
    status: "Awaiting sign-off",
    tone: "info",
    counts: { "nav-signoff": 1, "tax-reclaims": 2, dealing: 4, "corporate-actions": 1 },
  },
  {
    id: "liquidity",
    name: "Aldgate Liquidity GBP",
    detail: "GBP · Daily · 2 share classes",
    status: "NAV released 12:04",
    tone: "positive",
    counts: {},
  },
];

export function ScopeSwitcherSidebar({ activeId, onNavigate }: SidebarProps) {
  const [scopeId, setScopeId] = useState("global-equity");
  const [open, setOpen] = useState(false);
  const scope = SCOPES.find((s) => s.id === scopeId) ?? SCOPES[0];

  return (
    <SidebarFrame label="Scope switcher sidebar" className="w-64">
      <Brand />

      <div className="relative shrink-0 border-b border-neutral-200 p-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cx(
            "flex w-full items-center gap-2 border border-neutral-300 bg-white px-2.5 py-2 text-left hover:bg-neutral-50",
            focus,
          )}
        >
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              Fund in scope
            </span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-neutral-900">
              {scope.name}
            </span>
            <span className="block truncate text-[11px] text-neutral-500">{scope.detail}</span>
          </span>
          <ChevronsUpDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label="Fund in scope"
            className="absolute top-full right-2 left-2 z-10 -mt-2 border border-neutral-300 bg-white py-1 shadow-lg"
          >
            {SCOPES.map((s) => {
              const selected = s.id === scope.id;
              return (
                <li key={s.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeId(s.id);
                      setOpen(false);
                    }}
                    className={cx(
                      "flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-neutral-50",
                      selected && "bg-neutral-100",
                      focus,
                      "focus-visible:-outline-offset-2",
                    )}
                  >
                    <ToneDot tone={s.tone} className="mt-1.5" />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-medium text-neutral-900">{s.name}</span>
                      <span className="block truncate text-[11px] text-neutral-500">{s.status}</span>
                    </span>
                    {selected && <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-900" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex items-center gap-2 px-0.5 text-[11px]">
          <ToneDot tone={scope.tone} />
          <span className="min-w-0 flex-1 truncate text-neutral-700">{scope.status}</span>
          <span className="shrink-0 text-neutral-500 tabular-nums">VD {VALUATION_DATE}</span>
        </div>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-3">
        {NAV_MODULES.map((module) => (
          <section key={module.id} aria-labelledby={`scope-${module.id}`}>
            <GroupLabel>
              <span id={`scope-${module.id}`}>{module.label}</span>
            </GroupLabel>
            <ul>
              {module.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    label={item.label}
                    active={item.id === activeId}
                    onClick={() => onNavigate(item.id)}
                    count={scope.counts ? scope.counts[item.id] : item.count}
                    tone={item.tone}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}
