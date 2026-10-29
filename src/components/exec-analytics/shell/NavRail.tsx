import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavGroup } from "../config/nav";
import { IconButton, Popover, Tip } from "../ui";
import { usePersisted } from "../lib/persist";

export function NavRail({ groups, collapsed, onToggle, activeRoute, onNavigate, drawer, onCloseDrawer }: {
  groups: NavGroup[]; collapsed: boolean; onToggle: () => void; activeRoute: string; onNavigate: (r: string) => void;
  drawer?: boolean; onCloseDrawer?: () => void;
}) {
  const [closed, setClosed] = usePersisted<string[]>("rail.closedGroups", []);
  const [flyout, setFlyout] = useState<string | null>(null);
  const flyAnchor = useRef<HTMLButtonElement | null>(null);
  const expanded = !collapsed || !!drawer;
  const bodyRef = useRef<HTMLDivElement>(null);

  const go = (route: string) => { setFlyout(null); onNavigate(route); onCloseDrawer?.(); };
  const toggleGroup = (id: string) => setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(bodyRef.current?.querySelectorAll<HTMLButtonElement>("button[data-nav]") ?? []);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); els[Math.min(i + 1, els.length - 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const gid = (document.activeElement as HTMLElement | null)?.dataset.group;
      if (gid && expanded) { e.preventDefault(); const isClosed = closed.includes(gid); if ((e.key === "ArrowLeft") !== isClosed) toggleGroup(gid); }
    }
  };

  return (
    <nav className="ea-rail" data-expanded={expanded} data-drawer={drawer || undefined} aria-label="Primary">
      <div className="ea-rail-head">
        {!drawer && (
          <IconButton label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
          </IconButton>
        )}
      </div>
      <div className="ea-rail-body" ref={bodyRef} onKeyDown={onKey}>
        {groups.map((g) => {
          const Icon = g.icon;
          const single = g.items.length === 1;
          const groupActive = g.items.some((i) => i.route === activeRoute);
          const open = !closed.includes(g.id);
          if (single) {
            const it = g.items[0];
            const btn = (
              <button data-nav data-group={g.id} className="ea-nav-item" data-single="true" aria-current={it.route === activeRoute ? "page" : undefined} onClick={() => go(it.route)}>
                <Icon size={20} strokeWidth={1.5} aria-hidden />{expanded && <span className="ea-nav-label">{it.label}</span>}
              </button>
            );
            return <div key={g.id}>{expanded ? btn : <Tip label={g.label}>{btn}</Tip>}</div>;
          }
          const head = (
            <button
              data-nav data-group={g.id} className="ea-nav-group-head" data-active={groupActive || undefined} data-collapsed-rail={!expanded || undefined}
              aria-expanded={expanded ? open : flyout === g.id} aria-haspopup={expanded ? undefined : "menu"}
              ref={flyout === g.id ? flyAnchor : undefined}
              onClick={() => (expanded ? toggleGroup(g.id) : setFlyout(flyout === g.id ? null : g.id))}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden />
              {expanded && <><span className="ea-nav-label">{g.label}</span>{open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}</>}
            </button>
          );
          return (
            <div key={g.id}>
              {expanded ? head : <Tip label={g.label}>{head}</Tip>}
              {expanded && open && g.items.map((it) => (
                <button key={it.id} data-nav data-group={g.id} className="ea-nav-item" aria-current={it.route === activeRoute ? "page" : undefined} onClick={() => go(it.route)}>
                  <span className="ea-nav-label">{it.label}</span>
                </button>
              ))}
              {!expanded && (
                <Popover open={flyout === g.id} onClose={() => setFlyout(null)} anchor={flyAnchor} label={g.label}>
                  <div className="ea-label" style={{ padding: "6px 10px" }}>{g.label}</div>
                  {g.items.map((it) => (
                    <button key={it.id} className="ea-menu-item" aria-current={it.route === activeRoute ? "page" : undefined} style={it.route === activeRoute ? { fontWeight: 600 } : undefined} onClick={() => go(it.route)}>{it.label}</button>
                  ))}
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
