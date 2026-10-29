import { useEffect, useRef, useState } from "react";
import { AS_OF, NEXT_PAYMENT, type DealView, type TrancheClass, type TrancheView } from "./model";
import { INK, bps, dateMid, eurM, pct, spread } from "./format";
import { MicroLabel, StatusChip, Swatch } from "./ui";

/* The selected deal's header strip: a compact definition list of deal
 * facts, the three figures that answer the page's question, and a bespoke
 * SVG capital-structure stack. Hovering or focusing a tranche shows its OC
 * ratio and brackets the balance the ratio divides by. */

const DAY_MS = 86_400_000;

/** Tracks an element's content width so the SVG can lay out in pixels. */
function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.width);
      setW((prev) => (Math.abs(prev - next) > 1 && next > 0 ? next : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function DealHeader({ view }: { view: DealView }) {
  const d = view.deal;
  const w = view.waterfalls.current;
  const origNotes = d.tranches.reduce((s, t) => s + t.orig, 0);
  const nonCallDays = Math.round((d.nonCallEnd - AS_OF) / DAY_MS);
  const facts: { label: string; value: string; sub?: string }[] = [
    { label: "Closing date", value: dateMid(d.closing) },
    {
      label: "Reinvestment period end",
      value: dateMid(d.reinvestEnd),
      sub: view.reinvestDaysLeft > 0 ? `${view.reinvestDaysLeft} days remaining` : "Ended · amortising",
    },
    {
      label: "Non-call end",
      value: dateMid(d.nonCallEnd),
      sub: nonCallDays <= 0 ? "Callable by the equity" : `${nonCallDays} days remaining`,
    },
    { label: "Next payment date", value: dateMid(NEXT_PAYMENT), sub: `in ${view.daysToPayment} days` },
    { label: "Trustee report", value: dateMid(AS_OF), sub: "Determination date for the next payment" },
    { label: "Manager", value: d.manager },
    { label: "Trustee", value: d.trustee },
    {
      label: "Deal size",
      value: `${eurM(origNotes)} notes at close`,
      sub: `${eurM(view.notesOutstanding)} outstanding · collateral ${eurM(view.par)}`,
    },
  ];
  const t = view.tightest;

  return (
    <section aria-labelledby="clo-deal-title" className="border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="clo-deal-title" className="text-lg font-semibold tracking-tight text-neutral-950">
              {d.name}
            </h2>
            <StatusChip status={view.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {view.statusDetail} · {d.vintage} vintage · {view.pool.length} obligors
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-6">
          <div>
            <dt>
              <MicroLabel>Tightest test</MicroLabel>
            </dt>
            <dd className="mt-0.5 text-xl leading-none font-semibold text-neutral-950">{bps(t.cushionBps)}</dd>
            <dd className="mt-1 text-[10px] text-neutral-500">
              {t.label} {pct(t.actual, 1)} vs {pct(t.trigger, 1)}
            </dd>
          </div>
          <div>
            <dt>
              <MicroLabel>Equity, {dateMid(NEXT_PAYMENT)}</MicroLabel>
            </dt>
            <dd className="mt-0.5 text-xl leading-none font-semibold text-neutral-950">{eurM(w.equity, 2)}</dd>
            <dd className="mt-1 text-[10px] text-neutral-500">
              {pct(w.coc, 1)} cash-on-cash · {pct(w.coc * 4, 1)} annualised
            </dd>
          </div>
          <div>
            <dt>
              <MicroLabel>Adjusted par</MicroLabel>
            </dt>
            <dd className="mt-0.5 text-xl leading-none font-semibold text-neutral-950">{eurM(view.adjustedPar)}</dd>
            <dd className="mt-1 text-[10px] text-neutral-500">
              {eurM(view.par)} par less {eurM(view.haircuts.total)} haircuts
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-neutral-100 px-4 py-3 xl:col-span-4 xl:border-r xl:border-b-0">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt>
                <MicroLabel>{f.label}</MicroLabel>
              </dt>
              <dd className="truncate text-xs font-medium text-neutral-900" title={f.value}>
                {f.value}
              </dd>
              {f.sub && <dd className="truncate text-[10px] text-neutral-500">{f.sub}</dd>}
            </div>
          ))}
        </dl>
        <div className="min-w-0 px-4 py-3 xl:col-span-8">
          <div className="flex items-baseline justify-between gap-3">
            <MicroLabel>Capital structure · current balances</MicroLabel>
            <span className="font-mono text-[10px] text-neutral-500 tabular-nums">
              {eurM(view.notesOutstanding)} notes · {eurM(view.adjustedPar)} adjusted par
            </span>
          </div>
          <CapitalStack view={view} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Capital stack
 * ------------------------------------------------------------------ */

const BAR_Y = 24;
const BAR_H = 40;
const SVG_H = BAR_Y + BAR_H + 2;
/** Classes whose fill is light enough to need ink text. */
const INK_TEXT = new Set<TrancheClass>(["F", "Sub"]);

function CapitalStack({ view }: { view: DealView }) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<TrancheClass | null>(null);
  const total = view.notesOutstanding;

  // cumBal is the balance at and above the class, so its start is cumBal − bal
  const segs = view.tranches.map((t) => ({
    t,
    x: ((t.cumBal - t.bal) / total) * width,
    w: (t.bal / total) * width,
  }));
  const hov = segs.find((s) => s.t.cls === hover);
  const readout = hov ? describe(hov.t) : null;

  return (
    <div className="mt-2">
      <div ref={ref} className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${SVG_H}`}
          width={width}
          height={SVG_H}
          className="block"
          role="list"
          aria-label="Capital structure, senior to subordinated, proportional to current balance"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <pattern id="clo-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#e5e5e5" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#737373" strokeWidth="2" />
            </pattern>
          </defs>
          {/* bracket over the balance the hovered class's OC ratio divides by */}
          {hov && hov.t.cls !== "Sub" && (
            <g aria-hidden>
              <path
                d={`M0.75,${BAR_Y - 5} v-7 H${hov.x + hov.w - 0.75} v7`}
                fill="none"
                stroke={INK}
                strokeWidth={1.5}
              />
              <text
                x={Math.min(width - 4, Math.max(4, (hov.x + hov.w) / 2))}
                y={BAR_Y - 15}
                textAnchor={hov.x + hov.w < 160 ? "start" : "middle"}
                fontSize={10}
                fontWeight={600}
                fill={INK}
              >
                {eurM(hov.t.cumBal)} at and above Class {hov.t.cls} · OC {pct(hov.t.oc ?? 0, 1)}
              </text>
            </g>
          )}
          {segs.map((s) => {
            const on = hover === s.t.cls;
            const fill = s.t.cls === "Sub" ? "url(#clo-hatch)" : s.t.color;
            const textFill = INK_TEXT.has(s.t.cls) ? INK : "#ffffff";
            const cx = s.x + s.w / 2;
            return (
              <g
                key={s.t.cls}
                role="listitem"
                tabIndex={0}
                aria-label={describe(s.t)}
                onMouseEnter={() => setHover(s.t.cls)}
                onFocus={() => setHover(s.t.cls)}
                onBlur={() => setHover(null)}
                style={{ outline: "none", cursor: "default" }}
              >
                <rect
                  x={s.x}
                  y={BAR_Y}
                  width={Math.max(0, s.w - 2)}
                  height={BAR_H}
                  fill={fill}
                  stroke={on ? INK : "none"}
                  strokeWidth={on ? 2 : 0}
                />
                {s.w >= 30 && (
                  <text x={cx} y={BAR_Y + 17} textAnchor="middle" fontSize={11} fontWeight={700} fill={textFill}>
                    {s.t.cls === "Sub" ? "Sub" : s.t.cls}
                    {s.w >= 88 && (
                      <tspan fontWeight={500} fontSize={10}>
                        {" "}
                        {s.t.rating}
                      </tspan>
                    )}
                  </text>
                )}
                {s.w >= 56 && (
                  <text x={cx} y={BAR_Y + 32} textAnchor="middle" fontSize={10} fill={textFill} opacity={0.9}>
                    {eurM(s.t.bal)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p aria-live="polite" className="mt-1.5 min-h-[16px] text-[11px] text-neutral-600">
        {readout ?? (
          <span className="text-neutral-400">Hover or focus a tranche for its balance, coupon and OC ratio.</span>
        )}
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-px border border-neutral-100 bg-neutral-100 sm:grid-cols-4 xl:grid-cols-7">
        {view.tranches.map((t) => {
          const state = t.ocPass === null ? null : t.ocPass ? "pass" : "fail";
          return (
            <li key={t.cls} className="bg-white px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                {t.cls === "Sub" ? (
                  <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: "url(#clo-hatch)", backgroundColor: "#d4d4d4" }} />
                ) : (
                  <Swatch color={t.color} />
                )}
                <span className="text-[11px] font-semibold text-neutral-900">
                  {t.cls === "Sub" ? "Sub notes" : `Class ${t.cls}`}
                </span>
                <span className="text-[10px] text-neutral-500">{t.rating}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-neutral-700 tabular-nums">
                {eurM(t.bal)}
                {t.factor < 0.999 && <span className="text-neutral-400"> · {Math.round(t.factor * 100)}% factor</span>}
              </div>
              <div className="font-mono text-[10px] text-neutral-500 tabular-nums">
                {t.cls === "Sub" ? "residual" : spread(t.spread)}
                {t.ocTrigger !== null && t.oc !== null && (
                  <>
                    {" · OC "}
                    <span className={state === "fail" ? "font-semibold text-rose-700" : "text-neutral-700"}>
                      {pct(t.oc, 1)}
                    </span>
                    <span className="text-neutral-400"> / {pct(t.ocTrigger, 1)}</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function describe(t: TrancheView): string {
  const name = t.cls === "Sub" ? "Subordinated notes" : `Class ${t.cls} (${t.rating})`;
  const coupon = t.cls === "Sub" ? "residual cash flows" : `${spread(t.spread)} bps`;
  const size = `${eurM(t.bal)}${t.factor < 0.999 ? ` of ${eurM(t.orig)} original` : ""}`;
  if (t.oc === null) return `${name} · ${size} · ${coupon}`;
  const test =
    t.ocTrigger === null
      ? `OC ${pct(t.oc, 1)} at this class (tested jointly with Class B)`
      : `OC ${pct(t.oc, 1)} vs ${pct(t.ocTrigger, 1)} trigger · ${t.ocPass ? "Pass" : "Fail"}`;
  return `${name} · ${size} · ${coupon} · ${test}`;
}
