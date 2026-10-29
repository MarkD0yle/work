import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { NAV } from "../config/nav";
import { usePersisted, clearPersisted } from "../lib/persist";
import { EaContext, type Theme } from "../ui/context";
import { NavRail } from "./NavRail";
import { Toolbar } from "./Toolbar";
import { SettingsHost, type SettingsId } from "./SettingsMenu";
import { DEFAULT_PREFS, PrefsContext, type Prefs } from "./prefs";
import { ShellContext } from "./shell-context";
import "../ea.css";

function useWidth(el: HTMLElement | null) {
  const [w, setW] = useState(typeof window === "undefined" ? 1440 : window.innerWidth);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

export function AppShell({ route, onNavigate, layout, children }: { route: string; onNavigate: (r: string) => void; layout: "dashboard" | "form"; children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const width = useWidth(root);
  const narrow = width < 1024;
  const [railPref, setRailPref] = usePersisted<boolean | null>("rail.collapsed", null);
  const collapsed = railPref ?? width < 1440;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefs, setPrefsState] = usePersisted<Prefs>("prefs", DEFAULT_PREFS);
  const [favorites, setFavorites] = usePersisted<string[]>("favorites", []);
  const [busy, setBusy] = useState(0);
  const [settings, setSettings] = useState<SettingsId | null>(null);
  const [sysDark, setSysDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const theme: Theme = prefs.theme === "system" ? (sysDark ? "dark" : "light") : prefs.theme;

  const setPrefs = useCallback((p: Partial<Prefs>) => setPrefsState((c) => ({ ...c, ...p })), [setPrefsState]);
  const resetLayout = useCallback(() => { clearPersisted(["rail.", "density.", "tab.", "filter.", "range.", "layout."]); setRailPref(null); }, [setRailPref]);
  const shellValue = useMemo(() => ({
    route, navigate: onNavigate, slot, busy, addBusy: (d: number) => setBusy((b) => Math.max(0, b + d)),
    favorites, toggleFavorite: (r: string) => setFavorites((f) => (f.includes(r) ? f.filter((x) => x !== r) : [...f, r])),
  }), [route, onNavigate, slot, busy, favorites, setFavorites]);


  return (
    <div className="ea-root" data-theme={theme} ref={setRoot} style={{ height: "100%" }}>
      <EaContext.Provider value={{ portal: root, theme, colorBlindSafe: prefs.colorBlindSafe }}>
        <PrefsContext.Provider value={{ prefs, setPrefs, resetLayout }}>
          <ShellContext.Provider value={shellValue}>
            <div className="ea-small-screen">Best viewed on a larger screen</div>
            <div className="ea-shell">
              <a href="#ea-main" className="ea-skip" onClick={(e) => { e.preventDefault(); document.getElementById("ea-main")?.focus(); }}>Skip to content</a>
              {(!narrow || drawerOpen) && (
                <>
                  {narrow && <div className="ea-drawer-overlay" style={{ zIndex: 55 }} onMouseDown={() => setDrawerOpen(false)} />}
                  <NavRail groups={NAV} collapsed={collapsed} onToggle={() => setRailPref(!collapsed)} activeRoute={route} onNavigate={onNavigate} drawer={narrow} onCloseDrawer={() => setDrawerOpen(false)} />
                </>
              )}
              <div className="ea-main">
                <Toolbar setSlot={setSlot} compactRail={collapsed && !narrow} narrow={narrow} onHamburger={() => setDrawerOpen(true)} onSettings={setSettings} />
                <div style={{ height: 2 }}>{busy > 0 && <div className="ea-progress" role="progressbar" aria-label="Refreshing" />}</div>
                <main id="ea-main" tabIndex={-1} className="ea-content" data-form={layout === "form" || undefined} style={{ outline: "none" }}>{children}</main>
              </div>
            </div>
            <SettingsHost openId={settings} onClose={() => setSettings(null)} />
          </ShellContext.Provider>
        </PrefsContext.Provider>
      </EaContext.Provider>
    </div>
  );
}
