import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cx, focus } from "../patterns/tokens";
import {
  NAV_MODULES,
  findItem,
  moduleCount,
  moduleOf,
  moduleTone,
  type SidebarProps,
} from "./nav-model";
import { Brand, CountBadge, UserFooter, SidebarFrame } from "./SidebarKit";

/* 4 — Accordion tree.
 *
 * Three levels in one column. Modules and pages with children open and close;
 * a closed branch rolls its children's counts up onto its own row so nothing
 * that needs attention disappears when a section is folded away.
 *
 * Any number of branches can be open at once. The user decides what stays on
 * screen, and the tree never closes something behind their back.
 */
export function TreeSidebar({ activeId, onNavigate }: SidebarProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set([moduleOf(activeId).id, findItem(activeId).id, "fund-accounting"]),
  );

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = NAV_MODULES.every((m) => openIds.has(m.id));

  return (
    <SidebarFrame label="Accordion tree sidebar" className="w-72">
      <Brand />
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 py-1.5 pr-2 pl-4">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Navigation
        </span>
        <button
          type="button"
          onClick={() =>
            setOpenIds(allOpen ? new Set() : new Set(NAV_MODULES.map((m) => m.id)))
          }
          className={cx(
            "px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            focus,
          )}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto py-1">
        <ul>
          {NAV_MODULES.map((module) => {
            const Icon = module.icon;
            const open = openIds.has(module.id);
            const holdsActive = moduleOf(activeId).id === module.id;
            return (
              <li key={module.id}>
                <button
                  type="button"
                  onClick={() => toggle(module.id)}
                  aria-expanded={open}
                  className={cx(
                    "flex w-full items-center gap-2 py-2 pr-3 pl-3 text-left font-semibold hover:bg-neutral-50",
                    holdsActive ? "text-neutral-900" : "text-neutral-700",
                    focus,
                    "focus-visible:-outline-offset-2",
                  )}
                >
                  <Chevron open={open} />
                  <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <span className="min-w-0 flex-1 truncate">{module.label}</span>
                  {!open && (
                    <CountBadge count={moduleCount(module)} tone={moduleTone(module)} />
                  )}
                </button>

                {open && (
                  <ul className="mb-1 ml-5 border-l border-neutral-200">
                    {module.items.map((item) => {
                      const hasChildren = Boolean(item.children);
                      const itemOpen = openIds.has(item.id);
                      const on = item.id === activeId;
                      return (
                        <li key={item.id}>
                          <div
                            className={cx(
                              "flex items-center",
                              on
                                ? "bg-neutral-100 font-semibold text-neutral-900"
                                : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900",
                            )}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggle(item.id)}
                                aria-expanded={itemOpen}
                                aria-label={`${itemOpen ? "Collapse" : "Expand"} ${item.label}`}
                                className={cx(
                                  "flex h-7 w-6 shrink-0 items-center justify-center",
                                  focus,
                                  "focus-visible:-outline-offset-2",
                                )}
                              >
                                <Chevron open={itemOpen} />
                              </button>
                            ) : (
                              <span aria-hidden className="w-6 shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={() => onNavigate(item.id)}
                              aria-current={on ? "page" : undefined}
                              className={cx(
                                "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left",
                                focus,
                                "focus-visible:-outline-offset-2",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              <CountBadge count={item.count} tone={item.tone} />
                            </button>
                          </div>

                          {hasChildren && itemOpen && (
                            <ul className="ml-3 border-l border-neutral-200">
                              {item.children!.map((child) => {
                                const childOn = child.id === activeId;
                                return (
                                  <li key={child.id}>
                                    <button
                                      type="button"
                                      onClick={() => onNavigate(child.id)}
                                      aria-current={childOn ? "page" : undefined}
                                      className={cx(
                                        "flex w-full items-center gap-2 py-1 pr-3 pl-4 text-left text-[11px]",
                                        childOn
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
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={cx(
        "h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform motion-reduce:transition-none",
        open && "rotate-90",
      )}
    />
  );
}
