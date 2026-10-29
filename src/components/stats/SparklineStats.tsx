import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { DeltaText } from "./StatChrome";
import {
  deltaText,
  formatDay,
  formatValue,
  toneFor,
  TONE_TEXT,
  type SeriesWindow,
  type Tone,
} from "../../lib/stats-trend";

/* Sparkline Stats — each tile pairs the headline with the period's daily
 * series, the period average, and a shaded "usual range" (10th–90th
 * percentile). The question it answers: is today normal for this metric,
 * or a break from the trend?
 *
 * The scrub is linked: pointing at a day on any sparkline moves every
 * tile to that day, so you read one date across all metrics. Keyboard
 * works the same way — each sparkline is a slider (←/→, Home/End, Esc
 * returns to today).
 *
 * Geometry: the SVG stretches to the tile (preserveAspectRatio="none",
 * non-scaling strokes); markers and the cursor are HTML overlays placed
 * by percentage so they stay square at any width. */

const SPARK_H = 44;
const INK = "#171717"; // neutral-900
const LINE = "#737373"; // neutral-500
const BAND = "#f5f5f5"; // neutral-100
const AVG_RULE = "#d4d4d4"; // neutral-300
const MARK: Record<Tone, string> = {
  ok: "#059669", // emerald-600
  warn: "#d97706", // amber-600
  neutral: INK,
};

export default function SparklineStats({ windows }: { windows: SeriesWindow[] }) {
  // One index for every tile — the linked crosshair. null = today.
  const [scrub, setScrub] = useState<number | null>(null);
  const last = (windows[0]?.dates.length ?? 1) - 1;
  // A period switch can shrink the window under an active scrub.
  const index = scrub === null ? null : Math.min(scrub, last);

  return (
    <div className="grid gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
      {windows.map((w) => (
        <SparkTile key={w.id} w={w} index={index} onScrub={setScrub} />
      ))}
    </div>
  );
}

function SparkTile({
  w,
  index,
  onScrub,
}: {
  w: SeriesWindow;
  index: number | null;
  onScrub: (i: number | null) => void;
}) {
  const last = w.values.length - 1;
  const at = index ?? last;
  const value = w.values[at];
  const scrubbing = index !== null && index !== last;

  const tone = toneFor(value - w.avg, w.good);
  const outside =
    value > w.usual[1] ? "above" : value < w.usual[0] ? "below" : null;
  const outsideTone: Tone = outside
    ? toneFor(outside === "above" ? 1 : -1, w.good)
    : "neutral";

  // y-domain covers the series and the band, padded so marks never clip.
  const lo = Math.min(...w.values, w.usual[0]);
  const hi = Math.max(...w.values, w.usual[1]);
  const pad = (hi - lo || 1) * 0.12;
  const y = (v: number) =>
    SPARK_H - ((v - (lo - pad)) / (hi - lo + pad * 2)) * SPARK_H;
  const x = (i: number) => (last === 0 ? 50 : (i / last) * 100);

  const line = w.values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const area = `${line} L100 ${SPARK_H} L0 ${SPARK_H} Z`;

  function indexFromPointer(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.round(f * last);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next: Record<string, number | null> = {
      ArrowLeft: Math.max(0, at - 1),
      ArrowRight: Math.min(last, at + 1),
      Home: 0,
      End: null,
      Escape: null,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    onScrub(next[e.key]);
  }

  return (
    <div className="flex flex-col bg-white px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
          {w.label}
        </span>
        <span
          className={`text-[11px] ${scrubbing ? "font-medium text-neutral-900" : "text-neutral-400"}`}
        >
          {scrubbing ? formatDay(w.dates[at]) : "Today"}
        </span>
      </div>

      {/* tabular-nums on purpose: the value changes under the scrub, and
          proportional digits would make the delta beside it jitter. */}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
          {formatValue(value, w.unit)}
        </span>
        <span className="text-[11px] font-medium whitespace-nowrap">
          <DeltaText text={deltaText(value, w.avg, w.unit)} tone={tone} />
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">
        {w.instance}
        <span className="text-neutral-400">
          {" · "}avg {formatValue(w.avg, w.unit)}
        </span>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`${w.label} by day`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={at}
        aria-valuetext={`${formatDay(w.dates[at])}: ${formatValue(value, w.unit)}`}
        onPointerMove={(e) => onScrub(indexFromPointer(e))}
        onPointerDown={(e) => onScrub(indexFromPointer(e))}
        onPointerLeave={() => onScrub(null)}
        onKeyDown={onKeyDown}
        onBlur={() => onScrub(null)}
        className="relative mt-3 cursor-crosshair focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
        style={{ height: SPARK_H, touchAction: "pan-y" }}
      >
        <svg
          viewBox={`0 0 100 ${SPARK_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <rect
            x={0}
            width={100}
            y={y(w.usual[1])}
            height={Math.max(0, y(w.usual[0]) - y(w.usual[1]))}
            fill={BAND}
          />
          <line
            x1={0}
            x2={100}
            y1={y(w.avg)}
            y2={y(w.avg)}
            stroke={AVG_RULE}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <path d={area} fill={INK} fillOpacity={0.04} />
          <path
            d={line}
            fill="none"
            stroke={LINE}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {scrubbing && (
          <div
            aria-hidden
            className="absolute top-0 bottom-0 bg-neutral-300"
            style={{ left: `${x(at)}%`, width: 1 }}
          />
        )}
        {/* Today's marker dims while another day is read, so only one
            marker is ever loud. */}
        <Marker
          left={x(last)}
          top={y(w.values[last])}
          color={scrubbing ? AVG_RULE : MARK[outsideTone]}
        />
        {scrubbing && <Marker left={x(at)} top={y(value)} color={INK} />}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
        <span className="whitespace-nowrap text-neutral-400">
          usual {formatValue(w.usual[0], w.unit)}–{formatValue(w.usual[1], w.unit)}
        </span>
        {outside && (
          <span
            className={`font-medium whitespace-nowrap ${
              outsideTone === "neutral" ? "text-neutral-700" : TONE_TEXT[outsideTone]
            }`}
          >
            {outside === "above" ? "▲ Above usual" : "▼ Below usual"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Square 8px marker with a 2px surface ring (zero-radius, like the rest). */
function Marker({ left, top, color }: { left: number; top: number; color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${left}%`,
        top,
        width: 8,
        height: 8,
        background: color,
        boxShadow: "0 0 0 2px #fff",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}
