import { tone as toneTokens, type Tone } from "./tokens";

/* ProgressBar — a share of a whole (utilisation, completion, fill rate).
 * BulletBar — a value against a target and limit (limits, budgets, SLAs).
 *
 * Both draw in SVG so widths come from attributes, not inline styles.
 * Values are clamped; the label carries the exact number so the bar never
 * has to be read precisely. */

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function ProgressBar({
  value,
  max = 1,
  tone = "neutral",
  label,
  showValue = false,
  format = (v, m) => `${Math.round((v / m) * 100)}%`,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  /** Accessible name, e.g. "Limit used". */
  label: string;
  showValue?: boolean;
  format?: (value: number, max: number) => string;
}) {
  const pct = clamp(max ? value / max : 0) * 100;
  return (
    <div className="flex items-center gap-2">
      <svg
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        className="h-1.5 min-w-12 flex-1"
      >
        <rect x={0} y={0} width={100} height={6} className="fill-neutral-100" />
        <rect x={0} y={0} width={pct} height={6} className={toneTokens[tone].fill} />
      </svg>
      {showValue && <span className="w-9 text-right text-[11px] text-neutral-600 tabular-nums">{format(value, max)}</span>}
    </div>
  );
}

export function BulletBar({
  value,
  target,
  limit,
  max,
  label,
}: {
  value: number;
  /** Soft line, e.g. warning threshold. */
  target?: number;
  /** Hard line. Crossing it turns the bar negative. */
  limit?: number;
  max: number;
  label: string;
}) {
  const x = (v: number) => clamp(v / max) * 100;
  const t: Tone = limit !== undefined && value >= limit ? "negative" : target !== undefined && value >= target ? "warning" : "neutral";
  return (
    <svg role="img" aria-label={label} viewBox="0 0 100 12" preserveAspectRatio="none" className="h-3 w-full">
      <rect x={0} y={0} width={100} height={12} className="fill-neutral-100" />
      {target !== undefined && <rect x={x(target)} y={0} width={100 - x(target)} height={12} className="fill-amber-50" />}
      {limit !== undefined && <rect x={x(limit)} y={0} width={100 - x(limit)} height={12} className="fill-red-50" />}
      <rect x={0} y={3} width={x(value)} height={6} className={toneTokens[t].fill} />
      {target !== undefined && <line x1={x(target)} x2={x(target)} y1={0} y2={12} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-amber-500" />}
      {limit !== undefined && <line x1={x(limit)} x2={x(limit)} y1={0} y2={12} strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="stroke-red-600" />}
    </svg>
  );
}
