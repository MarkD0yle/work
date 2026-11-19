import { cx, focus } from "../patterns/tokens";
import {
  NAV_MODULES,
  moduleOf,
  moduleTone,
  type SidebarProps,
} from "./nav-model";
import { Brand, NavLink, SidebarFrame, ToneDot, UserFooter } from "./SidebarKit";

/* 2 — Icon rail with flyouts.
 *
 * 56 pixels of chrome and the rest of the screen for the grid. Each module is
 * one icon; hovering or focusing it opens that module's pages beside it.
 * Clicking the icon goes to the module's first page, so the rail still works
 * as plain navigation without the flyout.
 *
 * The flyout is a sibling of the icon inside one hover/focus group, so moving
 * the pointer or tabbing from the icon into the list keeps it open.
 */
export function IconRailSidebar({ activeId, onNavigate }: SidebarProps) {
  const activeModule = moduleOf(activeId);

  return (
    <SidebarFrame label="Icon rail sidebar" className="relative z-20 w-14">
      <Brand compact />
      <nav aria-label="Primary" className="flex-1 py-2">
        <ul>
          {NAV_MODULES.map((module) => {
            const Icon = module.icon;
            const on = module.id === activeModule.id;
            const tone = moduleTone(module);
            return (
              <li key={module.id} className="group/module relative">
                <button
                  type="button"
                  onClick={() => onNavigate(module.items[0].id)}
                  aria-label={module.label}
                  aria-current={on ? "true" : undefined}
                  className={cx(
                    "relative flex h-12 w-full flex-col items-center justify-center gap-0.5 border-l-2",
                    on
                      ? "border-l-neutral-900 bg-neutral-100 text-neutral-900"
                      : "border-l-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
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

                <div className="absolute top-0 left-full hidden w-60 border border-neutral-200 bg-white shadow-lg group-focus-within/module:block group-hover/module:block">
                  <div className="border-b border-neutral-200 px-4 py-2 text-[11px] font-semibold text-neutral-900">
                    {module.label}
                  </div>
                  <ul className="py-1">
                    {module.items.map((item) => (
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
              </li>
            );
          })}
        </ul>
      </nav>
      <UserFooter compact />
    </SidebarFrame>
  );
}
