import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type SideBarDef,
  type StatusPanelDef,
} from "ag-grid-community";
import {
  type AssetClass,
  type Row,
  type ClassConfig,
  UNIVERSES,
  CONFIGS,
  type Preset,
  type FilterState,
  defaultState,
  passes,
  RangeRow,
} from "./asset-screener";

// The screener engine (universes, factor configs, filters) is shared with the
// base Asset Screener; this page evolves the surrounding workflow — saved
// screens, a universe/currency/direction control bar, and an active-filter
// chip strip — inspired by an institutional credit screener but fully
// unbranded (State Street / neutral labels only).

export const title = "Asset Screener — Upgrade";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* ---- workflow chrome data (cosmetic, mock) ---------------------- */

const UNIVERSE_NAMES: Record<AssetClass, string[]> = {
  equity: ["State Street Universe", "Global Developed", "US Large Cap", "MSCI World"],
  bond: ["State Street Universe", "Global IG Credit", "US Credit", "EUR Credit"],
  commodity: ["State Street Universe", "Broad Commodity", "Energy Complex", "Metals"],
};

const CLASS_LABEL: Record<AssetClass, string> = {
  equity: "Stock Screener",
  bond: "Bond Screener",
  commodity: "Commodity Screener",
};

const CURRENCIES = ["USD", "EUR", "GBP"] as const;

// Column tab sets per asset class (fields=null shows every column).
const COLUMN_TABS: Record<AssetClass, { id: string; label: string; fields: string[] | null }[]> = {
  bond: [
    { id: "overview", label: "Overview", fields: null },
    { id: "security", label: "Security info", fields: ["ticker", "category", "issuerType", "rating", "issueCurrency", "source", "maturity"] },
    { id: "amounts", label: "Amounts", fields: ["ticker", "price", "outstanding", "coupon", "ytm"] },
    { id: "coupon", label: "Coupon", fields: ["ticker", "coupon", "couponType", "couponFreq", "ytm"] },
    { id: "ratings", label: "Ratings", fields: ["ticker", "rating", "gSpread", "oas", "score", "signal"] },
  ],
  equity: [
    { id: "overview", label: "Overview", fields: null },
    { id: "valuation", label: "Valuation", fields: ["ticker", "category", "pe", "evEbitda", "divYield", "score"] },
    { id: "performance", label: "Performance", fields: ["ticker", "chg", "mom12", "vol30", "beta", "score"] },
    { id: "quality", label: "Quality", fields: ["ticker", "roe", "esg", "score", "signal"] },
  ],
  commodity: [
    { id: "overview", label: "Overview", fields: null },
    { id: "momentum", label: "Momentum", fields: ["ticker", "category", "mom3", "vol", "score", "signal"] },
    { id: "carry", label: "Carry & Curve", fields: ["ticker", "rollYield", "curve", "openInterest", "score"] },
  ],
};

// Which filter chips are visible by default (rest are added via the "+" menu):
// sector + the first three numeric filters + composite score.
function defaultShown(cfg: ClassConfig): Set<string> {
  return new Set<string>(["__cats", ...cfg.filters.slice(0, 3).map((f) => f.key), "__score"]);
}

interface Screen {
  id: string;
  name: string;
  fav: boolean;
  shared: boolean;
}

const INITIAL_SCREENS: Screen[] = [
  { id: "s1", name: "Screen Draft (07/03/26)", fav: true, shared: false },
  { id: "s2", name: "Screen Draft (07/02/26)", fav: true, shared: false },
  { id: "s3", name: "Screen Draft (07/01/26)", fav: false, shared: true },
  { id: "s4", name: "Screen Draft (06/30/26)", fav: false, shared: false },
  { id: "s5", name: "Screen Draft (06/27/26)", fav: false, shared: true },
];

/* ---- small chips ------------------------------------------------ */

const optCls = (on: boolean) =>
  `rounded px-1.5 py-1 text-[11px] font-medium transition ${on ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`;

