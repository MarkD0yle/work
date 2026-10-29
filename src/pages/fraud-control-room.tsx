import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANCHOR_SEC,
  ATTACKS,
  BUCKET_SEC,
  CHANNELS,
  DAY_SEC,
  SCHEMES,
  WINDOWS,
  attackIntensity,
  bandIndex,
  breakdown,
  chargebacks,
  feedRows,
  histSum,
  makeSelection,
  normalBand,
  rulePerformance,
  totalOf,
  walk,
  type ChannelId,
  type SchemeId,
  type WindowId,
} from "../components/fraud-control-room/model";
import {
  C,
  TONE_COLOR,
  delta,
  fmt1,
  fmt2,
  fmtInt,
  gbp,
  hhmmss,
  type Tone,
} from "../components/fraud-control-room/theme";
import {
  DarkSegmented,
  FcrStyles,
  FlashText,
  MicroLabel,
} from "../components/fraud-control-room/ui";
import { FraudTrendPanel, HeatmapPanel, RulesPanel } from "../components/fraud-control-room/charts";
import { FlaggedFeed, type Decision } from "../components/fraud-control-room/FlaggedFeed";

export const title = "Fraud Control Room";
export const fullWidth = true;

/* Fraud Control Room: a dark wall display for a card issuer's fraud
 * operations lead. One question, "what's attacking us right now, and are our
 * rules catching it?", answered by five ticking counters, the fraud rate
 * against its 30-day normal band, an hour × merchant heatmap, a rule
 * precision scatter and a streaming queue of flagged transactions.
 *
 * Every number is a lookup into the seeded stream model at the current data
 * time, so pausing freezes the wall exactly and the filters recompute every
 * panel from the same channel × scheme slice. */

const KPI_H = 90;
const ROW_B_H = 250;
const ROW_C_H = 454;
const ANCHOR_TICK = Math.floor(ANCHOR_SEC / 2);

