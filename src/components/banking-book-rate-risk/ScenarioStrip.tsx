import { LIMITS, type ScenarioId, type ScenarioResult, type Status } from "./model";
import { FOCUS, INK, STATUS, bp, gbpMSigned, pctSigned } from "./format";
import { MicroLabel, StatusChip } from "./ui";

/* Row 1: the six Basel shocks as selectable cards. The selected card
 * drives the main canvas, the rail deltas and the limits row. One card is
 * always selected; clicking it again leaves it selected. */

const EVE_LABEL: Record<Status, string> = { good: "Inside", warn: "Early warning", bad: "Outlier" };
const METER_MAX = 20;

/** The shock's shape across the curve, O/N to 30y. */
function ShockShape({ shape }: { shape: number[] }) {
  const n = shape.length;
  const y = (v: number) => 15 - (v / 280) * 13;
  const path = shape.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (n - 1)) * 100).toFixed(1)},${y(v).toFixed(2)}`).join("");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="block h-7 w-full" aria-hidden>
      <line x1={0} x2={100} y1={15} y2={15} stroke="#e5e5e5" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** ΔEVE loss on a 0–20% of Tier 1 track with the 10 / 12 / 15 marks. */
function EveMeter({ loss, status }: { loss: number; status: Status }) {
  const w = Math.min(100, (loss / METER_MAX) * 100);
  const marks = [LIMITS.early, LIMITS.internal, LIMITS.outlier];
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="block h-2 w-full" aria-hidden>
      <rect x={0} y={0} width={100} height={8} fill="#f5f5f5" />
      {w > 0 && <rect x={0} y={0} width={w} height={8} fill={STATUS[status]} />}
      {marks.map((m) => (
        <rect key={m} x={(m / METER_MAX) * 100 - 0.4} y={0} width={0.8} height={8} fill={m === LIMITS.outlier ? INK : "#a3a3a3"} />
      ))}
    </svg>
  );
}

export function ScenarioStrip({
  scenarios,
  approved,
  selected,
  onSelect,
  months,
  dirty,
}: {
  scenarios: ScenarioResult[];
  approved: ScenarioResult[];
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
  months: number;
  dirty: boolean;
}) {
  const approvedById = new Map(approved.map((s) => [s.id, s]));
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Basel standardised shocks">
      {scenarios.map((s) => {
        const on = s.id === selected;
        const loss = Math.max(0, -s.dEvePct);
        const ap = approvedById.get(s.id);
        const changed = dirty && ap && ap.status !== s.status;
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(s.id)}
              aria-label={`${s.label}: ΔEVE ${pctSigned(s.dEvePct)} of Tier 1, ${EVE_LABEL[s.status].toLowerCase()}; ΔNII ${gbpMSigned(s.dNii)} over ${months} months. ${on ? "Selected" : "Select to drive the charts"}`}
              className={`flex w-full flex-col border bg-white p-3 text-left transition ${FOCUS} ${
                on ? "border-neutral-900 shadow-[0_0_0_1px_#171717]" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-neutral-900">{s.label}</span>
                <StatusChip status={s.status} label={EVE_LABEL[s.status]} size="sm" />
              </span>
              <span className="mt-0.5 font-mono text-[10px] text-neutral-500 tabular-nums">
                {bp(s.bpOn)} O/N · {bp(s.bp5y)} 5y · {bp(s.bp20y)} 20y
              </span>
              <span className="mt-1.5 block w-full">
                <ShockShape shape={s.shape} />
              </span>

              <span className="mt-2 flex w-full items-baseline justify-between gap-2">
                <MicroLabel>ΔEVE</MicroLabel>
                <span className="text-xl leading-none font-semibold tracking-tight text-neutral-950">{pctSigned(s.dEvePct)}</span>
              </span>
              <span className="mt-0.5 flex w-full justify-between font-mono text-[10px] text-neutral-500 tabular-nums">
                <span>of Tier 1</span>
                <span>{gbpMSigned(s.dEve)}</span>
              </span>
              <span className="mt-1.5 block w-full">
                <EveMeter loss={loss} status={s.status} />
              </span>

              <span className="mt-2.5 flex w-full items-baseline justify-between gap-2">
                <MicroLabel>ΔNII {months}m</MicroLabel>
                <span className="font-mono text-sm font-semibold text-neutral-950 tabular-nums">{gbpMSigned(s.dNii)}</span>
              </span>
              <span className="mt-0.5 flex w-full justify-between font-mono text-[10px] text-neutral-500 tabular-nums">
                <span>of group NII</span>
                <span>{pctSigned(s.dNiiPct)}</span>
              </span>
              {dirty && ap && (
                <span className={`mt-1.5 block w-full border-t border-neutral-100 pt-1 font-mono text-[10px] tabular-nums ${changed ? "font-semibold text-neutral-900" : "text-neutral-400"}`}>
                  approved {pctSigned(ap.dEvePct)} · {gbpMSigned(ap.dNii)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
