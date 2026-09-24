import { useRef, useState, type KeyboardEvent } from "react";
import { DeltaText } from "./StatChrome";
import {
  deltaText,
  formatAvg,
  formatCount,
  sum1dp,
  toneFor,
  TONE_TEXT,
  type Driver,
  type DriverMetric,
  type Tone,
} from "../../lib/stats-trend";

/* Driver Stats — a KPI row where each tile opens the breakdown behind its
 * delta. The question it answers: the number moved, so what moved it?
 *
 * Each driver's change vs its own average is a diverging bar from a zero
 * line, sorted by size, and a Net row closes the list. The net is the sum
 * of the drivers, and it equals the headline delta, so the reader can see
 * the parts add up. That is why only additive counts belong here.
 *
 * Bar colour is status (good / bad for this metric), and direction also
 * carries the sign, so colour is never the only cue. */

const MARK: Record<Tone, string> = {
  ok: "#059669", // emerald-600
  warn: "#d97706", // amber-600
  neutral: "#737373", // neutral-500
};
const ZERO_RULE = "#d4d4d4"; // neutral-300

type Row = Driver & { delta: number };

function breakdown(m: DriverMetric) {
  const today = sum1dp(m.drivers.map((d) => d.today));
  const avg = sum1dp(m.drivers.map((d) => d.avg));
  const net = Math.round((today - avg) * 10) / 10;
  const rows: Row[] = m.drivers
    .map((d) => ({ ...d, delta: Math.round((d.today - d.avg) * 10) / 10 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  // Biggest mover in the same direction as the net — "mostly Custody".
  const top = rows.find((r) => Math.sign(r.delta) === Math.sign(net) && net !== 0);
  return { today, avg, net, rows, top };
}

/** Tone class for text: neutral stays in body ink, not the muted grey. */
function toneText(tone: Tone): string {
  return tone === "neutral" ? "" : TONE_TEXT[tone];
}

/** Sentence form drops a trailing .0 ("up 4", not "up 4.0"). */
function plain(n: number): string {
  return formatAvg(n).replace(/\.0$/, "");
}

function signed(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${formatAvg(Math.abs(n))}`;
}

export default function DriverStats({
  metrics,
  periodLabel,
}: {
  metrics: DriverMetric[];
  periodLabel: string;
}) {
  // Open on the first metric moving the wrong way — the one someone will
  // ask about — rather than whichever happens to be listed first.
  const [selectedId, setSelectedId] = useState(
    () =>
      (
        metrics.find((m) => {
          const { net } = breakdown(m);
          return toneFor(net, m.good) === "warn";
        }) ?? metrics[0]
      )?.id,
  );
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0];

  // Tablist keyboard model: ←/→ move and select, Home/End jump.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = metrics.length;
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setSelectedId(metrics[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Metric to break down"
        className="grid gap-px border-b border-neutral-100 bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4"
      >
        {metrics.map((m, i) => {
          const { today, avg, top } = breakdown(m);
          const active = m.id === selected.id;
          return (
            <button
              key={m.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`driver-tab-${m.id}`}
              aria-selected={active}
              aria-controls="driver-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setSelectedId(m.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`px-5 py-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 ${
                active ? "bg-white" : "bg-neutral-50 hover:bg-white"
              }`}
              style={active ? { boxShadow: "inset 0 2px 0 #171717" } : undefined}
            >
              <div className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                {m.label}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-neutral-900">
                  {formatCount(today)}
                </span>
                <span className="text-[11px] font-medium whitespace-nowrap">
                  <DeltaText
                    text={deltaText(today, avg, "count")}
                    tone={toneFor(today - avg, m.good)}
                  />
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {top ? (
                  <>
                    mostly <span className="text-neutral-700">{top.name}</span>
                  </>
                ) : (
                  <span className="text-neutral-400">level with avg</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <DriverPanel m={selected} periodLabel={periodLabel} />
    </>
  );
}

function DriverPanel({ m, periodLabel }: { m: DriverMetric; periodLabel: string }) {
  const { today, avg, net, rows, top } = breakdown(m);
  const scale = Math.max(Math.abs(net), ...rows.map((r) => Math.abs(r.delta))) || 1;
  const netTone = toneFor(net, m.good);

  return (
    <div
      role="tabpanel"
      id="driver-panel"
      aria-labelledby={`driver-tab-${m.id}`}
      className="px-5 pt-4 pb-3"
    >
      {/* Lead with the answer, then show the working. */}
      <p className="text-sm text-neutral-700">
        {net === 0 ? (
          <>
            {m.label} are level with the {periodLabel} daily average.
          </>
        ) : (
          <>
            {m.label} are{" "}
            <span className={`font-medium ${toneText(netTone)}`}>
              {net > 0 ? "up" : "down"} {plain(Math.abs(net))}
            </span>{" "}
            on the {periodLabel} daily average ({plain(avg)} →{" "}
            {formatCount(today)}).
            {top && (
              <>
                {" "}
                <span className="font-medium text-neutral-900">{top.name}</span>{" "}
                accounts for {signed(top.delta)} of it.
              </>
            )}
          </>
        )}
      </p>

      <div className="mt-4 flex items-center gap-4 pb-1.5 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
        <span className="w-36 shrink-0">By {m.dimension}</span>
        <span className="w-16 shrink-0 text-right">Today</span>
        <span className="w-16 shrink-0 text-right">{periodLabel} avg</span>
        <span className="flex min-w-0 flex-1 justify-between">
          <span>◀ Lower</span>
          <span>Higher ▶</span>
        </span>
        <span className="w-16 shrink-0 text-right">Change</span>
      </div>

      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {rows.map((r) => (
          <DriverRow
            key={r.name}
            name={r.name}
            today={r.today}
            avg={r.avg}
            delta={r.delta}
            scale={scale}
            tone={toneFor(r.delta, m.good)}
          />
        ))}
      </ul>
      <div className="border-t border-neutral-200">
        <DriverRow
          name="Net change"
          today={today}
          avg={avg}
          delta={net}
          scale={scale}
          tone={netTone}
          strong
        />
      </div>
    </div>
  );
}

function DriverRow({
  name,
  today,
  avg,
  delta,
  scale,
  tone,
  strong = false,
}: {
  name: string;
  today: number;
  avg: number;
  delta: number;
  scale: number;
  tone: Tone;
  strong?: boolean;
}) {
  const half = (Math.abs(delta) / scale) * 50;
  const Tag = strong ? "div" : "li";
  return (
    <Tag
      className={`flex items-center gap-4 py-2 text-sm hover:bg-neutral-50 ${
        strong ? "font-semibold text-neutral-900" : "text-neutral-700"
      }`}
    >
      <span className="w-36 shrink-0 truncate">{name}</span>
      <span className="w-16 shrink-0 text-right tabular-nums">{formatCount(today)}</span>
      <span className="w-16 shrink-0 text-right text-neutral-400 tabular-nums">
        {formatAvg(avg)}
      </span>
      <span className="relative h-5 min-w-0 flex-1" aria-hidden>
        <span
          className="absolute top-0 bottom-0"
          style={{ left: "50%", width: 1, background: ZERO_RULE }}
        />
        {delta !== 0 && (
          <span
            className="absolute"
            style={{
              top: 4,
              height: 12,
              left: delta > 0 ? "50%" : `${50 - half}%`,
              width: `${half}%`,
              background: MARK[tone],
            }}
          />
        )}
      </span>
      <span className={`w-16 shrink-0 text-right tabular-nums ${toneText(tone)}`}>
        {signed(delta)}
      </span>
    </Tag>
  );
}
