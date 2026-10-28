import { useEffect, useRef, useState, type ReactNode } from "react";
import { navigateToPage } from "../../lib/navigation";
import { t } from "./tokens";
import { useClock, useTick, wobble } from "./useTick";
import { SCREENS, type ScreenId } from "./screens";

/* The chrome every FI terminal screen sits in:
 *   1. Command bar — type a function code + Enter (Bloomberg's <GO>).
 *   2. Screen tabs — the five functions, also on Alt+1…5.
 *   3. Market strip — the levels a credit/rates trader glances at all day.
 *   4. Status bar — connection, data source, the keys that work here.
 * Screens only provide their body. */


const STRIP = [
  { k: "UST 2Y", v: 3.482, dp: 3, chg: -2.1, unit: "bp", vol: 0.004 },
  { k: "UST 10Y", v: 4.012, dp: 3, chg: -3.4, unit: "bp", vol: 0.005 },
  { k: "UST 30Y", v: 4.571, dp: 3, chg: -2.8, unit: "bp", vol: 0.004 },
  { k: "2s10s", v: 53.0, dp: 1, chg: -1.3, unit: "bp", vol: 0.3 },
  { k: "SOFR", v: 3.58, dp: 2, chg: 0, unit: "bp", vol: 0 },
  { k: "CDX IG", v: 51.38, dp: 2, chg: 0.62, unit: "bp", vol: 0.08 },
  { k: "CDX HY", v: 318.5, dp: 1, chg: 4.1, unit: "bp", vol: 0.6 },
  { k: "iTraxx Main", v: 56.12, dp: 2, chg: 0.41, unit: "bp", vol: 0.07 },
  { k: "iTraxx Xover", v: 292.4, dp: 1, chg: 2.6, unit: "bp", vol: 0.5 },
  { k: "IG OAS", v: 82, dp: 0, chg: 1, unit: "bp", vol: 0.2 },
  { k: "EURUSD", v: 1.0872, dp: 4, chg: -0.12, unit: "%", vol: 0.0002 },
];

export function TerminalShell({
  screen,
  context,
  children,
}: {
  screen: ScreenId;
  /** Right-hand context in the command bar — e.g. the bond in focus. */
  context?: ReactNode;
  children: ReactNode;
}) {
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const cmdRef = useRef<HTMLInputElement>(null);
  const now = useClock();
  const tick = useTick(1500);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        navigateToPage(SCREENS[Number(e.key) - 1].slug);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        cmdRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function run() {
    const code = cmd.trim().toUpperCase().replace(/\s*<?GO>?$/, "");
    if (!code) return;
    const hit = SCREENS.find((s) => s.id === code || s.aliases.includes(code));
    if (hit) {
      setCmd("");
      setMsg(null);
      if (hit.id !== screen) navigateToPage(hit.slug);
    } else {
      setMsg(`${code}: unknown function — try ${SCREENS.map((s) => s.id).join(" · ")}`);
    }
  }

  const ny = now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false });
  const ldn = now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour12: false });

  return (
    <div className={`flex h-full flex-col ${t.page} font-mono text-[12px] ${t.body}`}>
      {/* 1 · Command bar — left padding clears the app's floating Home pill */}
      <div className={`flex h-10 shrink-0 items-center gap-3 border-b ${t.border} bg-black pl-32 pr-3`}>
        <span className="text-[11px] font-bold tracking-[0.2em] text-amber-400">FI◆TERM</span>
        <form
          className={`flex h-7 w-80 items-center border ${t.borderStrong} bg-[#05070a] focus-within:border-amber-400`}
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <span className="px-2 text-amber-400">›</span>
          <input
            ref={cmdRef}
            value={cmd}
            onChange={(e) => {
              setCmd(e.target.value);
              setMsg(null);
            }}
            placeholder={`${screen}  — type a function, e.g. RFQ`}
            aria-label="Command line: type a function code and press Enter"
            className="min-w-0 flex-1 bg-transparent uppercase text-amber-200 placeholder:normal-case placeholder:text-neutral-600 focus:outline-none"
          />
          <button type="submit" className="h-full bg-amber-400 px-2 text-[10px] font-bold text-black hover:bg-amber-300">
            GO
          </button>
        </form>
        {msg ? <span className="truncate text-[11px] text-rose-400">{msg}</span> : <div className="min-w-0 flex-1 truncate">{context}</div>}
        {msg && <div className="flex-1" />}
        <div className="flex shrink-0 items-center gap-4 text-[11px] tabular-nums">
          <span>
            <span className={t.faint}>NY </span>
            <span className={t.value}>{ny}</span>
          </span>
          <span>
            <span className={t.faint}>LDN </span>
            <span className={t.value}>{ldn}</span>
          </span>
          <span className="flex items-center gap-1.5 text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            M.DOYLE · IG CREDIT
          </span>
        </div>
      </div>

      {/* 2 · Screen tabs */}
      <nav aria-label="Terminal functions" className={`flex h-8 shrink-0 items-stretch border-b ${t.border} bg-[#090c11] pl-32`}>
        {SCREENS.map((s, i) => {
          const on = s.id === screen;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => !on && navigateToPage(s.slug)}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-2 border-r ${t.border} px-4 text-[11px] transition ${t.focus} ${
                on ? "bg-amber-400 font-bold text-black" : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
              }`}
            >
              <span className={on ? "text-black/60" : "text-neutral-600"}>{i + 1}</span>
              <span className="font-bold">{s.id}</span>
              <span className={on ? "text-black/80" : "text-neutral-500"}>{s.name}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="flex items-center px-3 text-[10px] text-neutral-600">Alt+1…5 switch · / command</span>
      </nav>

      {/* 3 · Market strip */}
      <div className={`flex h-7 shrink-0 items-center gap-5 overflow-hidden border-b ${t.border} bg-black px-3 text-[11px] tabular-nums`}>
        {STRIP.map((s, i) => {
          const live = s.v + wobble(tick, i) * s.vol;
          const chg = s.chg + wobble(tick, i + 20) * s.vol * (s.unit === "bp" && s.dp === 3 ? 100 : 1) * 0.5;
          // Rates & spreads: falling is green for a long-bond holder. FX: plain up/down.
          const good = s.unit === "%" ? chg > 0 : chg < 0;
          return (
            <span key={s.k} className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-neutral-500">{s.k}</span>
              <span className={t.value}>{live.toFixed(s.dp)}</span>
              <span className={Math.abs(chg) < 0.005 ? t.faint : good ? t.up : t.down}>
                {chg > 0 ? "+" : chg < 0 ? "−" : ""}
                {Math.abs(chg).toFixed(s.unit === "%" ? 2 : 1)}
                {s.unit === "%" ? "%" : ""}
              </span>
            </span>
          );
        })}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      {/* 4 · Status bar */}
      <div className={`flex h-6 shrink-0 items-center gap-4 border-t ${t.border} bg-black px-3 text-[10px] text-neutral-500`}>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> CONNECTED
        </span>
        <span>Pricing: COMP composite · TRACE 15m delayed</span>
        <span>Latency 4ms</span>
        <div className="flex-1" />
        <span>Prototype · mock data · not a live market</span>
      </div>
    </div>
  );
}
