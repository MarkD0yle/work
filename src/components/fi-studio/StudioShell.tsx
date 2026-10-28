import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChartSpline, Command, ListChecks, Map as MapIcon, MessagesSquare, Minus, ReceiptText, Search, Sparkles } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { navigateToPage } from "../../lib/navigation";
import { useClock, useTick, wobble } from "../fi-terminal/useTick";
import { STUDIO_SCREENS, type ScreenId } from "./screens";
import { s } from "./tokens";

/* The frame every FI Studio screen sits in:
 *   1. Top bar — the five screens as named tabs with icons, clocks, user.
 *   2. "Jump to…" — ⌘K / Ctrl+K or "/" opens it. Accepts the same function
 *      codes as the terminal (RFQ, TKT, BWIC…), plus plain names.
 *   3. Markets now — the levels a trader glances at, with arrows and words.
 *   4. Footer — connection, data source and keyboard help.
 * Same features as the terminal shell; friendlier delivery. */

const ICONS: Record<ScreenId, ReactNode> = {
  HMAP: <MapIcon className="h-4 w-4" />,
  RFQ: <MessagesSquare className="h-4 w-4" />,
  TKT: <ReceiptText className="h-4 w-4" />,
  BWIC: <ListChecks className="h-4 w-4" />,
  RV: <ChartSpline className="h-4 w-4" />,
};

const STRIP = [
  { k: "UST 2Y", name: "2-year Treasury", v: 3.482, dp: 3, chg: -2.1, unit: "bp", vol: 0.004 },
  { k: "UST 10Y", name: "10-year Treasury", v: 4.012, dp: 3, chg: -3.4, unit: "bp", vol: 0.005 },
  { k: "UST 30Y", name: "30-year Treasury", v: 4.571, dp: 3, chg: -2.8, unit: "bp", vol: 0.004 },
  { k: "2s10s", name: "10Y minus 2Y", v: 53.0, dp: 1, chg: -1.3, unit: "bp", vol: 0.3 },
  { k: "SOFR", name: "Overnight rate", v: 3.58, dp: 2, chg: 0, unit: "bp", vol: 0 },
  { k: "CDX IG", name: "US investment grade index", v: 51.38, dp: 2, chg: 0.62, unit: "bp", vol: 0.08 },
  { k: "CDX HY", name: "US high yield index", v: 318.5, dp: 1, chg: 4.1, unit: "bp", vol: 0.6 },
  { k: "iTraxx Main", name: "Europe IG index", v: 56.12, dp: 2, chg: 0.41, unit: "bp", vol: 0.07 },
  { k: "iTraxx Xover", name: "Europe HY index", v: 292.4, dp: 1, chg: 2.6, unit: "bp", vol: 0.5 },
  { k: "IG OAS", name: "IG cash spread", v: 82, dp: 0, chg: 1, unit: "bp", vol: 0.2 },
  { k: "EURUSD", name: "Euro in dollars", v: 1.0872, dp: 4, chg: -0.12, unit: "%", vol: 0.0002 },
];

