import type { RegReport } from "../../data/mock";

export type Cfg = { period: string; includeCancelled: boolean };
export type Row = { draft: RegReport & { cfg: Cfg }; saved: (RegReport & { cfg: Cfg }) | null };
export type RegRow = Row["draft"];

export const TYPE_LABEL: Record<RegReport["type"], string> = {
  ART_27_5: "Article 27(5)", ART_27_5_VS_RTS_28: "Article 27(5) vs RTS 28", RTS_28: "RTS 28", TOTAL_CONSIDERATION: "Total consideration",
};
export const CCYS = ["USD", "EUR", "GBP", "JPY", "CHF"];
export const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly"];
export const GROUP_OPTIONS = ["Counterparty", "Asset class", "Venue", "Instrument", "Client type"];
export const PERIODS = ["Previous quarter", "Previous month", "Year to date"];
export const DEFAULT_CFG: Cfg = { period: "Previous quarter", includeCancelled: false };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type Errors = { email?: string; frequency?: string };
export function validate(r: RegRow): Errors {
  const e: Errors = {};
  if (r.email && !EMAIL.test(r.email)) e.email = "Enter a valid email address";
  else if (r.enabled && !r.email) e.email = "Required when enabled";
  if (r.enabled && !r.frequency) e.frequency = "Required when enabled";
  return e;
}
export const isDirty = (r: Row) => !r.saved || JSON.stringify(r.saved) !== JSON.stringify(r.draft);
export const configKey = (r: RegRow) => JSON.stringify([r.type, r.ccy, r.conditions, r.groupBy, r.cfg]);
