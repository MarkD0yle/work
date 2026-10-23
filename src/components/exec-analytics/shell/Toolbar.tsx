/* eslint-disable react-hooks/refs -- usePopover returns a state-backed ref handle; the lint rule cannot tell it is safe to read in render */
import { Bell, CircleHelp, Menu as MenuIcon, Settings, Star, User } from "lucide-react";
import { useState, type RefObject } from "react";
import { BrandMark } from "./BrandMark";
import { PRODUCT_NAME, USER_EMAIL, USER_NAME } from "../config/brand";
import { Button, IconButton, Popover, usePopover } from "../ui";
import { routeLabel } from "../config/nav";
import { useShell } from "./shell-context";
import { SETTINGS_ITEMS, type SettingsId } from "./SettingsMenu";
import { Menu } from "../ui";

function FavoritesPopover() {
  const p = usePopover();
  const { favorites, toggleFavorite, route, navigate } = useShell();
  const isFav = favorites.includes(route);
  return (
    <>
      <IconButton ref={p.triggerRef} label="Favorites" aria-haspopup="dialog" aria-expanded={p.open} onClick={p.toggle}><Star size={20} strokeWidth={1.5} /></IconButton>
      <Popover open={p.open} onClose={p.close} anchor={p.triggerRef} align="end" pad label="Favorites">
        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
          {favorites.length === 0 ? (
            <><div className="ea-muted">No saved favorites</div><Button variant="primary" size="compact" onClick={() => toggleFavorite(route)}>Add to favorites</Button></>
          ) : (
            <>
              {favorites.map((f) => <button key={f} className="ea-menu-item" onClick={() => { navigate(f); p.close(); }}>{routeLabel(f)}</button>)}
              <Button variant="secondary" size="compact" onClick={() => toggleFavorite(route)}>{isFav ? "Remove this page" : "Add this page"}</Button>
            </>
          )}
        </div>
      </Popover>
    </>
  );
}

function InfoPopover({ label, icon, children, dot }: { label: string; icon: React.ReactNode; children: React.ReactNode; dot?: boolean }) {
  const p = usePopover();
  return (
    <>
      <IconButton ref={p.triggerRef} label={label} dot={dot} aria-haspopup="dialog" aria-expanded={p.open} onClick={p.toggle}>{icon}</IconButton>
      <Popover open={p.open} onClose={p.close} anchor={p.triggerRef} align="end" pad label={label}>
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
      </Popover>
    </>
  );
}

function SettingsGear({ onOpen }: { onOpen: (id: SettingsId) => void }) {
  const p = usePopover();
  return (
    <>
      <IconButton ref={p.triggerRef} label="Settings" aria-haspopup="menu" aria-expanded={p.open} onClick={p.toggle}><Settings size={20} strokeWidth={1.5} /></IconButton>
      <Menu open={p.open} onClose={p.close} anchor={p.triggerRef as RefObject<HTMLElement | null>} align="end"
        items={SETTINGS_ITEMS.map((s) => ({ id: s.id, label: s.id === "sign-out" ? `Sign Out ${USER_NAME}` : s.label, icon: <s.icon size={16} strokeWidth={1.5} />, separatorBefore: s.separatorBefore, onSelect: () => onOpen(s.id) }))} />
    </>
  );
}

/** Two zones. The right (fixed) zone is identical on every page: no page may add to it. */
export function Toolbar({ setSlot, compactRail, narrow, onHamburger, onSettings }: {
  setSlot: (el: HTMLElement | null) => void; compactRail: boolean; narrow: boolean; onHamburger: () => void; onSettings: (id: SettingsId) => void;
}) {
  const [unread] = useState(true);
  return (
    <header className="ea-toolbar" style={{ paddingLeft: compactRail || narrow ? 128 : 16 }}>
      {/* The host app's floating Home pill sits over the top-left corner, hence the left inset. */}
      <div className="ea-toolbar-zone" style={{ flex: 1, minWidth: 0 }}>
        {narrow && <IconButton label="Open navigation" onClick={onHamburger}><MenuIcon size={20} strokeWidth={1.5} /></IconButton>}
        <span title={PRODUCT_NAME} style={{ display: "inline-flex" }}><BrandMark /></span>
        <div ref={setSlot} className="ea-toolbar-zone" style={{ flex: 1, minWidth: 0, overflowX: "auto", paddingBottom: 2 }} />
      </div>
      <div className="ea-toolbar-zone" role="group" aria-label="Account and tools">
        <FavoritesPopover />
        <InfoPopover label="User" icon={<User size={20} strokeWidth={1.5} />}>
          <b>{USER_NAME}</b><span className="ea-muted">{USER_EMAIL}</span>
        </InfoPopover>
        <InfoPopover label="Help" icon={<CircleHelp size={20} strokeWidth={1.5} />}>
          <button className="ea-menu-item" onClick={() => onSettings("glossary")}>Glossary</button>
          <button className="ea-menu-item" onClick={() => onSettings("about")}>About</button>
        </InfoPopover>
        <InfoPopover label="Notifications" dot={unread} icon={<Bell size={20} strokeWidth={1.5} />}>
          <b>Notifications</b><span className="ea-muted">Exception report “FX large spread” triggered at 09:12.</span>
        </InfoPopover>
        <SettingsGear onOpen={onSettings} />
      </div>
    </header>
  );
}
