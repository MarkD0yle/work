import { useState } from "react";
import { headroomBn, type RatioDef, type RatioKey, type SegKey, type Snapshot } from "./model";
import {
  ACCENT_WASH,
  SEG_FILL,
  bn,
  fmtRatio,
  fmtUnits,
  headroomUnits,
  num,
  pct,
  toneOf,
} from "./format";
import { Delta, MicroLabel } from "./ui";

/* Section 1: one bullet per ratio against its requirement stack.
 *
 * Each bullet is plain HTML on a 0-based scale shared within its group
 * (capital ratios share one scale, liquidity ratios another) so the eye can
 * compare CET1 against Total capital directly. Stepped grays build the
 * requirement up to the MDA threshold; the navy wash between the threshold
 * and the navy marker is the headroom the page is about. */

export interface Scale {
  max: number;
  step: number;
}
export type Group = RatioDef["group"];

const GROUP_META: Record<Group, { title: string; unit: string }> = {
  capital: { title: "Capital", unit: "% of risk-weighted assets" },
  leverage: { title: "Leverage", unit: "Tier 1 as % of leverage exposure" },
  liquidity: { title: "Liquidity", unit: "HQLA ÷ net outflows · ASF ÷ RSF" },
};

const SURPLUS_LABEL: Record<RatioKey, string> = {
  cet1: "CET1 surplus",
  t1: "Tier 1 surplus",
  tc: "Own funds surplus",
  lev: "Tier 1 surplus",
  lcr: "HQLA surplus",
  nsfr: "ASF surplus",
};

const GRID = {
  gridTemplateColumns: "minmax(132px, 164px) minmax(0, 1fr) 84px 84px 112px",
  columnGap: 20,
};

const BAND_TOP = 24;
const BAND_H = 16;

interface Hover {
  key: RatioKey;
  x: number;
  title: string;
  value: string;
}

