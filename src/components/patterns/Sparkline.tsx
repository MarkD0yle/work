import { cx, tone as toneTokens, type Tone } from "./tokens";

/* Sparkline — trend shape only, no axes.
 *
 * Pure SVG with a viewBox, so it scales to its box without inline styles.
 * The last point is marked so the eye lands on "now". An optional band
 * (lo–hi) shades the usual range, which turns a squiggle into a judgement. */

export function Sparkline({
  values,
  tone = "neutral",
  band,
  label,
  className = "h-8 w-full",
}: {
  values: number[];
  tone?: Tone;
  band?: { lo: number; hi: number };
  /** Accessible summary, e.g. "Fails rate, last 30 days, rising". */
  label: string;
  className?: string;
}) {
  const W = 100;
  const H = 32;
  const pad = 3;
  if (values.length === 0) return null;
  const lo = Math.min(...values, band?.lo ?? Infinity);
  const hi = Math.max(...values, band?.hi ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cx("overflow-visible", className)}
    >
      {band && (
        <rect
          x={0}
          y={y(band.hi)}
          width={W}
          height={Math.max(0, y(band.lo) - y(band.hi))}
          className="fill-neutral-100"
        />
      )}
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={toneTokens[tone].stroke}
      />
      {/* Zero-length round-capped line: stays a true circle when the
          viewBox is stretched, where a <circle> would become an oval. */}
      <line
        x1={lastX}
        y1={lastY}
        x2={lastX}
        y2={lastY}
        strokeWidth={5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={toneTokens[tone].stroke}
      />
    </svg>
  );
}