function ChipDropdown({
  label,
  summary,
  active,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  summary?: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12px] font-medium transition ${
          active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
        }`}
      >
        {label}
        {summary && <span className="rounded bg-indigo-600 px-1 text-[10px] font-semibold text-white">{summary}</span>}
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 ${active ? "text-indigo-400" : "text-neutral-400"}`}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
        primary
          ? "bg-indigo-600 text-white hover:bg-indigo-500"
          : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

function AssetScreenerUpgrade() {
  const [assetClass, setAssetClass] = useState<AssetClass>("bond");
  const [state, setState] = useState<FilterState>(() => defaultState(CONFIGS.bond));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [compact, setCompact] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [savedOpen, setSavedOpen] = useState(true);
  const [dark, setDark] = useState(false);

  // workflow chrome
  const [universeName, setUniverseName] = useState(UNIVERSE_NAMES.bond[0]);
  const [direction, setDirection] = useState<"Buy" | "Sell">("Buy");
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [editingTitle, setEditingTitle] = useState(false);
  const [shownFilters, setShownFilters] = useState<Set<string>>(() => defaultShown(CONFIGS.bond));
  const [faceValue, setFaceValue] = useState("1,000,000");
  const [screens, setScreens] = useState<Screen[]>(INITIAL_SCREENS);
  const [activeScreenId, setActiveScreenId] = useState("s1");

  const apiRef = useRef<GridApi<Row> | null>(null);
  const cfg = CONFIGS[assetClass];
  const universe = UNIVERSES[assetClass];
  const activeScreen = screens.find((s) => s.id === activeScreenId);

  const switchClass = useCallback((c: AssetClass) => {
    setAssetClass(c);
    setState(defaultState(CONFIGS[c]));
    setActivePreset(null);
    setQuickFilter("");
    setUniverseName(UNIVERSE_NAMES[c][0]);
    setActiveTab("overview");
    setShownFilters(defaultShown(CONFIGS[c]));
  }, []);

  const filtered = useMemo(() => universe.filter((r) => passes(r, cfg, state)), [universe, cfg, state]);

  const kpis = useMemo(() => {
    const n = filtered.length;
    const avgScore = n ? filtered.reduce((a, r) => a + r.score, 0) / n : 0;
    const buys = filtered.filter((r) => r.signal === "BUY").length;
    return { n, avgScore, buys, extra: cfg.kpiExtra(filtered) };
  }, [filtered, cfg]);

  const patchNum = useCallback((key: string, val: number) => {
    setState((s) => ({ ...s, nums: { ...s.nums, [key]: val } }));
    setActivePreset(null);
  }, []);

  const toggleCat = useCallback((item: string) => {
    setState((s) => {
      const next = new Set(s.cats);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return { ...s, cats: next };
    });
    setActivePreset(null);
  }, []);

  const toggleCatSel = useCallback((dim: string, item: string) => {
    setState((s) => {
      const cur = new Set(s.catSel?.[dim] ?? []);
      if (cur.has(item)) cur.delete(item);
      else cur.add(item);
      return { ...s, catSel: { ...(s.catSel ?? {}), [dim]: cur } };
    });
    setActivePreset(null);
  }, []);

  const applyPreset = useCallback(
    (p: Preset) => {
      setState({ nums: { ...defaultState(cfg).nums, ...p.nums }, cats: new Set(), catSel: defaultState(cfg).catSel, minScore: p.minScore ?? 0 });
      setActivePreset(p.id);
    },
    [cfg],
  );

  const resetFilters = useCallback(() => {
    setState(defaultState(cfg));
    setActivePreset(null);
  }, [cfg]);

  const onGridReady = useCallback((e: GridReadyEvent<Row>) => {
    apiRef.current = e.api;
  }, []);

  // columns shown depend on the active column tab (Overview / Security info / …)
  const displayedColumns = useMemo(() => {
    const tabs = COLUMN_TABS[assetClass];
    const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0];
    if (!tab.fields) return cfg.columns;
    return tab.fields
      .map((fld) => cfg.columns.find((c) => c.field === fld))
      .filter((c): c is (typeof cfg.columns)[number] => Boolean(c));
  }, [assetClass, activeTab, cfg]);

  const activeFilterCount = useMemo(() => {
    let n = cfg.filters.reduce((a, f) => a + (state.nums[f.key] !== f.def ? 1 : 0), 0);
    n += state.cats.size;
    for (const cf of cfg.catFilters ?? []) n += state.catSel?.[cf.id]?.size ?? 0;
    if (state.minScore > 0) n += 1;
    return n;
  }, [cfg, state]);

  // every filter that can be shown as a chip (for the "+" add menu)
  const allChipDefs = useMemo(
    () => [
      { id: "__cats", label: cfg.categoryLabel },
      ...cfg.filters.map((f) => ({ id: f.key, label: f.label })),
      ...(cfg.catFilters ?? []).map((cf) => ({ id: cf.id, label: cf.label })),
      { id: "__score", label: "Composite score" },
    ],
    [cfg],
  );

  const toggleShown = useCallback((id: string) => {
    setShownFilters((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearFilterById = useCallback(
    (id: string) => {
      if (id === "__cats") setState((s) => ({ ...s, cats: new Set() }));
      else if (id === "__score") setState((s) => ({ ...s, minScore: 0 }));
      else if (cfg.filters.some((f) => f.key === id)) patchNum(id, cfg.filters.find((f) => f.key === id)!.def);
      else setState((s) => ({ ...s, catSel: { ...(s.catSel ?? {}), [id]: new Set() } }));
    },
    [cfg, patchNum],
  );

  const theme = useMemo(
    () =>
      themeQuartz.withParams(
        dark
          ? {
              accentColor: "#818cf8",
              backgroundColor: "#171717",
              foregroundColor: "#e5e5e5",
              borderColor: "#2a2a2a",
              chromeBackgroundColor: "#1f1f1f",
              headerBackgroundColor: "#1f1f1f",
              headerTextColor: "#a3a3a3",
              headerFontWeight: 600,
              oddRowBackgroundColor: "#1a1a1a",
              rowHoverColor: "#262626",
              selectedRowBackgroundColor: "rgba(99, 102, 241, 0.22)",
              fontFamily: "inherit",
              fontSize: compact ? 12 : 13,
              headerFontSize: 11,
              cellHorizontalPadding: 10,
              spacing: compact ? 5 : 8,
              wrapperBorderRadius: 0,
              rowBorder: true,
              columnBorder: true,
            }
          : {
              accentColor: "#4f46e5",
              backgroundColor: "#ffffff",
              foregroundColor: "#171717",
              borderColor: "#e5e5e5",
              chromeBackgroundColor: "#fafafa",
              headerBackgroundColor: "#f5f5f5",
              headerTextColor: "#525252",
              headerFontWeight: 600,
              oddRowBackgroundColor: "#fcfcfc",
              rowHoverColor: "#eef2ff",
              selectedRowBackgroundColor: "#e0e7ff",
              fontFamily: "inherit",
              fontSize: compact ? 12 : 13,
              headerFontSize: 11,
              cellHorizontalPadding: 10,
              spacing: compact ? 5 : 8,
              wrapperBorderRadius: 0,
              rowBorder: true,
              columnBorder: true,
            },
      ),
    [compact, dark],
  );

  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, filter: "agNumberColumnFilter" }), []);

  const statusBar = useMemo<{ statusPanels: StatusPanelDef[] }>(
    () => ({
      statusPanels: [
        { statusPanel: "agTotalAndFilteredRowCountComponent", align: "left" },
        { statusPanel: "agSelectedRowCountComponent", align: "center" },
        { statusPanel: "agAggregationComponent", align: "right" },
      ],
    }),
    [],
  );

  const sideBar = useMemo<SideBarDef>(
    () => ({
      toolPanels: [
        { id: "columns", labelDefault: "Columns", labelKey: "columns", iconKey: "columns", toolPanel: "agColumnsToolPanel" },
        { id: "filters", labelDefault: "Filters", labelKey: "filters", iconKey: "filter", toolPanel: "agFiltersToolPanel" },
      ],
    }),
    [],
  );

  const isBond = assetClass === "bond";
  const favScreens = screens.filter((s) => s.fav);
  const monthScreens = screens.filter((s) => !s.fav);

  const toggleFav = (id: string) =>
    setScreens((ss) => ss.map((s) => (s.id === id ? { ...s, fav: !s.fav } : s)));
  const renameActiveScreen = (name: string) =>
    setScreens((ss) => ss.map((s) => (s.id === activeScreenId ? { ...s, name } : s)));

  return (
    <div className={`flex h-screen flex-col bg-neutral-50 ${dark ? "screener-dark" : ""}`}>
      {/* ============ top header ============ */}
      <div className="border-b border-neutral-200 bg-white">
        {/* brand row */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-neutral-900">Asset Screener</span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
              State Street · Cross-Asset
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
              title={dark ? "Switch to light" : "Switch to dark"}
            >
              {dark ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 2a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 10 2Zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75ZM4.4 4.4a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 0 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06Zm9.44 9.44a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06ZM2 10a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2 10Zm13.25 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM5.86 13.84a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 0 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Zm9.44-9.44a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 1 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Z" /></svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" /></svg>
              )}
            </button>
            <ActionBtn>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 2a.75.75 0 0 1 .75.75v7.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.75A.75.75 0 0 1 10 2ZM3.5 13a.75.75 0 0 1 .75.75v1.5c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75v-1.5a.75.75 0 0 1 1.5 0v1.5A2.25 2.25 0 0 1 15 17.5H5a2.25 2.25 0 0 1-2.25-2.25v-1.5A.75.75 0 0 1 3.5 13Z" /></svg>
              Export
            </ActionBtn>
            <ActionBtn>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" /></svg>
              Share
            </ActionBtn>
            <ActionBtn primary>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" /></svg>
              Pre-Trade Analysis
            </ActionBtn>
          </div>
        </div>

        {/* asset dropdown (left) + screen title */}
        <div className="flex items-center gap-3 px-6 pt-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setClassMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
            >
              <span>{cfg.icon}</span>
              {CLASS_LABEL[assetClass]}
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-neutral-400 transition-transform ${classMenuOpen ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
            {classMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setClassMenuOpen(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                  {(Object.keys(CONFIGS) as AssetClass[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        switchClass(c);
                        setClassMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        assetClass === c ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      <span>{CONFIGS[c].icon}</span>
                      {CLASS_LABEL[c]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {editingTitle ? (
            <input
              autoFocus
              value={activeScreen?.name ?? ""}
              onChange={(e) => renameActiveScreen(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
              }}
              className="w-64 rounded-md border border-indigo-300 bg-white px-2 py-0.5 text-lg font-semibold tracking-tight text-neutral-950 outline-none focus:ring-2 focus:ring-indigo-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Click to rename"
              className="-mx-1 rounded-md px-1 text-lg font-semibold tracking-tight text-neutral-950 transition hover:bg-neutral-100"
            >
              {activeScreen?.name ?? "Untitled Screen"}
            </button>
          )}
        </div>

        {/* control bar: universe / currency / direction / face value */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-6 pt-3 pb-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
              Universe
              <span className="font-mono text-neutral-400">{universe.length.toLocaleString()} assets</span>
            </div>
            <div className="relative w-52">
              <select
                value={universeName}
                onChange={(e) => setUniverseName(e.target.value)}
                className="h-8 w-full appearance-none rounded-md border border-neutral-200 bg-white pl-2 pr-8 text-sm outline-none focus:border-indigo-400"
              >
                {UNIVERSE_NAMES[assetClass].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {isBond && (
            <>
              <div>
                <div className="mb-1 text-[11px] font-medium text-neutral-500">Currency</div>
                <div className="flex h-8 items-center gap-1">
                  {CURRENCIES.map((c) => {
                    const on = state.catSel?.["issueCurrency"]?.has(c) ?? false;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCatSel("issueCurrency", c)}
                        className={`h-8 rounded-md px-2.5 text-[11px] font-semibold transition ${
                          on ? "bg-indigo-600 text-white" : "border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-neutral-500">Face value / bond</div>
                <div className="flex h-8 items-center rounded-md border border-neutral-200 bg-white px-2">
                  <span className="text-sm text-neutral-400">$</span>
                  <input
                    value={faceValue}
                    onChange={(e) => setFaceValue(e.target.value)}
                    className="w-28 bg-transparent px-1 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-medium text-neutral-500">Direction</div>
                <div className="flex h-8 items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
                  {(["Buy", "Sell"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={`h-7 rounded px-3 text-[12px] font-semibold transition ${
                        direction === d ? (d === "Buy" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "text-neutral-500 hover:bg-neutral-100"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="ml-auto flex items-end gap-2">
            <div className="relative">
              <input
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                placeholder="Search ticker, name…"
                className="h-8 w-52 rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2 h-4 w-4 text-neutral-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.4 9.84l3.38 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.38A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ============ body ============ */}
      <div className="flex min-h-0 flex-1">
        {/* saved screens rail */}
        {savedOpen ? (
          <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Saved Screens</span>
              <button type="button" onClick={() => setSavedOpen(false)} className="text-neutral-400 hover:text-neutral-700" title="Collapse">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 0-1.06.02l-4 4.25a.75.75 0 0 0 0 1.02l4 4.25a.75.75 0 1 0 1.08-1.04L9.31 10l3.5-3.73a.75.75 0 0 0-.02-1.04Z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="px-3 pb-2">
              <input placeholder="Search screens…" className="h-7 w-full rounded-md border border-neutral-200 bg-white px-2 text-[12px] outline-none focus:border-indigo-400" />
            </div>
            <div className="flex items-center gap-1 border-b border-neutral-100 px-3 pb-2 text-neutral-400">
              <button type="button" className="rounded p-1 hover:bg-neutral-100 hover:text-neutral-700" title="New">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3Z" /></svg>
              </button>
              <button type="button" className="rounded p-1 hover:bg-neutral-100 hover:text-neutral-700" title="Duplicate">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7 12.5v-9Z" /><path d="M4 6a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 4 18h6a1.5 1.5 0 0 0 1.5-1.5V15H8.5A2.5 2.5 0 0 1 6 12.5V6H4Z" /></svg>
              </button>
              <button type="button" className="rounded p-1 hover:bg-neutral-100 hover:text-rose-600" title="Delete">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1a1 1 0 0 0-.958.713L7.435 3H4.25a.75.75 0 0 0 0 1.5h.29l.663 11.267A2 2 0 0 0 7.196 17.7h5.608a2 2 0 0 0 1.993-1.933L15.46 4.5h.29a.75.75 0 0 0 0-1.5h-3.185l-.357-1.287A1 1 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <ScreenGroup title={`My Favorite (${favScreens.length})`} screens={favScreens} activeId={activeScreenId} onSelect={setActiveScreenId} onFav={toggleFav} />
              <ScreenGroup title={`This Month (${monthScreens.length})`} screens={monthScreens} activeId={activeScreenId} onSelect={setActiveScreenId} onFav={toggleFav} />
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setSavedOpen(true)}
            className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-neutral-200 bg-white py-4 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
            title="Show saved screens"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 5.23a.75.75 0 0 1 1.06.02l4 4.25a.75.75 0 0 1 0 1.02l-4 4.25a.75.75 0 1 1-1.08-1.04L10.69 10 7.19 6.27a.75.75 0 0 1 .02-1.04Z" clipRule="evenodd" /></svg>
            <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">Saved Screens</span>
          </button>
        )}

        {/* factor panel */}
        {panelOpen && (
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white px-4 py-4">
            <div className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">Preset screens</div>
            <div className="flex flex-wrap gap-1">
              {cfg.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.blurb}
                  onClick={() => applyPreset(p)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                    activePreset === p.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">Factor thresholds</div>
            <div className="mt-3 space-y-4">
              {cfg.filters.map((f) => (
                <RangeRow key={f.key} label={f.label} min={f.min} max={f.max} step={f.step} value={state.nums[f.key]} onChange={(v) => patchNum(f.key, v)} format={f.format} />
              ))}
              <RangeRow
                label="Min composite score"
                min={0}
                max={90}
                step={5}
                value={state.minScore}
                onChange={(v) => { setState((s) => ({ ...s, minScore: v })); setActivePreset(null); }}
                format={(v) => (v === 0 ? "Any" : `${v}`)}
              />
            </div>

            <div className="mt-5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">{cfg.categoryLabel}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cfg.categories.map((c) => {
                const on = state.cats.has(c);
                return (
                  <button key={c} type="button" onClick={() => toggleCat(c)} className={`rounded px-1.5 py-1 text-[10px] font-medium transition ${on ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                    {c}
                  </button>
                );
              })}
            </div>

            {(cfg.catFilters ?? []).map((cf) => (
              <div key={cf.id} className="mt-5">
                <div className="text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">{cf.label}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {cf.options.map((opt) => {
                    const on = state.catSel?.[cf.id]?.has(opt) ?? false;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleCatSel(cf.id, opt)}
                        className={`rounded px-1.5 py-1 text-[10px] font-medium transition ${on ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="mt-5 text-[10px] leading-relaxed text-neutral-400">{cfg.weightsNote}</p>
          </aside>
        )}

        {/* main: KPIs + chips + grid */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* KPI strip + view controls */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2">
            <button type="button" onClick={() => setPanelOpen((o) => !o)} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50">
              {panelOpen ? "◧ Factors" : "▢ Factors"}
            </button>
            <div className="flex items-center gap-3 text-[12px]">
              <MiniStat label="Matches" value={kpis.n.toString()} />
              <MiniStat label="Buy" value={kpis.buys.toString()} tone="pos" />
              <MiniStat label="Avg score" value={kpis.n ? kpis.avgScore.toFixed(0) : "—"} />
              <MiniStat label={kpis.extra.label} value={kpis.extra.value} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setCompact((c) => !c)} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50">
                {compact ? "Comfortable" : "Compact"}
              </button>
              <button type="button" onClick={resetFilters} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50">
                Reset
              </button>
              <button type="button" onClick={() => apiRef.current?.exportDataAsCsv({ fileName: `screen-${assetClass}.csv` })} className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50">
                Export CSV
              </button>
            </div>
          </div>

          {/* filter chips (wrapping) + add/remove menu */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
            <span className="text-[11px] font-medium text-neutral-400">Filters</span>

            {shownFilters.has("__cats") && (
              <ChipDropdown
                label={cfg.categoryLabel}
                summary={state.cats.size ? `${state.cats.size}` : undefined}
                active={state.cats.size > 0}
                open={openFilter === "__cats"}
                onToggle={() => setOpenFilter((o) => (o === "__cats" ? null : "__cats"))}
                onClose={() => setOpenFilter(null)}
              >
                <div className="flex flex-wrap gap-1">
                  {cfg.categories.map((c) => (
                    <button key={c} type="button" onClick={() => toggleCat(c)} className={optCls(state.cats.has(c))}>
                      {c}
                    </button>
                  ))}
                </div>
              </ChipDropdown>
            )}

            {cfg.filters
              .filter((f) => shownFilters.has(f.key))
              .map((f) => {
                const v = state.nums[f.key];
                const on = v !== f.def;
                return (
                  <ChipDropdown
                    key={f.key}
                    label={f.label}
                    summary={on ? f.format(v) : undefined}
                    active={on}
                    open={openFilter === f.key}
                    onToggle={() => setOpenFilter((o) => (o === f.key ? null : f.key))}
                    onClose={() => setOpenFilter(null)}
                  >
                    <RangeRow label={f.label} min={f.min} max={f.max} step={f.step} value={v} onChange={(nv) => patchNum(f.key, nv)} format={f.format} />
                    {on && (
                      <button type="button" onClick={() => patchNum(f.key, f.def)} className="mt-2 text-[11px] text-neutral-400 hover:text-neutral-700">
                        Clear
                      </button>
                    )}
                  </ChipDropdown>
                );
              })}

            {(cfg.catFilters ?? [])
              .filter((cf) => shownFilters.has(cf.id))
              .map((cf) => {
                const cnt = state.catSel?.[cf.id]?.size ?? 0;
                return (
                  <ChipDropdown
                    key={cf.id}
                    label={cf.label}
                    summary={cnt ? `${cnt}` : undefined}
                    active={cnt > 0}
                    open={openFilter === cf.id}
                    onToggle={() => setOpenFilter((o) => (o === cf.id ? null : cf.id))}
                    onClose={() => setOpenFilter(null)}
                  >
                    <div className="flex flex-wrap gap-1">
                      {cf.options.map((opt) => (
                        <button key={opt} type="button" onClick={() => toggleCatSel(cf.id, opt)} className={optCls(state.catSel?.[cf.id]?.has(opt) ?? false)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </ChipDropdown>
                );
              })}

            {shownFilters.has("__score") && (
              <ChipDropdown
                label="Score"
                summary={state.minScore > 0 ? `≥${state.minScore}` : undefined}
                active={state.minScore > 0}
                open={openFilter === "__score"}
                onToggle={() => setOpenFilter((o) => (o === "__score" ? null : "__score"))}
                onClose={() => setOpenFilter(null)}
              >
                <RangeRow
                  label="Min composite score"
                  min={0}
                  max={90}
                  step={5}
                  value={state.minScore}
                  onChange={(v) => { setState((s) => ({ ...s, minScore: v })); setActivePreset(null); }}
                  format={(v) => (v === 0 ? "Any" : `${v}`)}
                />
              </ChipDropdown>
            )}

            {/* + add / remove filters */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenFilter((o) => (o === "__add" ? null : "__add"))}
                className="flex h-7 items-center gap-1 rounded-md border border-dashed border-neutral-300 bg-white px-2 text-[12px] font-medium text-neutral-500 hover:bg-neutral-50"
                title="Add or remove filters"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 3a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 10 3Z" /></svg>
                Filter
              </button>
              {openFilter === "__add" && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)} />
                  <div className="absolute left-0 z-20 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
                    <div className="px-2 py-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">Add / remove filters</div>
                    {allChipDefs.map((d) => {
                      const on = shownFilters.has(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => { if (on) clearFilterById(d.id); toggleShown(d.id); }}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                        >
                          {d.label}
                          <span className={on ? "text-indigo-600" : "text-neutral-300"}>{on ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700">
                Clear all ({activeFilterCount})
              </button>
            )}
          </div>

          {/* column tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-4">
            {COLUMN_TABS[assetClass].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 border-b-2 px-2.5 py-2 text-[13px] transition ${
                  activeTab === t.id ? "border-indigo-500 font-semibold text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* grid — fills the panel edge to edge */}
          <div className="min-h-0 flex-1 bg-white">
            <AgGridReact<Row>
              key={dark ? "grid-dark" : "grid-light"}
              theme={theme}
              columnDefs={displayedColumns}
              defaultColDef={defaultColDef}
              rowData={filtered}
              getRowId={(p) => p.data.id}
              onGridReady={onGridReady}
              quickFilterText={quickFilter}
              rowGroupPanelShow="onlyWhenGrouping"
              groupDefaultExpanded={1}
              rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
              cellSelection
              sideBar={sideBar}
              statusBar={statusBar}
              animateRows
              rowHeight={compact ? 32 : 40}
              headerHeight={compact ? 32 : 38}
              tooltipShowDelay={300}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- sub-components --------------------------------------------- */

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "pos" }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[10px] tracking-wide text-neutral-400 uppercase">{label}</span>
      <span className={`font-mono text-[13px] font-semibold tabular-nums ${tone === "pos" ? "text-emerald-600" : "text-neutral-900"}`}>{value}</span>
    </span>
  );
}

function ScreenGroup({ title, screens, activeId, onSelect, onFav }: {
  title: string;
  screens: Screen[];
  activeId: string;
  onSelect: (id: string) => void;
  onFav: (id: string) => void;
}) {
  if (screens.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="px-3 py-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">{title}</div>
      {screens.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`group flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition ${
              active ? "bg-indigo-50 font-medium text-indigo-800" : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <span
              onClick={(e) => { e.stopPropagation(); onFav(s.id); }}
              className={`cursor-pointer ${s.fav ? "text-amber-400" : "text-neutral-300 group-hover:text-neutral-400"}`}
            >
              ★
            </span>
            <span className="flex-1 truncate">{s.name}</span>
            {s.shared && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-neutral-300"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" /></svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AssetScreenerUpgrade;
