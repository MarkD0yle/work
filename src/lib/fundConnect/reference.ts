/* Source-of-truth reference data. Spec §7.
 *
 * A format check catches a malformed value. It does not catch a real,
 * valid, wrong one — CPT-4417 and CPT-4471 are both well-formed, both
 * exist, and only one of them is the counterparty you meant. So lookup
 * fields resolve against these masters and the resolved *name* is shown
 * back to the user, which is the only thing that makes the wrong-but-valid
 * case visible before submit.
 *
 * In production these are service calls. Here they are static maps with
 * the same shape, so swapping the transport doesn't touch the components.
 */

export type MasterId = "fund" | "counterparty" | "custodian" | "instrument";

export type MasterHit = {
  code: string;
  name: string;
  status: "active" | "suspended" | "closed";
  /** Extra facts the form can echo back, e.g. base currency, LEI. */
  detail?: string;
  /** Fund master only — dealing currency the fund is registered in. */
  ccy?: string;
  /** Fund master only — 90-day average ticket, used for the outlier check. */
  avgTicket?: number;
};

export const FUND_MASTER: MasterHit[] = [
  {
    code: "GB00FCAP01",
    name: "Meridian Global Equity Fund",
    status: "active",
    detail: "Ireland · UCITS",
    ccy: "GBP",
    avgTicket: 1_450_000,
  },
  {
    code: "GB00FCAP02",
    name: "Meridian Sterling Corporate Bond Fund",
    status: "active",
    detail: "Ireland · UCITS",
    ccy: "GBP",
    avgTicket: 2_100_000,
  },
  {
    code: "LU00FCAP07",
    name: "Meridian European Multi-Asset SICAV",
    status: "active",
    detail: "Luxembourg · SICAV",
    ccy: "EUR",
    avgTicket: 3_250_000,
  },
  {
    code: "LU00FCAP09",
    name: "Meridian EM Debt SICAV",
    status: "suspended",
    detail: "Luxembourg · dealing suspended 12 Aug",
    ccy: "USD",
    avgTicket: 900_000,
  },
];

export const COUNTERPARTY_MASTER: MasterHit[] = [
  {
    code: "CPT-4471",
    name: "Northwind Capital Partners LP",
    status: "active",
    detail: "LEI 549300NW1NDCAP4471X · Cayman",
  },
  {
    code: "CPT-4417",
    name: "Northwind Nominees (Jersey) Ltd",
    status: "active",
    detail: "LEI 549300NW1NDNOM4417Y · Jersey",
  },
  {
    code: "CPT-2210",
    name: "Aurora Trading Société SA",
    status: "suspended",
    detail: "LEI 969500AURORATRD2210 · credit review since 04 Aug",
  },
  {
    code: "CPT-3389",
    name: "Helix Logistics Holdings plc",
    status: "active",
    detail: "LEI 213800HELIXLOG3389A · United Kingdom",
  },
];

export const CUSTODIAN_MASTER: MasterHit[] = [
  { code: "CUST-NT", name: "Northern Trust (London)", status: "active", detail: "BIC CNORGB2L" },
  { code: "CUST-BNY", name: "BNY Mellon (Brussels)", status: "active", detail: "BIC IRVTBEBB" },
  { code: "CUST-SS", name: "State Street (Edinburgh)", status: "active", detail: "BIC SBOSGB2X" },
  { code: "CUST-CITI", name: "Citibank (Dublin)", status: "active", detail: "BIC CITIIE2X" },
];

export const INSTRUMENT_MASTER: MasterHit[] = [
  { code: "IE00B4L5Y983", name: "iShares Core MSCI World UCITS ETF", status: "active", detail: "Accumulating · IE" },
  { code: "GB00B03MLX29", name: "Shell plc ordinary", status: "active", detail: "Equity · GB" },
  { code: "LU0378818131", name: "Xtrackers Euro Stoxx 50 UCITS ETF", status: "active", detail: "Accumulating · LU" },
  { code: "IE00BK5BQT80", name: "Vanguard FTSE All-World UCITS ETF", status: "active", detail: "Accumulating · IE" },
];

const MASTERS: Record<MasterId, MasterHit[]> = {
  fund: FUND_MASTER,
  counterparty: COUNTERPARTY_MASTER,
  custodian: CUSTODIAN_MASTER,
  instrument: INSTRUMENT_MASTER,
};

export function masterEntries(master: MasterId): MasterHit[] {
  return MASTERS[master];
}

/** Resolve a code against a master. Returns null when nothing matches. */
export function lookupMaster(master: MasterId, code: string): MasterHit | null {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  return MASTERS[master].find((m) => m.code.toUpperCase() === key) ?? null;
}

/** Codes that look like the one given — used to warn about near-misses. */
export function nearMisses(master: MasterId, code: string): MasterHit[] {
  const key = code.trim().toUpperCase();
  if (key.length < 4) return [];
  const digits = key.replace(/\D/g, "");
  if (digits.length < 3) return [];
  const sorted = [...digits].sort().join("");
  return MASTERS[master].filter((m) => {
    if (m.code.toUpperCase() === key) return false;
    const other = m.code.replace(/\D/g, "");
    return other.length === digits.length && [...other].sort().join("") === sorted;
  });
}
