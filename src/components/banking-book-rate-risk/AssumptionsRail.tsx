import { APPROVED, ASSUMPTION_META, type AssumptionKey, type Assumptions, type ScenarioResult, type View as RiskView } from "./model";
import { FOCUS, STATUS, gbpMSigned, pct, pctSigned, years } from "./format";
import { AlertIcon, MicroLabel, StatusChip } from "./ui";

/* The sticky right rail: five behavioural assumptions as native range
 * inputs. Every figure on the page recomputes as they move; each slider
 * reports what it alone contributes to the selected scenario's ΔEVE and
 * ΔNII against its approved value. */

export interface SliderDelta {
  eve: number;
  nii: number;
}

const fmtValue = (k: AssumptionKey, v: number) =>
  k === "life" ? years(v) : k === "cpr" ? pct(v * 100, 1) : pct(v * 100, 0);

/* Square thumb and hairline track on the native range input. */
const RANGE =
  `relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent ${FOCUS} ` +
  "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-neutral-200 " +
  "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-neutral-900 " +
  "[&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-neutral-200 " +
  "[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-neutral-900 [&::-moz-range-thumb]:[border-radius:0]";

export function AssumptionsRail({
  value,
  onChange,
  onReset,
  deltas,
  scenario,
  view,
  approvedView,
}: {
  value: Assumptions;
  onChange: (k: AssumptionKey, v: number) => void;
  onReset: () => void;
  deltas: Record<AssumptionKey, SliderDelta>;
  scenario: ScenarioResult;
  view: RiskView;
  approvedView: RiskView;
}) {
  const dirty = ASSUMPTION_META.some((m) => value[m.key] !== APPROVED[m.key]);
  const offCount = ASSUMPTION_META.filter((m) => value[m.key] !== APPROVED[m.key]).length;
  const statusOf = (v: RiskView) => new Map(v.scenarios.map((s) => [s.id, s.status]));
  const now = statusOf(view);
  const was = statusOf(approvedView);
  const breaches = view.scenarios.filter((s) => now.get(s.id) === "bad" && was.get(s.id) !== "bad");
  const clears = view.scenarios.filter((s) => was.get(s.id) === "bad" && now.get(s.id) !== "bad");
  const names = (xs: ScenarioResult[]) => xs.map((s) => s.label).join(", ");

  return (
    <section aria-labelledby="bb-rail-title" className="flex flex-col border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 id="bb-rail-title" className="text-sm font-semibold text-neutral-900">
            Behavioural assumptions
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            Sliders recompute every figure on the page. Deltas are each slider&rsquo;s own contribution against its
            approved value, for <span className="font-medium text-neutral-800">{scenario.label}</span>.
          </p>
        </div>
        {dirty ? (
          <StatusChip status="warn" label={`Modified · ${offCount}`} />
        ) : (
          <span className="inline-flex items-center border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-neutral-600 uppercase">
            Approved set
          </span>
        )}
      </header>

      {breaches.length > 0 && (
        <div role="status" className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-[11px] leading-snug text-rose-800">
          <span className="mt-px"><AlertIcon color={STATUS.bad} /></span>
          <span>
            <span className="font-semibold">Would breach the 15% outlier test</span> under {names(breaches)}. The approved set
            stays inside.
          </span>
        </div>
      )}
      {clears.length > 0 && (
        <div role="status" className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] leading-snug text-amber-800">
          <span className="mt-px"><AlertIcon color={STATUS.warn} /></span>
          <span>
            <span className="font-semibold">Only these assumptions clear the outlier test</span> under {names(clears)}; the approved
            set breaches it.
          </span>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 border-b border-neutral-100 px-4 py-2">
        <div className="min-w-0">
          <MicroLabel>{scenario.label} · current</MicroLabel>
          <div className="mt-0.5 font-mono text-[11px] text-neutral-700 tabular-nums">
            ΔEVE <span className="font-semibold text-neutral-950">{pctSigned(scenario.dEvePct)}</span> · ΔNII{" "}
            <span className="font-semibold text-neutral-950">{gbpMSigned(scenario.dNii)}</span> / {view.months}m
          </div>
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {ASSUMPTION_META.map((m) => {
          const cur = value[m.key];
          const approved = APPROVED[m.key];
          const off = cur !== approved;
          const id = `bb-slider-${m.key}`;
          const d = deltas[m.key];
          const approvedPos = ((approved - m.min) / (m.max - m.min)) * 100;
          return (
            <div key={m.key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-[11px] font-medium text-neutral-800">
                  {m.label}
                </label>
                <span className={`font-mono text-sm font-semibold tabular-nums ${off ? "text-neutral-950" : "text-neutral-700"}`}>
                  {fmtValue(m.key, cur)}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between gap-3 text-[10px] text-neutral-500">
                <span className="truncate">{m.hint}</span>
                <span className="shrink-0 font-mono tabular-nums">approved {fmtValue(m.key, approved)}</span>
              </div>
              <div className="relative mt-1.5">
                <input
                  id={id}
                  type="range"
                  min={m.min}
                  max={m.max}
                  step={m.step}
                  value={cur}
                  onChange={(e) => onChange(m.key, Number(e.target.value))}
                  aria-valuetext={`${fmtValue(m.key, cur)}${off ? `, approved ${fmtValue(m.key, approved)}` : ", at approved value"}`}
                  aria-describedby={`${id}-delta`}
                  className={RANGE}
                />
                {/* approved value marker, behind the thumb and clear of the pointer */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 z-20 h-2.5 w-px -translate-y-1/2 bg-neutral-900"
                  style={{ left: `calc(${approvedPos}% + ${6 - approvedPos * 0.12}px)` }}
                />
              </div>
              <div id={`${id}-delta`} className="mt-1 flex justify-between gap-3 font-mono text-[10px] tabular-nums">
                <span className={m.affects.eve ? (off ? "text-neutral-800" : "text-neutral-400") : "text-neutral-400"}>
                  ΔEVE {m.affects.eve ? gbpMSigned(d.eve) : "no effect"}
                </span>
                <span className={m.affects.nii ? (off ? "text-neutral-800" : "text-neutral-400") : "text-neutral-400"}>
                  ΔNII {m.affects.nii ? gbpMSigned(d.nii) : "no effect"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-2.5">
        <span className="text-[10px] text-neutral-500">Approved by ALCO, 14 Jul 2026</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty}
          className={`border px-2.5 py-1 text-[11px] font-medium transition ${FOCUS} ${
            dirty
              ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
              : "cursor-not-allowed border-neutral-200 bg-white text-neutral-400"
          }`}
        >
          Reset to approved
        </button>
      </div>
    </section>
  );
}
