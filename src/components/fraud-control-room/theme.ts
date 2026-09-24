import type { Options } from "highcharts";
import Highcharts from "../../lib/highcharts";

/* Fraud Control Room: dark tokens, the shared dark Highcharts base and the
 * number formatters. This is the one dark page in the set, so colours are
 * spelled out here rather than borrowed from the light theme or the
 * `.screener-dark` remap. */

export const C = {
  page: "#0c0f14",
  header: "#0e1218",
  panel: "#11151c",
  raised: "#161b24",
  line: "#1f2630",
  line2: "#2a3340",
  t1: "#e5e7eb",
  t2: "#9ca3af",
  t3: "#6b7280",
  accent: "#22d3ee",
  good: "#10b981",
  warn: "#f59e0b",
  bad: "#f43f5e",
};

/** Dark categorical palette, validated on #0c0f14. Assign in order; scatter uses 0–1. */
export const CAT = ["#6366f1", "#0891b2", "#d97706", "#a855f7", "#0d9488"];
/** Dark sequential ramp: more = brighter, one hue. */
export const HEAT = ["#1e1b4b", "#3730a3", "#6366f1", "#a5b4fc", "#e0e7ff"];
/** Context series (the normal band). */
export const CONTEXT = "#6b7280";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* The dark layer every chart on the page merges over its own options: clear
 * background, hairline grid in the panel line colour, #9ca3af axis labels and
 * a raised tooltip that separates from the panel it floats over. */
export function darkBase(reduced: boolean): Options {
  const anim = reduced ? false : { duration: 280 };
  return {
    chart: {
      backgroundColor: "transparent",
      plotBackgroundColor: "transparent",
      animation: anim,
      spacing: [8, 6, 4, 2],
      style: { color: C.t1 },
    },
    xAxis: {
      lineColor: C.line2,
      tickColor: C.line2,
      gridLineColor: C.line,
      labels: { style: { color: C.t2, fontSize: "10px" } },
      title: { style: { color: C.t2, fontSize: "10px" } },
      crosshair: { color: "rgba(34,211,238,0.35)", width: 1 },
    },
    yAxis: {
      gridLineColor: C.line,
      lineColor: C.line2,
      labels: { style: { color: C.t2, fontSize: "10px", fontFamily: MONO } },
      title: { style: { color: C.t2, fontSize: "10px" } },
    },
    legend: {
      itemStyle: { color: C.t2, fontSize: "10px", fontWeight: "500" },
      itemHoverStyle: { color: C.t1 },
      itemHiddenStyle: { color: "#4b5563" },
      symbolRadius: 0,
    },
    tooltip: {
      backgroundColor: "#1b222d",
      borderColor: "#334155",
      borderWidth: 1,
      borderRadius: 0,
      shadow: false,
      style: { color: C.t1, fontSize: "11px" },
    },
    plotOptions: {
      series: {
        animation: anim,
        states: { inactive: { opacity: 1 } },
        dataLabels: { color: C.t1, style: { textOutline: "none" } },
      },
    },
  };
}

export function withDark(reduced: boolean, options: Options): Options {
  return Highcharts.merge(darkBase(reduced), options);
}

/* --- tooltip markup -------------------------------------------------------- */

export type TipRow = { label: string; value: string; swatch?: string; strong?: boolean };

/** Value-first tooltip rows in neutral ink; identity comes from the swatch. */
export function tip(title: string, rows: TipRow[], caption?: string) {
  const head = `<div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${C.t2};margin-bottom:4px">${title}</div>`;
  const body = rows
    .map(
      (r) =>
        `<div style="display:flex;align-items:baseline;gap:10px;justify-content:space-between;line-height:1.55">` +
        `<span style="color:${C.t2};font-size:11px">${
          r.swatch
            ? `<span style="display:inline-block;width:8px;height:8px;background:${r.swatch};margin-right:6px"></span>`
            : ""
        }${r.label}</span>` +
        `<span style="font-family:${MONO};font-variant-numeric:tabular-nums;color:${C.t1};font-size:${r.strong ? 12 : 11}px;font-weight:${r.strong ? 700 : 500}">${r.value}</span></div>`,
    )
    .join("");
  const cap = caption
    ? `<div style="margin-top:4px;color:${C.t2};font-size:10px">${caption}</div>`
    : "";
  return `<div style="min-width:150px">${head}${body}${cap}</div>`;
}

/* --- formatting -------------------------------------------------------------- */

const int = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (v: number) => int.format(Math.round(v));
export const fmt1 = (v: number) => dec1.format(v);
export const fmt2 = (v: number) => dec2.format(v);

/** £4.82bn · £412m · £38.2k · £640 */
export function gbp(v: number) {
  const a = Math.abs(v);
  if (a >= 1e9) return `£${(v / 1e9).toFixed(2)}bn`;
  if (a >= 1e6) return `£${(v / 1e6).toFixed(2)}m`;
  if (a >= 1e4) return `£${(v / 1e3).toFixed(1)}k`;
  return `£${int.format(Math.round(v))}`;
}

export const gbpExact = (v: number) => `£${dec2.format(v)}`;

const pad = (n: number) => String(n).padStart(2, "0");
const wrapDay = (sec: number) => ((Math.floor(sec) % 86400) + 86400) % 86400;
export function hhmmss(sec: number) {
  const s = wrapDay(sec);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
export function hhmm(sec: number) {
  const s = wrapDay(sec);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
}

export type Tone = "good" | "bad" | "neutral";
export const TONE_COLOR: Record<Tone, string> = { good: C.good, bad: C.bad, neutral: C.t2 };

/**
 * Signed delta with an arrow. Colour = direction × whether up is good;
 * `upIsGood: null` keeps it neutral (volume, blocked value).
 */
export function delta(
  cur: number,
  prev: number,
  mode: "pct" | "abs",
  upIsGood: boolean | null,
  unit = "",
  dp = 1,
): { text: string; tone: Tone } {
  const d = mode === "pct" ? (prev > 0 ? ((cur - prev) / prev) * 100 : 0) : cur - prev;
  const shown = Number(d.toFixed(dp));
  const arrow = shown > 0 ? "▲" : shown < 0 ? "▼" : "■";
  const sign = shown > 0 ? "+" : shown < 0 ? "−" : "±";
  const body = `${sign}${Math.abs(shown).toFixed(dp)}${mode === "pct" ? "%" : unit}`;
  const tone: Tone =
    upIsGood === null || shown === 0 ? "neutral" : (shown > 0) === upIsGood ? "good" : "bad";
  return { text: `${arrow} ${body}`, tone };
}
