import { DeltaText } from "./StatChrome";
import {
  deltaText,
  formatCount,
  formatDuration,
  formatValue,
  isMet,
  statusOf,
  toneFor,
  type TargetMetric,
  type TargetStatus,
  type Tone,
} from "../../lib/stats-trend";

/* Target Stats — each metric sits on a track with its target, showing
 * where it was last period (hollow) and where it is now (filled). The
 * question it answers: are we on target, and are we heading toward it or
 * away from it?
 *
 * The track plots positions, not lengths, so it can zoom to the range
 * that matters (85–100% for an SLA) without the truncated-bar lie: 94.2%
 * vs a 95% target is a visible gap, not a hairline on a 0–100 bar.
 *
 * Two encodings, never crossed: the current marker's colour says where
 * you ARE (met / not met); the connector's colour says where you're
 * HEADING (improving / worsening). Status pairs both with an icon and a
 * word so nothing is colour-alone. */

const TRACK_H = 40;
const MID = TRACK_H / 2;
const INK = "#171717"; // neutral-900
const RULE = "#e5e5e5"; // neutral-200
const PRIOR = "#a3a3a3"; // neutral-400
const ZONE = "#d1fae5"; // emerald-100
const MET = "#059669"; // emerald-600
const UNMET = "#d97706"; // amber-600
const MOVE: Record<Tone, string> = { ok: MET, warn: UNMET, neutral: PRIOR };

const STATUS: Record<TargetStatus, { glyph: string; label: string; cls: string }> = {
  on: { glyph: "✓", label: "On target", cls: "text-emerald-700" },
  slipping: { glyph: "↘", label: "Slipping", cls: "text-amber-700" },
  recovering: { glyph: "↗", label: "Recovering", cls: "text-amber-700" },
  off: { glyph: "✕", label: "Off target", cls: "text-red-700" },
};

function gapText(m: TargetMetric): string {
  const d = Math.abs(m.current - m.target);
  const amount =
    m.unit === "pct"
      ? `${(d * 100).toFixed(1)}pt`
      : m.unit === "duration"
        ? formatDuration(d)
        : formatCount(d);
  if (d === 0) return "at target";
  const met = isMet(m);
  if (m.good === "up") return met ? `${amount} above` : `${amount} short`;
  return met ? `${amount} under` : `${amount} over`;
}

export default function TargetStats({ metrics }: { metrics: TargetMetric[] }) {
  return (
    <ul className="divide-y divide-neutral-100">
      {metrics.map((m) => (
        <TargetRow key={m.id} m={m} />
      ))}
    </ul>
  );
}

function TargetRow({ m }: { m: TargetMetric }) {
  const status = STATUS[statusOf(m)];
  const move = toneFor(m.current - m.prior, m.good);

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
      <div className="w-44 shrink-0">
        <div className="text-sm font-medium text-neutral-900">{m.label}</div>
        <div className="text-[11px] text-neutral-500">{m.instance}</div>
      </div>

      <div className="w-28 shrink-0">
        <div className="text-lg font-semibold text-neutral-900 tabular-nums">
          {formatValue(m.current, m.unit)}
        </div>
        <div className="text-[11px] whitespace-nowrap">
          <DeltaText text={deltaText(m.current, m.prior, m.unit)} tone={move} />
          <span className="text-neutral-400"> from {formatValue(m.prior, m.unit)}</span>
        </div>
      </div>

      <Track m={m} moveColor={MOVE[move]} />

      <div className="w-28 shrink-0">
        <div className={`text-sm font-medium ${status.cls}`}>
          <span aria-hidden>{status.glyph}</span> {status.label}
        </div>
        <div className="text-[11px] text-neutral-500">{gapText(m)}</div>
      </div>
    </li>
  );
}

function Track({ m, moveColor }: { m: TargetMetric; moveColor: string }) {
  const [d0, d1] = m.domain;
  const pos = (v: number) => Math.min(1, Math.max(0, (v - d0) / (d1 - d0))) * 100;
  const target = pos(m.target);
  const prior = pos(m.prior);
  const current = pos(m.current);
  // End labels give the scale, but yield to the target label when close.
  const showLo = target > 18;
  const showHi = target < 82;

  return (
    <div
      className="min-w-0 flex-1"
      style={{ minWidth: 220 }}
      role="img"
      aria-label={`${m.label}: ${formatValue(m.current, m.unit)} now, ${formatValue(
        m.prior,
        m.unit,
      )} prior, target ${formatValue(m.target, m.unit)}`}
    >
      <div className="relative" style={{ height: TRACK_H }}>
        {/* Target zone — the good side of the target. */}
        <div
          className="absolute"
          style={{
            top: MID - 8,
            height: 16,
            background: ZONE,
            ...(m.good === "up"
              ? { left: `${target}%`, right: 0 }
              : { left: 0, width: `${target}%` }),
          }}
        />
        <div
          className="absolute right-0 left-0"
          style={{ top: MID, height: 1, background: RULE }}
        />
        {/* Connector: prior → current, coloured by direction of travel. */}
        <div
          className="absolute"
          style={{
            top: MID - 1,
            height: 2,
            left: `${Math.min(prior, current)}%`,
            width: `${Math.abs(current - prior)}%`,
            background: moveColor,
          }}
        />
        <div
          className="absolute"
          style={{
            top: MID - 12,
            height: 24,
            width: 2,
            left: `${target}%`,
            background: INK,
            transform: "translateX(-50%)",
          }}
        />
        <Square left={prior} size={8} fill="#fff" border={PRIOR} />
        <Square left={current} size={10} fill={isMet(m) ? MET : UNMET} />
      </div>
      <div className="relative h-4 text-[10px] text-neutral-400 tabular-nums">
        {showLo && <span className="absolute left-0">{formatValue(d0, m.unit)}</span>}
        <span
          className="absolute whitespace-nowrap text-neutral-600"
          style={{ left: `${target}%`, transform: "translateX(-50%)" }}
        >
          target {formatValue(m.target, m.unit)}
        </span>
        {showHi && <span className="absolute right-0">{formatValue(d1, m.unit)}</span>}
      </div>
    </div>
  );
}

function Square({
  left,
  size,
  fill,
  border,
}: {
  left: number;
  size: number;
  fill: string;
  border?: string;
}) {
  return (
    <span
      aria-hidden
      className="absolute"
      style={{
        left: `${left}%`,
        top: MID,
        width: size,
        height: size,
        background: fill,
        border: border ? `2px solid ${border}` : undefined,
        boxShadow: "0 0 0 2px #fff",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

/** Legend for the track's four marks — shown once, under the list. */
export function TargetLegend({ periodLabel }: { periodLabel: string }) {
  const key = "inline-flex items-center gap-1.5";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
      <span className={key}>
        <span
          aria-hidden
          style={{ width: 8, height: 8, border: `2px solid ${PRIOR}`, background: "#fff" }}
        />
        Prior {periodLabel}
      </span>
      <span className={key}>
        <span aria-hidden style={{ width: 10, height: 10, background: MET }} />
        <span aria-hidden style={{ width: 10, height: 10, background: UNMET }} />
        This {periodLabel} · met / not met
      </span>
      <span className={key}>
        <span aria-hidden style={{ width: 14, height: 2, background: MET }} />
        <span aria-hidden style={{ width: 14, height: 2, background: UNMET }} />
        Improving / worsening
      </span>
      <span className={key}>
        <span aria-hidden style={{ width: 2, height: 12, background: INK }} />
        Target
      </span>
      <span className={key}>
        <span aria-hidden style={{ width: 14, height: 10, background: ZONE }} />
        Target zone
      </span>
    </div>
  );
}
