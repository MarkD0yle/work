import { COUNTERPARTIES, INSTRUMENTS, buildSpreadCells, type CurrencyGroup } from "../../data/mock";

export type MatrixRow = { id: string; name: string; vals: Record<string, number | null> };

export const GROUPS: CurrencyGroup[] = ["G10", "EM", "Restricted"];

/** Counterparty x instrument matrix; the Average row is the mean of non-null cells per column. */
export function buildMatrix(groups: CurrencyGroup[]): { rows: MatrixRow[]; average: MatrixRow; pairs: typeof INSTRUMENTS } {
  const pairs = INSTRUMENTS.filter((i) => groups.includes(i.group));
  const cells = buildSpreadCells();
  const byKey = new Map(cells.map((c) => [`${c.cpId}|${c.pair}`, c.bps]));
  const rows: MatrixRow[] = COUNTERPARTIES.map((cp) => ({
    id: cp.id,
    name: cp.name,
    vals: Object.fromEntries(pairs.map((p) => [p.pair, byKey.get(`${cp.id}|${p.pair}`) ?? null])),
  }));
  const avg: Record<string, number | null> = {};
  for (const p of pairs) {
    const xs = rows.map((r) => r.vals[p.pair]).filter((v): v is number => typeof v === "number");
    avg[p.pair] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }
  return { rows, average: { id: "avg", name: "Average", vals: avg }, pairs };
}