export function RatioBullets({
  defs,
  current,
  compare,
  compareLabel,
  compareMissing,
  scales,
}: {
  defs: RatioDef[];
  current: Snapshot;
  compare: Snapshot | null;
  compareLabel: string;
  compareMissing: string;
  scales: Record<Group, Scale>;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const groups: Group[] = ["capital", "leverage", "liquidity"];
  const presentKeys = new Set<SegKey>(defs.flatMap((d) => d.stack.map((s) => s.key)));

  return (
    <div>
      <Legend keys={presentKeys} />

      <div className="mt-5 grid items-end border-b border-neutral-200 pb-2" style={GRID}>
        <MicroLabel>Ratio</MicroLabel>
        <MicroLabel>Position against the requirement stack</MicroLabel>
        <MicroLabel className="text-right">Headroom</MicroLabel>
        <MicroLabel className="text-right">Surplus</MicroLabel>
        <MicroLabel className="text-right">vs {compareLabel}</MicroLabel>
      </div>

      {groups.map((g) => {
        const rows = defs.filter((d) => d.group === g);
        const scale = scales[g];
        const ticks: number[] = [];
        for (let t = 0; t <= scale.max + 1e-9; t += scale.step) ticks.push(t);
        return (
          <div key={g} className="border-b border-neutral-100 pt-4 pb-3 last:border-b-0">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-xs font-semibold text-neutral-800">{GROUP_META[g].title}</span>
              <span className="text-[11px] text-neutral-400">{GROUP_META[g].unit}</span>
            </div>
            {rows.map((def) => {
              const value = current.ratio[def.key];
              const hUnits = headroomUnits(def, value);
              const hBn = headroomBn(def, current);
              const breach = hUnits < 0;
              const prev = compare ? compare.ratio[def.key] : null;
              const d = prev === null ? null : def.headroomUnit === "bps" ? (value - prev) * 100 : value - prev;
              return (
                <div key={def.key} className="grid items-center py-1.5" style={GRID}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900">{def.label}</div>
                    <div className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                      {def.reqLabel} {fmtRatio(def, def.requirement)}
                    </div>
                  </div>
                  <Bullet
                    def={def}
                    value={value}
                    scale={scale}
                    ticks={ticks}
                    hover={hover?.key === def.key ? hover : null}
                    onHover={setHover}
                    headroomText={`${fmtUnits(def, hUnits)} · ${bn(hBn)}`}
                  />
                  <div className="text-right">
                    <div
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        breach ? "text-rose-700" : "text-neutral-900"
                      }`}
                    >
                      {breach && <span aria-hidden>✕ </span>}
                      {fmtUnits(def, hUnits)}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {breach ? "below " : "over "}
                      {def.reqLabel === "MDA" ? "MDA" : def.group === "leverage" ? "requirement" : "minimum"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums text-neutral-800">{bn(hBn)}</div>
                    <div className="text-[10px] text-neutral-400">{SURPLUS_LABEL[def.key]}</div>
                  </div>
                  <div className="text-right">
                    {d === null ? (
                      <>
                        <div className="font-mono text-sm text-neutral-300" aria-label="No comparison">
                          —
                        </div>
                        <div className="text-[10px] text-neutral-400">{compareMissing}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-mono text-sm tabular-nums">
                          <Delta
                            text={fmtUnits(def, d, true)}
                            tone={toneOf(d, true, def.headroomUnit === "bps" ? 0.5 : 0.05)}
                          />
                        </div>
                        <div className="text-[10px] text-neutral-400">from {fmtRatio(def, prev!)}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {/* shared axis for the group */}
            <div className="grid" style={GRID} aria-hidden>
              <span />
              <div className="relative h-4">
                {ticks.map((t) => {
                  const p = (t / scale.max) * 100;
                  return (
                    <span
                      key={t}
                      className="absolute top-0 font-mono text-[10px] text-neutral-400 tabular-nums"
                      style={{
                        left: `${p}%`,
                        transform: `translateX(${p === 0 ? "0" : p >= 99.9 ? "-100%" : "-50%"})`,
                      }}
                    >
                      {num(t, 0)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bullet({
  def,
  value,
  scale,
  ticks,
  hover,
  onHover,
  headroomText,
}: {
  def: RatioDef;
  value: number;
  scale: Scale;
  ticks: number[];
  hover: Hover | null;
  onHover: (h: Hover | null) => void;
  headroomText: string;
}) {
  const x = (v: number) => Math.max(0, Math.min(100, (v / scale.max) * 100));
  const shift = (p: number) => (p > 90 ? "-100%" : p < 6 ? "0%" : "-50%");
  const segs = def.stack.reduce<{ key: SegKey; label: string; value: number; start: number }[]>(
    (acc, s) => {
      const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].value : 0;
      return [...acc, { ...s, start }];
    },
    [],
  );
  const req = def.requirement;
  const breach = value < req;
  const aria = `${def.label} ${fmtRatio(def, value)}. ${def.reqLabel} ${fmtRatio(def, req)}, made up of ${segs
    .map((s) => `${s.label} ${pct(s.value, 2)}`)
    .join(", ")}. Management target ${fmtRatio(def, def.target)}. Headroom ${headroomText}.`;

  return (
    <div className="relative h-16" role="img" aria-label={aria} onMouseLeave={() => onHover(null)}>
      {ticks.map((t) => (
        <div
          key={t}
          aria-hidden
          className="absolute w-px bg-neutral-100"
          style={{ left: `${x(t)}%`, top: BAND_TOP - 8, height: BAND_H + 16 }}
        />
      ))}
      <div
        aria-hidden
        className="absolute inset-x-0 bg-neutral-50"
        style={{ top: BAND_TOP, height: BAND_H }}
      />
      {segs.map((s) => (
        <div
          key={s.key}
          aria-hidden
          className="absolute"
          style={{
            top: BAND_TOP,
            height: BAND_H,
            left: `${x(s.start)}%`,
            width: `${x(s.start + s.value) - x(s.start)}%`,
            background: SEG_FILL[s.key],
            boxShadow: "inset -2px 0 0 #fff",
          }}
          onMouseEnter={() =>
            onHover({
              key: def.key,
              x: x(s.start + s.value / 2),
              title: s.label,
              value: pct(s.value, 2),
            })
          }
        />
      ))}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: BAND_TOP,
          height: BAND_H,
          left: `${x(Math.min(req, value))}%`,
          width: `${Math.abs(x(value) - x(req))}%`,
          background: breach ? "rgba(225, 29, 72, 0.16)" : ACCENT_WASH,
        }}
        onMouseEnter={() =>
          onHover({
            key: def.key,
            x: (x(req) + x(value)) / 2,
            title: breach ? `Shortfall to ${def.reqLabel}` : `Headroom over ${def.reqLabel}`,
            value: headroomText,
          })
        }
      />
      {/* management target: dashed tick, label below the band */}
      <div
        aria-hidden
        className="absolute border-l-2 border-dashed border-neutral-800"
        style={{ left: `${x(def.target)}%`, top: BAND_TOP - 6, height: BAND_H + 12, marginLeft: -1 }}
      />
      <div
        aria-hidden
        className="absolute text-[10px] whitespace-nowrap text-neutral-500"
        style={{
          left: `${x(def.target)}%`,
          top: BAND_TOP + BAND_H + 7,
          transform: `translateX(${shift(x(def.target))})`,
        }}
      >
        Target {fmtRatio(def, def.target)}
      </div>
      {/* actual: bold navy marker with its value above */}
      <div
        aria-hidden
        className="absolute bg-blue-900"
        style={{ left: `${x(value)}%`, top: BAND_TOP - 7, height: BAND_H + 14, width: 4, marginLeft: -2 }}
      />
      <div
        aria-hidden
        className="absolute text-xs font-semibold whitespace-nowrap text-neutral-950"
        style={{ left: `${x(value)}%`, top: 0, transform: `translateX(${shift(x(value))})` }}
      >
        {fmtRatio(def, value)}
      </div>
      {hover && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 bg-neutral-950 px-2 py-1.5 text-[11px] whitespace-nowrap text-neutral-50"
          style={{ left: `${hover.x}%`, top: -6, transform: `translate(${shift(hover.x)}, -100%)` }}
        >
          <div className="font-mono font-semibold tabular-nums">{hover.value}</div>
          <div className="text-neutral-300">{hover.title}</div>
        </div>
      )}
    </div>
  );
}

function Legend({ keys }: { keys: Set<SegKey> }) {
  const segItems: { key: SegKey; label: string }[] = [
    { key: "p1", label: "Pillar 1 / minimum" },
    { key: "p2a", label: "Pillar 2A" },
    { key: "ccb", label: "Conservation buffer" },
    { key: "ccyb", label: "Countercyclical buffer" },
    { key: "sys", label: "O-SII buffer" },
  ];
  // Two groups so a narrow column breaks between "stack" and "markers"
  // rather than orphaning one swatch on its own line.
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-neutral-200 bg-neutral-50/60 px-4 py-2.5 text-[11px] text-neutral-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Key</span>
        {segItems
          .filter((s) => keys.has(s.key))
          .map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-3.5" style={{ background: SEG_FILL[s.key] }} />
              {s.label}
            </span>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-3.5" style={{ background: ACCENT_WASH }} />
          Headroom
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3.5 border-l-2 border-dashed border-neutral-800" />
          Management target
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3.5 w-1 bg-blue-900" />
          Actual
        </span>
      </div>
    </div>
  );
}

/** Accessible twin of the bullets: the requirement stack as numbers. */
export function RequirementTable({
  defs,
  current,
}: {
  defs: RatioDef[];
  current: Snapshot;
}) {
  const rows: { label: string; get: (d: RatioDef) => string; strong?: boolean }[] = [
    { label: "Pillar 1 / minimum", get: (d) => segVal(d, "p1") },
    { label: "Pillar 2A", get: (d) => segVal(d, "p2a") },
    { label: "Capital conservation buffer", get: (d) => segVal(d, "ccb") },
    { label: "Countercyclical buffer", get: (d) => segVal(d, "ccyb") },
    { label: "O-SII buffer", get: (d) => segVal(d, "sys") },
    { label: "Requirement incl. buffers", get: (d) => fmtRatio(d, d.requirement), strong: true },
    { label: "Management target", get: (d) => fmtRatio(d, d.target) },
    { label: "Actual", get: (d) => fmtRatio(d, current.ratio[d.key]), strong: true },
    { label: "Headroom", get: (d) => fmtUnits(d, headroomUnits(d, current.ratio[d.key])) },
    { label: "Surplus", get: (d) => bn(headroomBn(d, current)) },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">Requirement build-up by ratio</caption>
        <thead>
          <tr className="border-b border-neutral-200">
            <th scope="col" className="px-2 py-1.5 text-left text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Component
            </th>
            {defs.map((d) => (
              <th
                key={d.key}
                scope="col"
                className="px-2 py-1.5 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase"
              >
                {d.label.replace(" ratio", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.label} className={r.strong ? "bg-neutral-50" : ""}>
              <th
                scope="row"
                className={`px-2 py-1.5 text-left ${r.strong ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}
              >
                {r.label}
              </th>
              {defs.map((d) => (
                <td
                  key={d.key}
                  className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                    r.strong ? "font-semibold text-neutral-900" : "text-neutral-700"
                  }`}
                >
                  {r.get(d)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function segVal(d: RatioDef, key: SegKey) {
  const s = d.stack.find((x) => x.key === key);
  return s ? pct(s.value, 2) : "–";
}
