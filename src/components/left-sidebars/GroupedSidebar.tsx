import { NAV_MODULES, VALUATION_DATE, type SidebarProps } from "./nav-model";
import { Brand, GroupLabel, NavLink, SidebarFrame, UserFooter } from "./SidebarKit";

/* 1 — Grouped list.
 *
 * The baseline: every destination visible, grouped under plain headings,
 * nothing hidden behind a click. It costs the most width and the most
 * vertical space, and in return nobody ever has to hunt.
 */
export function GroupedSidebar({ activeId, onNavigate }: SidebarProps) {
  return (
    <SidebarFrame label="Grouped list sidebar" className="w-64">
      <Brand />
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2 text-[11px]">
        <span className="text-neutral-500">Valuation date</span>
        <span className="font-medium text-neutral-900 tabular-nums">{VALUATION_DATE}</span>
      </div>
      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto pb-3">
        {NAV_MODULES.map((module) => (
          <section key={module.id} aria-labelledby={`grouped-${module.id}`}>
            <GroupLabel>
              <span id={`grouped-${module.id}`}>{module.label}</span>
            </GroupLabel>
            <ul>
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
          </section>
        ))}
      </nav>
      <UserFooter />
    </SidebarFrame>
  );
}
