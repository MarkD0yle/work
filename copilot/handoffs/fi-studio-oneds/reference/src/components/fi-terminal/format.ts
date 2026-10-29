/* Number formatting for the FI terminal. Fixed decimals so columns align. */

export const px = (v: number, dp = 3) => v.toFixed(dp);
export const pct = (v: number, dp = 3) => `${v.toFixed(dp)}`;
export const bp = (v: number, dp = 1) => `${v.toFixed(dp)}`;
export const signed = (v: number, dp = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(dp)}`;

/** Face amounts in MM: 10_000_000 → "10MM", 2_500_000 → "2.5MM". */
export function mm(face: number) {
  const v = face / 1_000_000;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}MM`;
}

export function usd(v: number, dp = 0) {
  return v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function date(d: Date) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

export function clock(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}
