import { useState } from "react";

export const title = "Execution Desk";
export const section = "global-markets";
export const fullWidth = true;

/* Global Markets lifecycle · Stage 3 — Execution.
 *
 * Design: a dark desk terminal. Order ticket on the left, a central price
 * ladder with resting depth either side, and a live prints tape on the
 * right. Everything monospace, dense and glanceable. */

type Level = { px: string; bid?: number; ask?: number; mine?: boolean };

const LADDER: Level[] = [
  { px: "99.155", ask: 42 },
  { px: "99.150", ask: 118 },
  { px: "99.145", ask: 260, mine: true },
  { px: "99.140", ask: 391 },
  { px: "99.135", ask: 74 },
  { px: "99.130" },
  { px: "99.125", bid: 96 },
  { px: "99.120", bid: 285, mine: true },
  { px: "99.115", bid: 340 },
  { px: "99.110", bid: 152 },
  { px: "99.105", bid: 61 },
];

const MAX_DEPTH = 400;

type Print = { time: string; px: string; qty: number; side: "b" | "s" };

const TAPE: Print[] = [
  { time: "14:32:07.412", px: "99.130", qty: 25, side: "b" },
  { time: "14:32:06.981", px: "99.125", qty: 60, side: "s" },
  { time: "14:32:06.310", px: "99.130", qty: 12, side: "b" },
  { time: "14:32:05.774", px: "99.130", qty: 45, side: "b" },
  { time: "14:32:05.201", px: "99.125", qty: 110, side: "s" },
  { time: "14:32:04.688", px: "99.125", qty: 8, side: "s" },
  { time: "14:32:03.950", px: "99.135", qty: 75, side: "b" },
  { time: "14:32:03.412", px: "99.130", qty: 33, side: "b" },
  { time: "14:32:02.870", px: "99.125", qty: 90, side: "s" },
  { time: "14:32:02.119", px: "99.120", qty: 150, side: "s" },
  { time: "14:32:01.633", px: "99.130", qty: 18, side: "b" },
  { time: "14:32:01.077", px: "99.125", qty: 54, side: "s" },
];

const WORKING = [
  { ref: "W-2214", side: "Buy", qty: 120, px: "99.120", filled: 35, venue: "CME" },
  { ref: "W-2211", side: "Sell", qty: 200, px: "99.145", filled: 140, venue: "CME" },
];

const QTY_PRESETS = [10, 25, 50, 100, 250];

