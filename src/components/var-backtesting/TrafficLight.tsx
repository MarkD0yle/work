import type { ReactNode } from "react";
import type { Basis, Confidence, ScopeView, WindowLen, Zone } from "./model";
import { SCOPE_LABEL } from "./model";
import { ZONE_META, gbpM, gbpMSigned, num2, pval } from "./format";
import { MicroLabel, PassFail, ZoneChip } from "./ui";

/* The KPI treatment: a square three-lamp Basel traffic light with the lit
 * zone labelled, the exception count as the page's one hero figure, the
 * capital multiplier with its plus-factor ladder, and the statistical tests
 * underneath. */

const LAMPS: Zone[] = ["red", "amber", "green"];

const PLUS_LADDER = [
  { k: "0–4", v: 0, hit: (n: number) => n <= 4 },
  { k: "5", v: 0.4, hit: (n: number) => n === 5 },
  { k: "6", v: 0.5, hit: (n: number) => n === 6 },
  { k: "7", v: 0.65, hit: (n: number) => n === 7 },
  { k: "8", v: 0.75, hit: (n: number) => n === 8 },
  { k: "9", v: 0.85, hit: (n: number) => n === 9 },
  { k: "10+", v: 1, hit: (n: number) => n >= 10 },
];

export function TrafficLight({
  view,
  basis,
  conf,
  win,
}: {
  view: ScopeView;
  basis: Basis;
  conf: Confidence;
  win: WindowLen;
}) {
  const { cut, zone, exceptions, expected, kupiec, christ } = view;
  const ranges: Record<Zone, string> = {
    green: `0–${cut.greenMax}`,
    amber: `${cut.greenMax + 1}–${cut.redFrom - 1}`,
    red: `${cut.redFrom}+`,
  };
  const regulatory = conf === "99" && win === "250";
  const last = view.days[view.days.length - 1];
  const prior = view.days[view.days.length - 21];
  const varDelta = last.var - prior.var;
  const plus = view.multiplier - 3;
  const isFirm = view.scope === "firm";

  return (
    <section
      aria-labelledby="vb-light-title"
      className="flex h-full flex-col border border-neutral-200 bg-white"
    >
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 id="vb-light-title" className="text-sm font-semibold text-neutral-900">
            Basel traffic light
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {SCOPE_LABEL[view.scope]} · {basis === "hypo" ? "hypothetical" : "actual"} P&amp;L ·{" "}
            {conf}% · {win} days
          </p>
        </div>
        <ZoneChip zone={zone} />
      </header>

      {/* lamps + hero count */}
      <div className="flex items-stretch gap-3 px-4 pt-4 pb-3">
        <div
          role="img"
          aria-label={`Traffic light: ${ZONE_META[zone].label} zone lit`}
          className="flex flex-col gap-1.5 bg-neutral-900 p-1.5"
        >
          {LAMPS.map((z) => {
            const lit = z === zone;
            const c = ZONE_META[z].color;
            return (
              <div
                key={z}
                className="h-10 w-10 transition-colors"
                style={{
                  background: lit ? c : `${c}38`,
                  boxShadow: lit ? `0 0 16px 2px ${c}80, inset 0 0 0 2px rgba(255,255,255,0.18)` : undefined,
                }}
              />
            );
          })}
        </div>
        <ul className="flex flex-col justify-around py-1.5" aria-label="Zone thresholds">
          {LAMPS.map((z) => {
            const lit = z === zone;
            return (
              <li key={z} className="flex items-baseline gap-1.5 leading-none">
                <span
                  className={`text-[11px] ${lit ? "font-semibold text-neutral-900" : "text-neutral-400"}`}
                >
                  {ZONE_META[z].label}
                </span>
                <span
                  className={`font-mono text-[10px] tabular-nums ${lit ? "text-neutral-700" : "text-neutral-400"}`}
                >
                  {ranges[z]}
                </span>
                {lit && (
                  <span className="text-[10px] font-semibold text-neutral-900" aria-label="current zone">
                    ◀
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex flex-col items-end justify-center text-right">
          <div className="text-[56px] leading-none font-semibold tracking-tight text-neutral-950">
            {exceptions}
          </div>
          <div className="mt-1 text-xs font-medium text-neutral-700">
            exception{exceptions === 1 ? "" : "s"} / {win} days
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-400">
            Expected {expected.toFixed(expected % 1 ? 1 : 0)} at {conf}%
          </div>
        </div>
      </div>

      {/* capital multiplier */}
      <div className="border-t border-neutral-100 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <MicroLabel>{isFirm ? "Capital multiplier" : "Indicative multiplier"}</MicroLabel>
          <span className="text-2xl leading-none font-semibold tracking-tight text-neutral-950">
            {num2(view.multiplier)}×
          </span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          3.00 base + {num2(plus)} plus-factor from {view.regCount} exception
          {view.regCount === 1 ? "" : "s"} at 99% over 250 days
          {regulatory ? "" : " (regulatory basis, not the view above)"}
          {isFirm ? "." : "; the charge applies firm-wide."}
        </p>
        <ol className="mt-2 grid grid-cols-7 gap-px border border-neutral-200 bg-neutral-200" aria-label="Plus-factor ladder">
          {PLUS_LADDER.map((s) => {
            const on = s.hit(view.regCount);
            return (
              <li
                key={s.k}
                aria-current={on ? "step" : undefined}
                className={`flex flex-col items-center py-1 ${on ? "bg-neutral-900 text-white" : "bg-white text-neutral-500"}`}
              >
                <span className="font-mono text-[10px] font-semibold tabular-nums">{s.k}</span>
                <span className={`font-mono text-[9px] tabular-nums ${on ? "text-neutral-300" : "text-neutral-400"}`}>
                  +{s.v.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* supporting measures */}
      <dl className="mt-auto divide-y divide-neutral-100 border-t border-neutral-100">
        <Row
          label={`Current 1-day VaR · ${conf}%`}
          sub={
            <span className={varDelta > 0 ? "text-rose-700" : "text-emerald-700"}>
              {varDelta > 0 ? "▲" : "▼"} {gbpMSigned(varDelta)} vs 20 days ago
            </span>
          }
          value={gbpM(last.var)}
        />
        <Row
          label={`Stressed VaR · ${conf}%`}
          sub={<span>{num2(last.svar / last.var)}× current VaR · 2008–09 window</span>}
          value={gbpM(last.svar)}
        />
        <Row
          label="Kupiec POF (count)"
          sub={
            <span className="font-mono tabular-nums">
              LR {num2(kupiec.lr)} · p {pval(kupiec.p)} · 5% test
            </span>
          }
          value={<PassFail pass={kupiec.pass} />}
        />
        <Row
          label="Christoffersen (independence)"
          sub={
            <span className="font-mono tabular-nums">
              LR {num2(christ.lr)} · p {pval(christ.p)} · {christ.n11} back-to-back
            </span>
          }
          value={<PassFail pass={christ.pass} />}
        />
      </dl>
    </section>
  );
}

function Row({ label, sub, value }: { label: string; sub: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <dt className="min-w-0">
        <span className="block text-[11px] font-medium text-neutral-700">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] font-normal text-neutral-500">{sub}</span>
      </dt>
      <dd className="shrink-0 font-mono text-sm font-semibold text-neutral-900 tabular-nums">{value}</dd>
    </div>
  );
}
