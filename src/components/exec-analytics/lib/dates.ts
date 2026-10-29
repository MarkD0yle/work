/** Fixed "today" so mock data and presets agree. */
export const AS_OF = "2026-10-08";

export type RangePreset = "Today" | "This Week" | "Last Week" | "This Month" | "Last Month" | "Last Quarter" | "Last 3 Months" | "YTD" | "Custom";
export const PRESETS: RangePreset[] = ["Today", "This Week", "Last Week", "This Month", "Last Month", "Last Quarter", "Last 3 Months", "YTD", "Custom"];
export type DateRangeValue = { preset: RangePreset; start: string; end: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
export const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function rangeFor(preset: RangePreset, today = AS_OF): DateRangeValue {
  const t = new Date(`${today}T00:00:00Z`);
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -dow);
  switch (preset) {
    case "Today": return { preset, start: today, end: today };
    case "This Week": return { preset, start: monday, end: today };
    case "Last Week": return { preset, start: addDays(monday, -7), end: addDays(monday, -1) };
    case "This Month": return { preset, start: iso(utc(y, m, 1)), end: today };
    case "Last Month": return { preset, start: iso(utc(y, m - 1, 1)), end: iso(utc(y, m, 0)) };
    case "Last Quarter": { const q = Math.floor(m / 3); return { preset, start: iso(utc(y, (q - 1) * 3, 1)), end: iso(utc(y, q * 3, 0)) }; }
    case "Last 3 Months": return { preset, start: iso(utc(y, m - 3, t.getUTCDate())), end: today };
    case "YTD": return { preset, start: iso(utc(y, 0, 1)), end: today };
    default: return { preset: "Custom", start: addDays(today, -30), end: today };
  }
}