export default function GmExecutionDesk() {
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [qty, setQty] = useState(50);

  const buy = side === "Buy";

  return (
    <div className="flex h-full flex-col bg-[#0c0f14] font-mono text-neutral-300">
      {/* Top strip */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-baseline gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-blue-400">
              Global markets · Lifecycle 03 — Execution
            </p>
            <h1 className="text-lg font-semibold text-white">
              UST 10Y Future <span className="text-neutral-500">· ZN Dec26</span>
            </h1>
          </div>
        </div>
        <div className="flex gap-6 text-right text-xs">
          <div>
            <p className="text-neutral-500">Last</p>
            <p className="text-base font-semibold text-emerald-400">99.130</p>
          </div>
          <div>
            <p className="text-neutral-500">Chg</p>
            <p className="text-base font-semibold text-emerald-400">+0.085</p>
          </div>
          <div>
            <p className="text-neutral-500">Volume</p>
            <p className="text-base font-semibold text-white">1.24M</p>
          </div>
          <div>
            <p className="text-neutral-500">Session VWAP</p>
            <p className="text-base font-semibold text-white">99.108</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Ticket */}
        <div className="flex w-72 shrink-0 flex-col border-r border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">Order ticket</p>
          <div className="mt-3 grid grid-cols-2 gap-1">
            {(["Buy", "Sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`py-2.5 text-sm font-bold uppercase tracking-wide transition ${
                  side === s
                    ? s === "Buy"
                      ? "bg-emerald-500 text-black"
                      : "bg-rose-500 text-black"
                    : "bg-white/5 text-neutral-400 hover:bg-white/10"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[10px] uppercase tracking-widest text-neutral-500">Quantity</p>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {QTY_PRESETS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQty(q)}
                className={`py-1.5 text-xs transition ${
                  qty === q
                    ? "bg-blue-500 font-bold text-black"
                    : "bg-white/5 text-neutral-400 hover:bg-white/10"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between border border-white/10 px-3 py-2">
              <span className="text-neutral-500">Type</span>
              <span className="text-white">Limit</span>
            </div>
            <div className="flex justify-between border border-white/10 px-3 py-2">
              <span className="text-neutral-500">Price</span>
              <span className="text-white">{buy ? "99.120" : "99.145"}</span>
            </div>
            <div className="flex justify-between border border-white/10 px-3 py-2">
              <span className="text-neutral-500">TIF</span>
              <span className="text-white">Day</span>
            </div>
          </div>

          <button
            type="button"
            className={`mt-4 py-3 text-sm font-bold uppercase tracking-widest text-black ${
              buy ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
            }`}
          >
            {side} {qty} @ {buy ? "99.120" : "99.145"}
          </button>

          <div className="mt-6 min-h-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Working</p>
            <ul className="mt-2 space-y-1.5">
              {WORKING.map((w) => (
                <li key={w.ref} className="border border-white/10 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <span className={w.side === "Buy" ? "text-emerald-400" : "text-rose-400"}>
                      {w.side} {w.qty} @ {w.px}
                    </span>
                    <span className="text-neutral-500">{w.venue}</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full bg-white/10">
                    <div
                      className="h-1 bg-blue-400"
                      style={{ width: `${(w.filled / w.qty) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-neutral-500">
                    {w.filled}/{w.qty} filled · {w.ref}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ladder */}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">Depth ladder</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-x-3 text-xs">
            <span className="pb-2 text-right text-neutral-500">Bids</span>
            <span className="pb-2 text-center text-neutral-500">Price</span>
            <span className="pb-2 text-neutral-500">Asks</span>
            {LADDER.map((lvl) => (
              <LadderRow key={lvl.px} lvl={lvl} />
            ))}
          </div>
          <p className="mt-4 text-[10px] text-neutral-600">
            ▸ marks your resting orders. Depth in contracts ×10.
          </p>
        </div>

        {/* Tape */}
        <div className="flex w-64 shrink-0 flex-col border-l border-white/10">
          <p className="border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-widest text-neutral-500">
            Time &amp; sales
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-[11px]">
              <tbody>
                {TAPE.map((t, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-4 py-1.5 text-neutral-600">{t.time}</td>
                    <td
                      className={`py-1.5 text-right font-semibold ${
                        t.side === "b" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {t.px}
                    </td>
                    <td className="px-4 py-1.5 text-right text-neutral-400">{t.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function LadderRow({ lvl }: { lvl: Level }) {
  const bidPct = lvl.bid ? (lvl.bid / MAX_DEPTH) * 100 : 0;
  const askPct = lvl.ask ? (lvl.ask / MAX_DEPTH) * 100 : 0;
  const isMid = !lvl.bid && !lvl.ask;
  return (
    <>
      {/* Bid side */}
      <div className="relative flex h-7 items-center justify-end pr-2">
        {lvl.bid && (
          <>
            <div
              className="absolute inset-y-1 right-0 bg-emerald-500/20"
              style={{ width: `${bidPct}%` }}
            />
            <span className="relative z-10 text-emerald-300">
              {lvl.mine && <span className="mr-1 text-blue-400">▸</span>}
              {lvl.bid}
            </span>
          </>
        )}
      </div>
      {/* Price */}
      <div
        className={`flex h-7 w-20 items-center justify-center ${
          isMid ? "bg-white/10 font-bold text-white" : "text-neutral-400"
        }`}
      >
        {lvl.px}
      </div>
      {/* Ask side */}
      <div className="relative flex h-7 items-center pl-2">
        {lvl.ask && (
          <>
            <div
              className="absolute inset-y-1 left-0 bg-rose-500/20"
              style={{ width: `${askPct}%` }}
            />
            <span className="relative z-10 text-rose-300">
              {lvl.ask}
              {lvl.mine && <span className="ml-1 text-blue-400">◂</span>}
            </span>
          </>
        )}
      </div>
    </>
  );
}