const CHANNEL_OPTIONS: { value: ChannelId | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...CHANNELS.map((c) => ({ value: c.id, label: c.label })),
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type Kpi = {
  label: string;
  scope: string;
  value: string;
  unit?: string;
  spoken: string;
  delta: { text: string; tone: Tone };
  vs: string;
  note?: { text: string; tone: Tone; glyph: string };
};

export default function FraudControlRoomPage() {
  const [reduced] = useState(prefersReducedMotion);
  const [live, setLive] = useState(() => !prefersReducedMotion());
  // `now` is the wall clock; `data` is the time the numbers are as of, and
  // stops advancing while the wall is paused.
  const [clock, setClock] = useState({ now: ANCHOR_SEC, data: ANCHOR_SEC });
  const [channel, setChannel] = useState<ChannelId | "all">("all");
  const [schemes, setSchemes] = useState<Record<SchemeId, boolean>>({ visa: true, mc: true, amex: true });
  const [win, setWin] = useState<WindowId>("1h");
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock((c) => ({ now: c.now + 1, data: live ? c.now + 1 : c.data }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const onDecide = useCallback((id: number, d: Decision | null) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (d) next[id] = d;
      else delete next[id];
      return next;
    });
  }, []);

  const winDef = WINDOWS.find((w) => w.id === win) ?? WINDOWS[1];
  const winIdx = WINDOWS.indexOf(winDef);
  // KPIs and charts tick every 2 s; the feed and the clock every second.
  const tick = Math.floor(clock.data / 2);
  const tickSec = tick * 2;

  const sel = useMemo(() => makeSelection(channel, schemes), [channel, schemes]);
  const empty = sel.cells.length === 0;
  const band = useMemo(() => normalBand(sel), [sel]);
  const bd = useMemo(() => breakdown(tickSec - winDef.sec, tickSec, sel), [tickSec, winDef.sec, sel]);
  const perf = useMemo(
    () => rulePerformance(bd, tickSec - winDef.sec, tickSec, sel, winIdx),
    [bd, tickSec, winDef.sec, sel, winIdx],
  );
  const liveAlerts = useMemo(
    () => perf.filter((r) => r.mode === "live").reduce((s, r) => s + r.alerts, 0),
    [perf],
  );
  const feed = useMemo(() => feedRows(clock.data, winDef.sec, sel, 14), [clock.data, winDef.sec, sel]);

  const kpis = useMemo<Kpi[] | null>(() => {
    if (empty) return null;
    const W = winDef.sec;
    const t = totalOf(bd);
    const lw = histSum(tickSec - W - 7 * DAY_SEC, tickSec - 7 * DAY_SEC, sel);
    const minutes = W / 60;
    const tpm = (t.n / minutes) * (1 + 0.012 * walk(tick, 1));
    const bps = (t.f / t.v) * 10000 * (1 + 0.025 * walk(tick, 2));
    const bpsLw = (lw.f / lw.v) * 10000;
    const decl = (t.d / t.n) * 100 * (1 + 0.015 * walk(tick, 3));
    const declLw = (lw.d / lw.n) * 100;
    const blocked = t.b * (1 + 0.006 * walk(tick, 4));
    const cb = chargebacks(tickSec, sel, ANCHOR_TICK, tick);

    // Is the window's fraud rate outside its same-time normal range?
    let lo = 0;
    let hi = 0;
    let k = 0;
    for (let s = tickSec - W; s < tickSec; s += BUCKET_SEC) {
      const bi = bandIndex(Math.floor(s / BUCKET_SEC));
      lo += band.lo[bi];
      hi += band.hi[bi];
      k += 1;
    }
    lo /= k;
    hi /= k;
    const note =
      bps > hi
        ? { text: "Above normal", tone: "bad" as Tone, glyph: "▲" }
        : bps < lo
          ? { text: "Below normal", tone: "neutral" as Tone, glyph: "▼" }
          : { text: "Within normal", tone: "good" as Tone, glyph: "■" };

    return [
      {
        label: "Transactions / min",
        scope: `${winDef.label} avg`,
        value: fmtInt(tpm),
        spoken: `${fmtInt(tpm)} transactions per minute`,
        delta: delta(tpm, lw.n / minutes, "pct", null),
        vs: "vs same time last wk",
      },
      {
        label: "Fraud rate · bps of sales",
        scope: winDef.label,
        value: fmt1(bps),
        unit: "bps",
        spoken: `${fmt1(bps)} basis points of sales value`,
        delta: delta(bps, bpsLw, "abs", false, " bps"),
        vs: "vs last wk",
        note,
      },
      {
        label: "Decline rate",
        scope: winDef.label,
        value: `${fmt2(decl)}%`,
        spoken: `${fmt2(decl)} percent declined`,
        delta: delta(decl, declLw, "abs", false, " pp", 2),
        vs: "vs same time last wk",
      },
      {
        label: "Value auto-blocked",
        scope: winDef.label,
        value: gbp(blocked),
        spoken: `${gbp(blocked)} auto-blocked by rules`,
        delta: delta(blocked, lw.b, "pct", null),
        vs: "vs same time last wk",
      },
      {
        label: "Chargebacks MTD",
        scope: "1–22 Sep",
        value: fmtInt(cb.count),
        unit: gbp(cb.value),
        spoken: `${fmtInt(cb.count)} fraud chargebacks month to date, ${gbp(cb.value)}`,
        delta: delta(cb.count, cb.prior, "pct", false),
        vs: "vs Aug, same day",
      },
    ];
  }, [empty, winDef, bd, tickSec, tick, sel, band]);

  const attacks = useMemo(() => {
    const a = attackIntensity(tickSec);
    return ATTACKS.filter((x) => a[x.id] > 0.05 && x.channels.some((c) => sel.ch[c]));
  }, [tickSec, sel]);

  const toggleScheme = (id: SchemeId) => setSchemes((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="fcr flex h-full flex-col">
      <FcrStyles />

      {/* Header strip: identity + clock on the first line, the filters that
          scope every panel on the second. pl-36 clears the app's Home pill. */}
      <header
        className="shrink-0 border-b py-1.5 pr-3 pl-36"
        style={{ background: C.header, borderColor: C.line }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[12px] font-semibold uppercase" style={{ color: C.t1, letterSpacing: "0.22em" }}>
            Fraud Control Room
          </h1>
          <span
            className="inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase"
            style={{
              borderColor: live ? "rgba(34,211,238,0.45)" : C.line2,
              color: live ? C.accent : C.t2,
            }}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 ${live ? "fcr-pulse" : ""}`}
              style={{ background: live ? C.accent : C.t3 }}
            />
            {live ? "Live" : "Paused"}
          </span>
          <p className="truncate text-[11px]" style={{ color: C.t2 }}>
            Card issuing · real-time fraud monitoring · what&apos;s attacking us right now, and are our rules catching it?
          </p>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <time
                className="font-mono text-[18px] leading-none font-semibold tabular-nums"
                style={{ color: C.t1 }}
                aria-label={`Time ${hhmmss(clock.now)} British Summer Time`}
              >
                {hhmmss(clock.now)}
              </time>
              <span className="text-[10px] tracking-wider uppercase" style={{ color: C.t2 }}>
                {live ? "Tue 22 Sep · BST" : `Data frozen at ${hhmmss(clock.data)}`}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={!live}
              onClick={() => setLive((v) => !v)}
              className="fcr-btn fcr-focus inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium"
              style={!live ? { color: C.t1, borderColor: C.accent } : undefined}
            >
              <span aria-hidden="true" className="font-mono text-[10px]">
                {live ? "❚❚" : "▶"}
              </span>
              {live ? "Pause live" : "Resume live"}
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2">
            <MicroLabel>Channel</MicroLabel>
            <DarkSegmented label="Channel" value={channel} options={CHANNEL_OPTIONS} onChange={setChannel} />
          </div>
          <div className="flex items-center gap-2">
            <MicroLabel>Scheme</MicroLabel>
            <div role="group" aria-label="Scheme" className="flex gap-1">
              {SCHEMES.map((s) => {
                const on = schemes[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleScheme(s.id)}
                    className="fcr-seg-btn fcr-focus inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium"
                    style={{ borderColor: on ? "rgba(34,211,238,0.45)" : C.line2 }}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 border"
                      style={{
                        borderColor: on ? C.accent : C.t3,
                        background: on ? C.accent : "transparent",
                      }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MicroLabel>Window</MicroLabel>
            <DarkSegmented
              label="Window"
              value={win}
              options={WINDOWS.map((w) => ({ value: w.id, label: w.label }))}
              onChange={setWin}
            />
          </div>

          {!empty && (
            <div className="ml-auto flex min-w-0 items-center gap-2 text-[11px]">
              <MicroLabel>Attacks</MicroLabel>
              {attacks.length ? (
                attacks.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 border px-1.5 py-0.5 whitespace-nowrap"
                    style={{ borderColor: "rgba(244,63,94,0.45)", color: C.t1 }}
                  >
                    <span aria-hidden="true" style={{ color: C.bad }}>
                      ▲
                    </span>
                    {a.label}
                    <span style={{ color: C.t2 }}>{a.detail}</span>
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5" style={{ color: C.t2 }}>
                  <span aria-hidden="true" style={{ color: C.good }}>
                    ■
                  </span>
                  None active in this slice
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="fcr-body fcr-scroll min-h-0 flex-1 overflow-y-auto p-2">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gridTemplateRows: `${KPI_H}px ${ROW_B_H}px ${ROW_C_H}px`,
          }}
        >
          {/* KPI counters */}
          <div
            className="grid gap-2"
            style={{ gridColumn: "span 12", gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            {kpis
              ? kpis.map((k) => <KpiCounter key={k.label} k={k} />)
              : Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="fcr-panel flex items-center justify-center text-[11px]" style={{ color: C.t2 }}>
                    No schemes selected
                  </div>
                ))}
          </div>

          <FraudTrendPanel
            style={{ gridColumn: "span 7" }}
            sel={sel}
            band={band}
            tickSec={tickSec}
            tick={tick}
            windowSec={winDef.sec}
            windowLabel={winDef.label}
            reduced={reduced}
            height={ROW_B_H - 38}
          />
          <HeatmapPanel
            style={{ gridColumn: "span 5" }}
            sel={sel}
            tickSec={tickSec}
            reduced={reduced}
            height={ROW_B_H - 38}
          />

          <FlaggedFeed
            style={{ gridColumn: "span 9" }}
            rows={feed.rows}
            dataSec={clock.data}
            animate={live && !reduced}
            decisions={decisions}
            onDecide={onDecide}
            alertsInWindow={liveAlerts}
            windowLabel={winDef.long}
            empty={empty}
          />
          <RulesPanel
            style={{ gridColumn: "span 3" }}
            perf={perf}
            sliceKey={`${sel.key}-${winDef.id}`}
            windowLabel={winDef.label}
            reduced={reduced}
            height={ROW_C_H - 38}
            empty={empty}
          />
        </div>

      </div>
    </div>
  );
}

function KpiCounter({ k }: { k: Kpi }) {
  return (
    <div className="fcr-panel flex min-w-0 flex-col justify-between px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <MicroLabel>{k.label}</MicroLabel>
        <span className="text-[10px] tracking-wider uppercase" style={{ color: C.t3 }}>
          {k.scope}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-[30px] leading-none font-semibold tracking-tight" style={{ color: C.t1 }}>
          <FlashText text={k.value} />
          <span className="sr-only">{k.spoken}</span>
        </span>
        {k.unit && (
          <span className="truncate text-[11px]" style={{ color: C.t2 }}>
            {k.unit}
          </span>
        )}
        {k.note && (
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
            style={{ borderColor: C.line2, color: C.t1 }}
          >
            <span aria-hidden="true" style={{ color: TONE_COLOR[k.note.tone] }}>
              {k.note.glyph}
            </span>
            {k.note.text}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 text-[11px]">
        <span className="font-mono font-semibold tabular-nums" style={{ color: TONE_COLOR[k.delta.tone] }}>
          {k.delta.text}
        </span>
        <span style={{ color: C.t2 }}>{k.vs}</span>
      </div>
    </div>
  );
}
