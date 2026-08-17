/* Tooltip HTML shared by the gallery charts.
 *
 * The global theme sets `useHTML: true`, so every chart formats its tooltip
 * the same way: a small caption, then label/value rows in tabular figures.
 * Written as strings rather than JSX because Highcharts wants markup, not
 * React elements. */

const MONO =
  "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums";

export type TipRow = { label: string; value: string; color?: string };

export function tipHtml(title: string, rows: TipRow[], caption?: string) {
  const head = `<div style="font-weight:600;font-size:11px;margin-bottom:3px">${title}</div>`;
  const cap = caption
    ? `<div style="color:#a3a3a3;font-size:10px;margin-bottom:3px">${caption}</div>`
    : "";
  const body = rows
    .map(
      (r) =>
        `<div style="display:flex;gap:10px;justify-content:space-between;font-size:11px;line-height:1.5">` +
        `<span style="color:#d4d4d4">${
          r.color
            ? `<span style="display:inline-block;width:7px;height:7px;background:${r.color};margin-right:5px"></span>`
            : ""
        }${r.label}</span>` +
        `<span style="${MONO}">${r.value}</span></div>`,
    )
    .join("");
  return `<div style="min-width:120px">${head}${cap}${body}</div>`;
}

/** €1,234m style money, with a sign when it carries meaning. */
export function money(v: number, unit = "m", dp = 1, signed = false) {
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}${unit}`;
}

/** €1.2m / -€0.4m — sign outside the symbol, the way a trader writes it. */
export function ccy(v: number, symbol: string, unit = "m", dp = 1, signed = false) {
  const sign = v < 0 ? "-" : signed ? "+" : "";
  return `${sign}${symbol}${Math.abs(v).toLocaleString("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}${unit}`;
}

/** Currency symbol for a book's base currency. */
export function symbolFor(base: string) {
  return base === "EUR" ? "€" : base === "GBP" ? "£" : "$";
}

export function pct(v: number, dp = 1, signed = false) {
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(dp)}%`;
}
