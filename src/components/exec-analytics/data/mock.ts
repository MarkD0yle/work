/* Shared mock data. All names are generic. Seeded so every load is identical. */
import { AS_OF, addDays } from "../lib/dates";

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Approximately normal(0,1) from a uniform source. */
export const gauss = (r: () => number) => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 0.7071; };

export type Counterparty = { id: string; name: string };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const COUNTERPARTIES: Counterparty[] = Array.from({ length: 40 }, (_, i) => {
  const suffix = i < 26 ? LETTERS[i] : `${LETTERS[Math.floor(i / 26) - 1]}${LETTERS[i % 26]}`;
  return { id: `cp${i + 1}`, name: `Counterparty ${suffix}` };
});
// One very long name exercises truncation + tooltip.
COUNTERPARTIES[17] = { id: "cp18", name: "Counterparty R International Holdings and Trading Services Limited" };
export const cpName = (id: string) => COUNTERPARTIES.find((c) => c.id === id)?.name ?? id;
/** Index in COUNTERPARTIES: stable key for categorical colours across all panels. */
export const cpIndex = (id: string) => Math.max(0, COUNTERPARTIES.findIndex((c) => c.id === id));

export type CurrencyGroup = "G10" | "EM" | "Restricted";
export type Instrument = { pair: string; group: CurrencyGroup };
export const INSTRUMENTS: Instrument[] = [
  { pair: "EUR/USD", group: "G10" }, { pair: "GBP/USD", group: "G10" }, { pair: "USD/JPY", group: "G10" },
  { pair: "USD/CHF", group: "G10" }, { pair: "AUD/USD", group: "G10" }, { pair: "USD/CAD", group: "G10" },
  { pair: "USD/MXN", group: "EM" }, { pair: "USD/ZAR", group: "EM" }, { pair: "USD/PLN", group: "EM" },
  { pair: "USD/TRY", group: "EM" }, { pair: "USD/INR", group: "Restricted" }, { pair: "USD/BRL", group: "Restricted" },
];

export type SpreadCell = { cpId: string; pair: string; bps: number | null };
export function buildSpreadCells(): SpreadCell[] {
  const r = rng(42);
  const out: SpreadCell[] = [];
  COUNTERPARTIES.forEach((cp, ci) => {
    const quality = gauss(r) * 0.5;
    INSTRUMENTS.forEach((ins, ii) => {
      const base = ins.group === "G10" ? 0.6 : ins.group === "EM" ? 3.2 : 6.5;
      let bps: number | null = base * (0.5 + r()) + quality + gauss(r) * base * 0.3 - base * 0.4;
      const roll = r();
      if (roll < 0.12) bps = null; // no trades in this intersection
      else if (ci === 7 && ii === 9) bps = 412.6; // outliers
      else if (ci === 21 && ii === 10) bps = -398.4;
      else if (ci === 3 && ii === 7) bps = 405.15;
      return out.push({ cpId: cp.id, pair: ins.pair, bps: bps === null ? null : Math.round(bps * 1e6) / 1e6 });
    });
  });
  return out;
}

export type Trade = {
  id: string; pair: string; ccy: string; direction: "buy" | "sell"; notional: number; product: "Spot" | "Forward" | "Algo";
  tenor: string; start: string; end: string; tz: string; refValueBps: number; counterparties: string[]; algo?: string;
};
export const TRADES: Trade[] = [
  { id: "t1", pair: "EUR/USD", ccy: "EUR", direction: "buy", notional: 25_000_000, product: "Spot", tenor: "Spot", start: "11:00", end: "19:00", tz: "London", refValueBps: 0.42, counterparties: ["cp1", "cp2", "cp5", "cp9"], algo: "TWAP" },
  { id: "t2", pair: "EUR/USD", ccy: "EUR", direction: "buy", notional: 10_000_000, product: "Forward", tenor: "1M", start: "08:00", end: "16:00", tz: "London", refValueBps: 0.88, counterparties: ["cp3", "cp4"], algo: "Passive" },
  { id: "t3", pair: "USD/JPY", ccy: "USD", direction: "sell", notional: 50_000_000, product: "Algo", tenor: "Spot", start: "00:00", end: "08:00", tz: "Tokyo", refValueBps: 0.31, counterparties: ["cp1", "cp6", "cp7", "cp8", "cp12"], algo: "VWAP" },
  { id: "t4", pair: "GBP/USD", ccy: "GBP", direction: "sell", notional: 8_500_000, product: "Spot", tenor: "Spot", start: "13:00", end: "17:00", tz: "New York", refValueBps: 0.55, counterparties: ["cp2"], algo: "Aggressive" },
  { id: "t5", pair: "USD/MXN", ccy: "USD", direction: "buy", notional: 15_000_000, product: "Forward", tenor: "3M", start: "14:00", end: "21:00", tz: "New York", refValueBps: 3.4, counterparties: ["cp10", "cp11", "cp14"], algo: "TWAP" },
  { id: "t6", pair: "AUD/USD", ccy: "AUD", direction: "buy", notional: 12_000_000, product: "Spot", tenor: "Spot", start: "22:00", end: "06:00", tz: "Sydney", refValueBps: 0.62, counterparties: ["cp15", "cp16"], algo: "VWAP" },
  { id: "t7", pair: "USD/ZAR", ccy: "USD", direction: "sell", notional: 5_000_000, product: "Algo", tenor: "Spot", start: "08:00", end: "15:00", tz: "London", refValueBps: 4.9, counterparties: ["cp3", "cp5", "cp13", "cp14", "cp19", "cp20"], algo: "Passive" },
  { id: "t8", pair: "USD/CHF", ccy: "USD", direction: "buy", notional: 30_000_000, product: "Forward", tenor: "1W", start: "07:00", end: "17:00", tz: "Zurich", refValueBps: 0.74, counterparties: ["cp1", "cp4"], algo: "TWAP" },
];

