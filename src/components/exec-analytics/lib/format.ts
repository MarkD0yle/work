import { EMPTY, FORMATS, MINUS, type FormatSpec } from "../config/formats";

/** The only number formatter. Never emits raw floats; uses a true minus. */
export function formatNumber(value: number | null | undefined, spec: FormatSpec = "bps"): string {
  if (value === null || value === undefined || Number.isNaN(value) || spec === "empty") return EMPTY;
  if (!Number.isFinite(value)) return EMPTY;
  const f = FORMATS[spec];
  const abs = Math.abs(value);
  let body: string;
  if (f.compact) {
    const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
    const u = units.find(([n]) => abs >= n);
    body = u ? `${(abs / u[0]).toFixed(f.decimals)}${u[1]}` : abs.toFixed(f.decimals);
  } else {
    body = abs.toLocaleString("en-US", {
      minimumFractionDigits: f.decimals,
      maximumFractionDigits: f.decimals,
      useGrouping: f.grouping ?? false,
    });
  }
  body += f.suffix ?? "";
  // A value that rounds to zero carries no sign.
  const isZero = Number(abs.toFixed(f.decimals)) === 0 && !f.compact;
  const sign = value < 0 && !isZero ? MINUS : f.signed && value > 0 && !isZero ? "+" : "";
  return sign + body;
}

/** Full-precision value for tooltips on compact/clipped numbers. */
export function formatFull(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  return (value < 0 ? MINUS : "") + Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `MMM DD, YYYY` from an ISO date or Date. */
export function formatDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return EMPTY;
  return `${MONTHS[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, "0")}, ${dt.getUTCFullYear()}`;
}
export function formatTime(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${String(dt.getUTCHours()).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
}
