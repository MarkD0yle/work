/* Generated prose for the report: every sentence is computed from the same
 * filtered slice as the charts, so the words can never disagree with them. */

import {
  BUSINESS_GROUPS,
  LEAVES,
  headroomBn,
  type Bridge,
  type CompareMode,
  type LeafId,
  type RatioDef,
  type Snapshot,
} from "./model";
import { bn, fmtRatio, fmtUnits, headroomUnits, num, pct, signed, signedBn } from "./format";

type Driver = { name: string; bps: number };

function drivers(b: Bridge): Driver[] {
  const get = (k: string) => b.items.find((i) => i.key === k)?.bps ?? 0;
  const rwa = get("rwaCredit") + get("rwaMktOp");
  return [
    { name: "profits", bps: get("pat") },
    { name: "distributions", bps: get("div") + get("buyback") },
    { name: rwa <= 0 ? "RWA growth" : "lower RWAs", bps: rwa },
    { name: "FX", bps: get("fx") },
    { name: "deductions", bps: get("other") },
  ];
}

const list = (ds: Driver[]) =>
  ds
    .map((d) => `${d.name} (${signed(d.bps, 0, "bps")})`)
    .join(ds.length > 2 ? ", " : " and ");

/** "CET1 fell 41bps to 14.2% in the quarter, as RWA growth (−36bps) and …" */
export function bridgeSentence(b: Bridge, mode: CompareMode): string {
  const d = (b.closing - b.opening) * 100;
  const period = mode === "qoq" ? "in the quarter" : "over the year";
  const ds = drivers(b).filter((x) => Math.abs(x.bps) >= 2);
  const neg = ds.filter((x) => x.bps < 0).sort((a, z) => a.bps - z.bps).slice(0, 2);
  const pos = ds.filter((x) => x.bps > 0).sort((a, z) => z.bps - a.bps).slice(0, 1);
  const to = pct(b.closing, 2);
  if (Math.abs(d) < 0.5)
    return pos.length && neg.length
      ? `CET1 was unchanged at ${to} ${period}, as ${list(pos)} offset ${list(neg)}.`
      : `CET1 was unchanged at ${to} ${period}.`;
  if (d < 0) {
    const verb = `CET1 fell ${num(Math.abs(d), 0)}bps to ${to} ${period}`;
    return pos.length ? `${verb}, as ${list(neg)} outweighed ${list(pos)}.` : `${verb}, driven by ${list(neg)}.`;
  }
  const verb = `CET1 rose ${num(d, 0)}bps to ${to} ${period}`;
  return neg.length ? `${verb}, as ${list(pos)} more than offset ${list(neg)}.` : `${verb}, driven by ${list(pos)}.`;
}

const SHORT: Record<RatioDef["key"], string> = {
  cet1: "CET1",
  t1: "Tier 1",
  tc: "total capital",
  lev: "leverage",
  lcr: "LCR",
  nsfr: "NSFR",
};

export interface Message {
  tone: "good" | "warn" | "info";
  text: string;
}

const LEAF_NAME = (id: LeafId) => {
  const g = BUSINESS_GROUPS.find((x) => x.leaves.includes(id))!;
  const leaf = LEAVES.find((l) => l.id === id)!;
  return g.leaves.length > 1 ? `${g.label} ${leaf.label.toLowerCase()}` : leaf.label;
};

export function keyMessages({
  defs,
  cur,
  prev,
  bridge,
  mode,
  compareLabel,
}: {
  defs: RatioDef[];
  cur: Snapshot;
  prev: Snapshot | null;
  bridge: Bridge | null;
  mode: CompareMode;
  compareLabel: string;
}): Message[] {
  const out: Message[] = [];
  const cet1 = defs.find((d) => d.key === "cet1")!;
  const v = cur.ratio.cet1;
  const toTarget = (v - cet1.target) * 100;
  out.push({
    tone: toTarget >= 0 ? "good" : "warn",
    text:
      `CET1 of ${fmtRatio(cet1, v)} is ${fmtUnits(cet1, headroomUnits(cet1, v))} (${bn(headroomBn(cet1, cur))}) ` +
      `above the ${fmtRatio(cet1, cet1.requirement)} MDA threshold and ` +
      `${num(Math.abs(toTarget), 0)}bps ${toTarget >= 0 ? "above" : "below"} the ${fmtRatio(cet1, cet1.target)} management target.`,
  });

  out.push(
    bridge
      ? { tone: "info", text: bridgeSentence(bridge, mode) }
      : { tone: "info", text: `No movement analysis: ${compareLabel} precedes the reporting history, which starts in Q3 2024.` },
  );

  // Tightest capital-type constraint, in £bn of surplus.
  const capDefs = defs.filter((d) => d.group !== "liquidity");
  const tight = capDefs
    .map((d) => ({ d, bn: headroomBn(d, cur) }))
    .sort((a, z) => a.bn - z.bn)[0];
  out.push({
    tone: tight.bn < 0 ? "warn" : "info",
    text:
      `Tightest constraint is the ${SHORT[tight.d.key]} ratio: ` +
      `${fmtRatio(tight.d, cur.ratio[tight.d.key])} against ${fmtRatio(tight.d, tight.d.requirement)} ` +
      `(${tight.d.reqLabel === "MDA" ? "MDA" : tight.d.reqLabel.toLowerCase()}), ${bn(tight.bn)} of surplus.`,
  });

  const lcr = defs.find((d) => d.key === "lcr")!;
  const nsfr = defs.find((d) => d.key === "nsfr")!;
  const liqOk = cur.ratio.lcr >= lcr.target && cur.ratio.nsfr >= nsfr.target;
  out.push({
    tone: liqOk ? "good" : "warn",
    text:
      `LCR ${fmtRatio(lcr, cur.ratio.lcr)} and NSFR ${fmtRatio(nsfr, cur.ratio.nsfr)} ` +
      `${liqOk ? "sit above" : "are inside"} management targets of ${pct(lcr.target, 0)} and ${pct(nsfr.target, 0)}; ` +
      `HQLA surplus over outflows ${bn(headroomBn(lcr, cur), 0)}.`,
  });

  if (prev) {
    const dR = cur.rwa - prev.rwa;
    const movers = LEAVES.filter((l) => cur.present[l.id])
      .map((l) => ({ id: l.id, d: cur.leaves[l.id].total - prev.leaves[l.id].total }))
      .sort((a, z) => Math.abs(z.d) - Math.abs(a.d));
    const top = movers[0];
    out.push({
      tone: "info",
      text:
        `RWAs ${dR >= 0 ? "rose" : "fell"} ${bn(Math.abs(dR))} (${signed((dR / prev.rwa) * 100, 1, "%")}) to ${bn(cur.rwa)} ` +
        `against ${compareLabel}; the largest move was ${LEAF_NAME(top.id)} (${signedBn(top.d, 1)}).`,
    });
  }
  return out;
}
