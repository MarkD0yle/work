import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cx, focus } from "../patterns/tokens";
import {
  NAV_MODULES,
  moduleOf,
  moduleTone,
  type SidebarProps,
} from "./nav-model";
import { Brand, CountBadge, NavLink, ToneDot, UserFooter } from "./SidebarKit";

/* 3 — Rail plus context column.
 *
 * Two levels, two columns. The rail picks a module and never changes; the
 * column beside it lists that module's pages, including a third level where
 * one exists. The column collapses when the work needs the width, leaving a
 * rail that still shows where you are.
 *
 * Browsing a module in the rail does not navigate. The page only changes when
 * a link in the column is chosen, so looking around is free.
 */
export function DualRailSidebar({ activeId, onNavigate }: SidebarProps) {
  const activeModule = moduleOf(activeId);
  const [browsingId, setBrowsingId] = useState(activeModule.id);
  const [open, setOpen] = useState(true);

  const browsing = NAV_MODULES.find((m) => m.id === browsingId) ?? activeModule;

  return (
    <aside
      aria-label="Rail and context column sidebar"
      className="flex h-full min-h-0 shrink-0 border-r border-neutral-200 bg-white text-xs text-neutral-700"
    >
      <div className="flex w-14 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
        <Brand compact />
        <nav aria-label="Modules" className="flex-1 py-2">
          <ul>
            {NAV_MODULES.map((module) => {
              const Icon = module.icon;
              const browsed = open && module.id === browsing.id;
              const current = module.id === activeModule.id;
              const tone = moduleTone(module);
              return (
                <li key={module.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBrowsingId(module.id);
                      setOpen(true);
                    }}
                    aria-label={module.label}
                    aria-pressed={browsed}
                    className={cx(
                      "relative flex h-12 w-full flex-col items-center justify-center gap-0.5 border-l-2",
                      current ? "border-l-neutral-900" : "border-l-transparent",
                      browsed
                        ? "bg-white text-neutral-900"
                        : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                      focus,
                      "focus-visible:-outline-offset-2",
                    )}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    <span className="text-[9px] leading-none font-medium">{module.short}</span>
                    {tone && tone !== "neutral" && (
                      <ToneDot tone={tone} className="absolute top-2 right-2.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse navigation column" : "Expand navigation column"}
          aria-expanded={open}
          className={cx(
            "flex h-10 w-full items-center justify-center border-t border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
            focus,
            "focus-visible:-outline-offset-2",
          )}
        >
          {open ? (
            <PanelLeftClose aria-hidden className="h-4 w-4" />
          ) : (
            <PanelLeftOpen aria-hidden className="h-4 w-4" />
          )}
        </button>
      </div>

      {open && (
        <div className="flex w-52 min-w-0 flex-col">
          <div className="flex h-12 shrink-0 items-center border-b border-neutral-200 px-4">
            <span className="truncate text-sm font-semibold tracking-tight text-neutral-900">
              {browsing.label}
            </span>
          </div>
          <nav aria-label={browsing.label} className="min-h-0 flex-1 overflow-y-auto py-2">
            <ul>
              {browsing.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    label={item.label}
                    active={item.id === activeId}
                    onClick={() => onNavigate(item.id)}
                    count={item.count}
                    tone={item.tone}
                  />
                  {item.children && (
                    <ul className="mb-1 ml-5 border-l border-neutral-200">
                      {item.children.map((child) => {
                        const on = child.id === activeId;
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => onNavigate(child.id)}
                              aria-current={on ? "page" : undefined}
                              className={cx(
                                "flex w-full items-center gap-2 py-1 pr-3 pl-3 text-left text-[11px]",
                                on
                                  ? "bg-neutral-100 font-semibold text-neutral-900"
                                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
                                focus,
                                "focus-visible:-outline-offset-2",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{child.label}</span>
                              <CountBadge count={child.count} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <UserFooter />
        </div>
      )}
    </aside>
  );
}