export function StudioShell({
  screen,
  title,
  lead,
  context,
  children,
}: {
  screen: ScreenId;
  title: string;
  /** One sentence: what this screen helps you do. */
  lead: string;
  /** Right side of the page header — e.g. the bond in focus. */
  context?: ReactNode;
  children: ReactNode;
}) {
  const [jumpOpen, setJumpOpen] = useState(false);
  const now = useClock();
  const tick = useTick(1500);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        navigateToPage(STUDIO_SCREENS[Number(e.key) - 1].slug);
      } else if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setJumpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ny = now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
  const ldn = now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

  return (
    <MotionConfig reducedMotion="user">
      <div className={`flex h-full flex-col ${s.page} font-sans text-stone-800 antialiased`}>
        {/* 1 · Top bar — left padding clears the app's floating Home pill */}
        <div className="flex h-14 shrink-0 items-center gap-4 border-b border-stone-200 bg-white pr-4 pl-36">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-stone-900">
            <Sparkles className="h-4 w-4 text-indigo-500" /> FI Studio
          </span>
          <nav aria-label="Screens" className="flex h-full items-stretch">
            {STUDIO_SCREENS.map((sc, i) => {
              const on = sc.id === screen;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => !on && navigateToPage(sc.slug)}
                  aria-current={on ? "page" : undefined}
                  title={`${sc.blurb} · Alt+${i + 1}`}
                  className={`relative flex items-center gap-2 px-3.5 text-[13px] transition ${s.focus} ${
                    on ? "font-semibold text-indigo-700" : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {ICONS[sc.id]}
                  {sc.name}
                  {on && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-indigo-600" />}
                </button>
              );
            })}
          </nav>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setJumpOpen(true)}
            className={`flex w-56 items-center gap-2 border border-stone-200 bg-stone-50 px-3 py-1.5 text-[12px] text-stone-400 hover:border-stone-300 ${s.focus}`}
            aria-label="Jump to a screen"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Jump to…</span>
            <kbd className="flex items-center gap-0.5 border border-stone-200 bg-white px-1 text-[10px] text-stone-500">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <span className="text-[12px] text-stone-500 tabular-nums">
            New York <span className="font-medium text-stone-800">{ny}</span> · London <span className="font-medium text-stone-800">{ldn}</span>
          </span>
          <span className="flex items-center gap-2 text-[12px] text-stone-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">MD</span>
            <span className="leading-tight">
              M. Doyle
              <span className="block text-[10px] text-stone-400">IG Credit desk</span>
            </span>
          </span>
        </div>

        {/* 3 · Markets now */}
        <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-stone-200 bg-white/70 px-4">
          <span className="shrink-0 text-[11px] font-medium text-stone-400">Markets now</span>
          {STRIP.map((m, i) => {
            const live = m.v + wobble(tick, i) * m.vol;
            const chg = m.chg + wobble(tick, i + 20) * m.vol * (m.unit === "bp" && m.dp === 3 ? 100 : 1) * 0.5;
            // Rates & spreads: falling is good for a bond holder. FX: plain up/down.
            const flat = Math.abs(chg) < 0.005;
            const good = m.unit === "%" ? chg > 0 : chg < 0;
            const Icon = flat ? Minus : chg > 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <span key={m.k} title={m.name} className="flex shrink-0 items-center gap-1.5 bg-stone-50 px-2.5 py-1 text-[12px] tabular-nums">
                <span className="text-stone-500">{m.k}</span>
                <span className="font-medium text-stone-900">{live.toFixed(m.dp)}</span>
                <span className={`flex items-center ${flat ? "text-stone-400" : good ? "text-emerald-600" : "text-rose-600"}`}>
                  <Icon className="h-3 w-3" aria-hidden />
                  {Math.abs(chg).toFixed(m.unit === "%" ? 2 : 1)}
                  {m.unit === "%" ? "%" : ""}
                </span>
              </span>
            );
          })}
        </div>

        {/* Page header */}
        <div className="flex shrink-0 items-end gap-6 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h1 className={s.h1}>{title}</h1>
            <p className={`mt-0.5 ${s.lead}`}>{lead}</p>
          </div>
          <div className="flex-1" />
          <div className="min-w-0 text-right">{context}</div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-5">{children}</div>

        {/* 4 · Footer */}
        <div className="flex h-8 shrink-0 items-center gap-4 border-t border-stone-200 bg-white px-6 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
          </span>
          <span>Prices from the COMP composite · TRACE trades delayed 15 min</span>
          <span>4 ms</span>
          <div className="flex-1" />
          <span>Alt+1–5 switch screens · ⌘K or / to jump · Esc cancels</span>
          <span className="text-stone-400">Prototype with mock data</span>
        </div>

        {jumpOpen && <JumpTo current={screen} onClose={() => setJumpOpen(false)} />}
      </div>
    </MotionConfig>
  );
}

/** Command palette. Matches function codes, aliases and plain names. */
function JumpTo({ current, onClose }: { current: ScreenId; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const query = q.trim().toUpperCase().replace(/\s*<?GO>?$/, "");
  const hits = STUDIO_SCREENS.filter(
    (sc) => !query || sc.id.includes(query) || sc.aliases.some((a) => a.includes(query)) || sc.name.toUpperCase().includes(query) || sc.blurb.toUpperCase().includes(query),
  );
  const active = Math.min(idx, Math.max(0, hits.length - 1));

  function go(id: ScreenId | undefined) {
    if (!id) return;
    onClose();
    if (id !== current) navigateToPage(STUDIO_SCREENS.find((sc) => sc.id === id)!.slug);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-stone-900/25 pt-[12vh]" onClick={onClose}>
      <div className={`w-[520px] ${s.card} shadow-xl`} role="dialog" aria-modal="true" aria-label="Jump to a screen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-stone-100 px-4">
          <Search className="h-4 w-4 text-stone-400" />
          <input
            ref={ref}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, hits.length - 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
              if (e.key === "Enter") go(hits[active]?.id);
            }}
            placeholder="Type a screen or a code, e.g. RFQ, ticket, curve…"
            aria-label="Search screens"
            className="h-12 flex-1 bg-transparent text-[14px] text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-auto py-1">
          {hits.length === 0 && (
            <li className="px-4 py-3 text-[13px] text-stone-500">
              Couldn't find “{q}”. Try {STUDIO_SCREENS.map((sc) => sc.id).join(", ")}.
            </li>
          )}
          {hits.map((sc, i) => (
            <li key={sc.id}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(sc.id)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-indigo-50" : ""}`}
              >
                <span className="text-indigo-500">{ICONS[sc.id]}</span>
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-stone-900">{sc.name}</span>
                  <span className="block text-[12px] text-stone-500">{sc.blurb}</span>
                </span>
                <kbd className="border border-stone-200 px-1.5 text-[10px] text-stone-500">{sc.id}</kbd>
                {sc.id === current && <span className="text-[11px] text-stone-400">You're here</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