export type ExceptionRule = {
  id: string; name: string; category: "FX" | "CR" | "MA"; conditions: { field: string; op: string; value: string }[];
  email: string; frequency: "Daily" | "Weekly" | "Monthly"; enabled: boolean; modifiedBy: string; modifiedAt: string;
};
export const EXCEPTION_RULES: ExceptionRule[] = [
  { id: "x1", name: "FX large total spread", category: "FX", conditions: [{ field: "Asset type", op: "=", value: "FX" }, { field: "Total spread", op: ">", value: "10 bps or < −0.5 bps" }, { field: "Notional", op: ">", value: "5.0M" }], email: "analyst@example.com", frequency: "Daily", enabled: true, modifiedBy: "analyst@example.com", modifiedAt: "2026-10-06T09:14:00Z" },
  { id: "x2", name: "FX forward points outlier", category: "FX", conditions: [{ field: "Product", op: "=", value: "Forward" }, { field: "Forward spread", op: ">", value: "6 bps" }], email: "fx-desk-exceptions-and-controls-team@example.com", frequency: "Weekly", enabled: true, modifiedBy: "Automated Import", modifiedAt: "2026-10-01T16:40:00Z" },
  { id: "x3", name: "FX algo underperformance", category: "FX", conditions: [{ field: "Algo style", op: "=", value: "TWAP" }], email: "analyst@example.com", frequency: "Monthly", enabled: false, modifiedBy: "analyst@example.com", modifiedAt: "2026-09-18T11:05:00Z" },
  { id: "x4", name: "Credit wide bid-offer", category: "CR", conditions: [{ field: "Asset type", op: "=", value: "Credit" }, { field: "Spread", op: ">", value: "25 bps" }], email: "analyst@example.com", frequency: "Daily", enabled: true, modifiedBy: "Automated Import", modifiedAt: "2026-10-07T07:30:00Z" },
  { id: "x5", name: "Margin call breach", category: "MA", conditions: [{ field: "Margin utilisation", op: ">", value: "90%" }], email: "analyst@example.com", frequency: "Daily", enabled: true, modifiedBy: "analyst@example.com", modifiedAt: "2026-08-28T13:22:00Z" },
];

export type RegReport = {
  id: string; name: string; type: "ART_27_5" | "ART_27_5_VS_RTS_28" | "RTS_28" | "TOTAL_CONSIDERATION"; ccy: string;
  conditions: string[]; groupBy: string[]; email: string; enabled: boolean; frequency?: string; hasHistory: boolean;
};
export const REG_REPORTS: RegReport[] = [
  { id: "r1", name: "Quarterly Article 27(5)", type: "ART_27_5", ccy: "USD", conditions: [], groupBy: ["Counterparty", "Asset class"], email: "analyst@example.com", enabled: true, frequency: "Quarterly", hasHistory: true },
  { id: "r2", name: "Article 27(5) vs RTS 28 — EUR", type: "ART_27_5_VS_RTS_28", ccy: "EUR", conditions: ["Asset type: FX", "Venue: OTC"], groupBy: ["Counterparty"], email: "analyst@example.com", enabled: true, frequency: "Monthly", hasHistory: true },
  { id: "r3", name: "RTS 28 top five venues", type: "RTS_28", ccy: "EUR", conditions: ["Asset type: FX"], groupBy: ["Venue", "Instrument", "Client type"], email: "analyst@example.com", enabled: false, hasHistory: false },
  { id: "r4", name: "Total consideration summary", type: "TOTAL_CONSIDERATION", ccy: "GBP", conditions: [], groupBy: [], email: "", enabled: false, hasHistory: false },
  { id: "r5", name: "", type: "RTS_28", ccy: "USD", conditions: ["Desk: Spot", "Region: EMEA", "Size: > 1M"], groupBy: ["Venue"], email: "analyst@example.com", enabled: true, frequency: "Weekly", hasHistory: true },
  { id: "r6", name: "RTS 28 top five venues (copy)", type: "RTS_28", ccy: "EUR", conditions: ["Asset type: FX"], groupBy: ["Venue", "Instrument", "Client type"], email: "analyst@example.com", enabled: false, hasHistory: false },
  { id: "r7", name: "Total consideration — APAC", type: "TOTAL_CONSIDERATION", ccy: "USD", conditions: ["Region: APAC"], groupBy: ["Counterparty"], email: "not-an-email", enabled: false, hasHistory: true },
];

export type ReportFile = { id: string; createdAt: string; createdBy: string; fileName: string; trades: number; notes?: string; source: "manual" | "automated" | "deleted" };
export function buildReportFiles(): ReportFile[] {
  const r = rng(7);
  return Array.from({ length: 1042 }, (_, i) => {
    const auto = r() < 0.55;
    const deleted = r() < 0.06;
    const day = Math.floor(i / 3.4);
    return {
      id: `f${i + 1}`,
      createdAt: `${addDays(AS_OF, -day)}T${String(6 + Math.floor(r() * 12)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00Z`,
      createdBy: auto ? "Automated Import" : "analyst@example.com",
      fileName: `${auto ? "auto" : "manual"}_trades_${String(i + 1).padStart(4, "0")}.csv`,
      trades: Math.round(40 + r() * 2400),
      notes: r() < 0.12 ? "Checked with desk" : undefined,
      source: deleted ? "deleted" : auto ? "automated" : "manual",
    } satisfies ReportFile;
  });
}
