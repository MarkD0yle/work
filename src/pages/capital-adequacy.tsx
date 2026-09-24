import { useMemo, useRef, useState } from "react";
import {
  ENTITIES,
  LATEST_Q,
  QUARTERS,
  cet1Bridge,
  compareIndex,
  compareLabel as compareLabelOf,
  headroomBn,
  ratioDefs,
  snapshot,
  type Basis,
  type CompareMode,
  type EntityId,
} from "../components/capital-adequacy/model";
import { bn, fmtRatio, fmtUnits, headroomUnits, num, pct, signed, signedBn } from "../components/capital-adequacy/format";
import { bridgeSentence, keyMessages, type Message } from "../components/capital-adequacy/narrative";
import { RatioBullets, RequirementTable, type Group, type Scale } from "../components/capital-adequacy/RatioBullets";
import { BridgeFigure, RwaStackFigure, TrendFigure } from "../components/capital-adequacy/charts";
import { RwaTable } from "../components/capital-adequacy/RwaTable";
import {
  EmptyState,
  FOCUS,
  Figure,
  Footnotes,
  Section,
  Segmented,
  SelectField,
} from "../components/capital-adequacy/ui";

export const title = "Capital Adequacy";
export const fullWidth = true;

/* Capital Adequacy: a regulatory report laid out as a board pack.
 *
 * The question is the ALCO one: how much headroom do we have over our
 * regulatory minimums, and what moved it? The page reads top to bottom like
 * a paper: key messages, then four numbered sections, each with its own
 * footnotes. A sticky contents list in the left gutter tracks the section in
 * view. One sticky toolbar scopes everything; every figure, table and
 * sentence is derived from the same entity x basis x date x comparison
 * slice (see components/capital-adequacy/model.ts). */

const SECTIONS = [
  { id: "ca-summary", n: null, label: "Key messages" },
  { id: "ca-ratios", n: 1, label: "Capital ratios" },
  { id: "ca-cet1", n: 2, label: "CET1 movement" },
  { id: "ca-rwa", n: 3, label: "Risk-weighted assets" },
  { id: "ca-levliq", n: 4, label: "Leverage & liquidity" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const TOOLBAR_H = 57;

const BASIS_LABEL: Record<Basis, string> = { transitional: "Transitional", fully: "Fully loaded" };

function niceMax(v: number, step: number) {
  return Math.ceil((v * 1.05) / step) * step;
}

export default function CapitalAdequacyPage() {
  const [entity, setEntity] = useState<EntityId>("grp");
  const [basis, setBasis] = useState<Basis>("transitional");
  const [reportQ, setReportQ] = useState<number>(LATEST_Q);
  const [mode, setMode] = useState<CompareMode>("qoq");
  const [active, setActive] = useState<SectionId>("ca-summary");
  const scrollRef = useRef<HTMLDivElement>(null);

  const ent = ENTITIES.find((e) => e.id === entity)!;
  const compareQ = compareIndex(reportQ, mode);
  const reportLabel = QUARTERS[reportQ].label;
  const cmpLabel = compareLabelOf(reportQ, mode);
  const compareMissing = `no ${cmpLabel} data`;

  const slice = useMemo(() => {
    const defs = ratioDefs(entity);
    const cur = snapshot(entity, basis, reportQ);
    const prev = compareQ === null ? null : snapshot(entity, basis, compareQ);
    const history = QUARTERS.slice(0, reportQ + 1).map((_, q) => snapshot(entity, basis, q));
    const bridge = compareQ === null ? null : cet1Bridge(entity, basis, compareQ, reportQ);
    // Bullet scales are fixed per entity (over every quarter, transitional is
    // the larger basis), so moving the date moves the marker, not the axis.
    const all = QUARTERS.map((_, q) => snapshot(entity, "transitional", q));
    const byKey = (k: (typeof defs)[number]["key"]) => defs.find((d) => d.key === k)!;
    const scales: Record<Group, Scale> = {
      capital: { max: niceMax(Math.max(...all.map((s) => s.ratio.tc), byKey("tc").target), 2), step: 2 },
      leverage: { max: niceMax(Math.max(...all.map((s) => s.ratio.lev), byKey("lev").target), 1), step: 1 },
      liquidity: {
        max: niceMax(Math.max(...all.map((s) => Math.max(s.ratio.lcr, s.ratio.nsfr)), byKey("lcr").target), 25),
        step: 25,
      },
    };
    return { defs, cur, prev, history, bridge, scales };
  }, [entity, basis, reportQ, compareQ]);

  const { defs, cur, prev, history, bridge, scales } = slice;
  const def = (k: (typeof defs)[number]["key"]) => defs.find((d) => d.key === k)!;

  const messages = useMemo(
    () => keyMessages({ defs, cur, prev, bridge, mode, compareLabel: cmpLabel }),
    [defs, cur, prev, bridge, mode, cmpLabel],
  );

  const levExtra = useMemo(() => {
    const lev = defs.find((d) => d.key === "lev")!;
    return lev.stack.length > 1 ? [{ value: lev.requirement, label: "Min + buffers" }] : [];
  }, [defs]);

  /* --- scrollspy --------------------------------------------------------- */
  const onScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    const line = root.getBoundingClientRect().top + TOOLBAR_H + 120;
    let current: SectionId = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el && el.getBoundingClientRect().top <= line) current = s.id;
    }
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1].id;
    setActive(current);
  };
  const jump = (id: SectionId) => {
    const root = scrollRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - TOOLBAR_H - 12;
    root.scrollTo({ top, behavior: "smooth" });
    setActive(id);
  };

  const rwaDelta = prev ? cur.rwa - prev.rwa : null;
  const creditShare = ((cur.rwaByRisk.credit + cur.rwaByRisk.ccr + cur.rwaByRisk.cva) / cur.rwa) * 100;
  const lev = def("lev");
  const lcr = def("lcr");
  const nsfr = def("nsfr");

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto bg-neutral-100">
      {/* pl-36 clears the app's fixed "Home" pill in the top-left corner. */}
      <header className="border-b border-neutral-200 bg-white py-5 pr-6 pl-36">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Group Treasury · Capital management · {ent.legal}
            </div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">Capital Adequacy</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
              How much headroom do we have over our regulatory minimums, and what moved it? Capital and liquidity
              ratios against the PRA requirement stack, prepared for ALCO.
            </p>
          </div>
          <dl className="flex shrink-0 gap-px border border-neutral-200 bg-neutral-200 text-xs">
            {[
              ["Paper", "ALCO · item 4"],
              ["Meeting", "29 Sep 2026"],
              ["Classification", "Restricted"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-1.5">
                <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{k}</dt>
                <dd className="mt-0.5 font-medium text-neutral-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* The one filter toolbar: sticky, scopes the whole report. */}
      <div
        className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 py-2.5 pr-6 pl-36 backdrop-blur"
        style={{ minHeight: TOOLBAR_H }}
        role="toolbar"
        aria-label="Report filters"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SelectField<EntityId>
            id="ca-entity"
            label="Legal entity"
            value={entity}
            width={180}
            onChange={setEntity}
            options={ENTITIES.map((e) => ({ value: e.id, label: e.label }))}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Basis</span>
            <Segmented<Basis>
              label="Capital basis"
              value={basis}
              onChange={setBasis}
              options={[
                { value: "transitional", label: "Transitional" },
                { value: "fully", label: "Fully loaded" },
              ]}
            />
          </div>
          <SelectField<number>
            id="ca-date"
            label="Reporting date"
            value={reportQ}
            width={112}
            onChange={setReportQ}
            options={QUARTERS.map((q, i) => ({ value: i, label: q.label })).reverse()}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Compare to</span>
            <Segmented<CompareMode>
              label="Comparison period"
              value={mode}
              onChange={setMode}
              options={[
                { value: "qoq", label: "Prior quarter" },
                { value: "yoy", label: "Prior year" },
              ]}
            />
          </div>
          <div className="ml-auto hidden text-[11px] text-neutral-500 min-[1400px]:block" aria-live="polite">
            As at <span className="font-medium text-neutral-800">{QUARTERS[reportQ].date}</span>
            {compareQ === null ? (
              <span className="text-amber-700">
                {" "}
                · <span aria-hidden>▲ </span>no {cmpLabel} data
              </span>
            ) : (
              <> · vs {cmpLabel}</>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] justify-center gap-8 px-6 py-8">
        {/* Contents gutter with scrollspy */}
        <nav aria-label="Contents" className="hidden w-48 shrink-0 xl:block">
          <div className="sticky" style={{ top: TOOLBAR_H + 24 }}>
            <div className="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Contents</div>
            <ol className="flex flex-col border-l border-neutral-300">
              {SECTIONS.map((s) => {
                const on = s.id === active;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => jump(s.id)}
                      aria-current={on ? "location" : undefined}
                      className={`-ml-px flex w-full items-baseline gap-2 border-l-2 py-1.5 pr-2 pl-3 text-left text-[13px] transition ${FOCUS} ${
                        on
                          ? "border-blue-900 font-semibold text-blue-900"
                          : "border-transparent text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
                      }`}
                    >
                      <span className="w-3 shrink-0 font-mono text-[11px] tabular-nums">{s.n ?? "·"}</span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 border-t border-neutral-300 pt-3 text-[11px] leading-relaxed text-neutral-500">
              <div className="font-medium text-neutral-700">{ent.label}</div>
              <div>
                {BASIS_LABEL[basis]} · {QUARTERS[reportQ].date}
              </div>
              <div>{compareQ === null ? "No comparison" : `vs ${cmpLabel}`}</div>
            </div>
          </div>
        </nav>

        <article className="min-w-0 max-w-[1120px] flex-1 border border-neutral-200 bg-white px-10 pt-10 pb-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Title block */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <div className="text-[10px] font-semibold tracking-widest text-blue-900 uppercase">
              Capital and liquidity position
            </div>
            <div className="font-mono text-[10px] text-neutral-400">
              {ent.legal} · {BASIS_LABEL[basis].toLowerCase()} · £bn
            </div>
          </div>
          <h2 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight text-neutral-950">
            {ent.label}, {reportLabel}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            As at {QUARTERS[reportQ].date}
            {compareQ !== null ? `, compared with ${QUARTERS[compareQ].date}` : ""}. Figures are unaudited management
            information.
          </p>

          <section id="ca-summary" aria-labelledby="ca-summary-h" className="mt-8 mb-10">
            <h3 id="ca-summary-h" className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
              Key messages
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5 border-l-2 border-blue-900 pl-5">
              {messages.map((m, i) => (
                <MessageItem key={i} m={m} />
              ))}
            </ul>
          </section>

          {/* 1 ------------------------------------------------------------ */}
          <Section
            id="ca-ratios"
            n={1}
            title="Capital ratios"
            lead={
              <>
                Six ratios against their full requirement stacks at {QUARTERS[reportQ].date}, on a{" "}
                {BASIS_LABEL[basis].toLowerCase()} basis<sup>1</sup>. Each bar builds the requirement up to the MDA
                threshold<sup>2</sup>; the navy wash between it and the marker is the headroom.
              </>
            }
          >
            <RatioBullets
              defs={defs}
              current={cur}
              compare={prev}
              compareLabel={cmpLabel}
              compareMissing={compareMissing}
              scales={scales}
            />
            <details className="group mt-6 border border-neutral-200">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 ${FOCUS}`}
              >
                <span>
                  <span className="mr-2 font-mono text-[10px] font-semibold tracking-widest text-blue-900 uppercase">
                    Table 1.1
                  </span>
                  Requirement build-up and headroom, by ratio
                </span>
                <span className="text-[11px] text-neutral-500 group-open:hidden">Show</span>
                <span className="hidden text-[11px] text-neutral-500 group-open:inline">Hide</span>
              </summary>
              <div className="border-t border-neutral-200 px-2 py-2">
                <RequirementTable defs={defs} current={cur} />
              </div>
            </details>
            <Footnotes
              items={[
                {
                  mark: "1",
                  text: (
                    <>
                      Fully loaded excludes IFRS 9 transitional relief ({bn(cur.relief, 2)} of CET1 at{" "}
                      {QUARTERS[reportQ].date}, running off). Transitional includes it in CET1, Tier 1 and total capital.
                    </>
                  ),
                },
                {
                  mark: "2",
                  text: "MDA threshold = Pillar 1 + Pillar 2A + combined buffer (conservation, countercyclical and O-SII). Pillar 2A is met at least 56.25% with CET1 and 75% with Tier 1.",
                },
                {
                  mark: "3",
                  text: `Countercyclical rate is exposure-weighted (UK rate 2%). ${
                    entity === "eu"
                      ? "EU subsidiary: leverage minimum 3.0% under CRR, Pillar 2 requirement set by the ECB."
                      : "Leverage requirement is 3.25% plus buffers at 35% of the CCyB and O-SII rates; central bank claims are excluded."
                  }`,
                },
                { mark: "4", text: "LCR and NSFR are spot at the reporting date; Pillar 3 disclosures use 12-month averages." },
              ]}
            />
          </Section>

          {/* 2 ------------------------------------------------------------ */}
          <Section
            id="ca-cet1"
            n={2}
            title="CET1 movement"
            lead={
              bridge ? (
                <p className="text-base leading-relaxed font-medium text-neutral-900">{bridgeSentence(bridge, mode)}</p>
              ) : undefined
            }
          >
            {bridge ? (
              <>
                <BridgeFigure
                  bridge={bridge}
                  figLabel="Figure 2.1"
                  basisLabel={BASIS_LABEL[basis]}
                  sliceKey={`${entity}-${basis}-${bridge.from}-${bridge.to}`}
                />
                <dl className="mt-4 grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
                  {[
                    ["CET1 capital", `${bn(bridge.c0, 2)} → ${bn(bridge.c1, 2)}`, signedBn(bridge.c1 - bridge.c0, 2)],
                    ["RWAs", `${bn(bridge.r0)} → ${bn(bridge.r1)}`, signedBn(bridge.r1 - bridge.r0, 1)],
                    [
                      "Distributions",
                      bn(
                        -bridge.items
                          .filter((i) => i.key === "div" || i.key === "buyback")
                          .reduce((a, i) => a + i.capital, 0),
                        2,
                      ),
                      "dividend accrual + buyback",
                    ],
                    [
                      "Capital generation",
                      `${num(bridge.items.find((i) => i.key === "pat")!.bps, 0)}bps`,
                      "profit after tax, gross",
                    ],
                  ].map(([k, v, s]) => (
                    <div key={k} className="bg-white px-3 py-2">
                      <dt className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">{k}</dt>
                      <dd className="mt-0.5 font-mono text-sm text-neutral-900 tabular-nums">{v}</dd>
                      <dd className="text-[11px] text-neutral-500">{s}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <EmptyState title={`No comparison period: ${cmpLabel} precedes the reporting history`}>
                <p>
                  History starts at Q3 2024, so a bridge from {cmpLabel} to {reportLabel} can’t be built.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mode === "yoy" && reportQ >= 1 && (
                    <button
                      type="button"
                      onClick={() => setMode("qoq")}
                      className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:bg-neutral-100 ${FOCUS}`}
                    >
                      Compare to prior quarter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReportQ(LATEST_Q)}
                    className={`border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-800 hover:bg-neutral-100 ${FOCUS}`}
                  >
                    Jump to {QUARTERS[LATEST_Q].label}
                  </button>
                </div>
              </EmptyState>
            )}
            <Footnotes
              items={[
                {
                  mark: "1",
                  text: "Capital movements are divided by closing RWAs; the RWA effect is opening CET1 × (1/closing − 1/opening RWAs), apportioned by driver, so the bars sum exactly to the change.",
                },
                {
                  mark: "2",
                  text: "FX combines translation of foreign-currency CET1 with retranslation of foreign-currency RWAs. RWA growth (credit) includes counterparty credit and CVA.",
                },
                {
                  mark: "3",
                  text:
                    entity === "grp"
                      ? "Share buyback is deducted when announced, at the half-year and full-year results."
                      : "For subsidiaries, share buyback reflects distributions to the holding company that fund the group programme.",
                },
                ...(basis === "transitional"
                  ? [{ mark: "4", text: "On the transitional basis, run-off of IFRS 9 relief sits within intangibles & other deductions." }]
                  : []),
              ]}
            />
          </Section>

          {/* 3 ------------------------------------------------------------ */}
          <Section
            id="ca-rwa"
            n={3}
            title="Risk-weighted assets"
            lead={
              <>
                {rwaDelta === null
                  ? `RWAs of ${bn(cur.rwa)} at ${QUARTERS[reportQ].date}. `
                  : `RWAs ${rwaDelta >= 0 ? "rose" : "fell"} ${bn(Math.abs(rwaDelta))} (${pct(
                      (Math.abs(rwaDelta) / prev!.rwa) * 100,
                      1,
                    )}) to ${bn(cur.rwa)} against ${cmpLabel}. `}
                Credit-type risk (credit, counterparty and CVA) is {pct(creditShare, 0)} of the total; density across the
                book is {pct((cur.rwa / cur.exposure) * 100, 1)}<sup>1</sup>.
              </>
            }
          >
            <RwaStackFigure history={history} reportQ={reportQ} compareQ={compareQ} figLabel="Figure 3.1" />
            <div className="mt-10">
              <Figure
                label="Table 3.2"
                title="RWAs by business line and risk type"
                meta={`${reportLabel} · expand a business to see its lines · subtotals on group rows`}
              >
                <RwaTable current={cur} compare={prev} compareLabel={cmpLabel} chartTotal={cur.rwa} />
              </Figure>
            </div>
            <Footnotes
              items={[
                { mark: "1", text: "Density = total RWAs ÷ exposure at default. Mortgages carry the lowest density; unsecured cards and SME the highest." },
                { mark: "2", text: "Operational risk RWAs are recalibrated each Q1 on three-year average income, which is why they step once a year." },
                { mark: "3", text: "Colours in Figure 3.1 identify risk types only; the table carries every value shown in the chart." },
              ]}
            />
          </Section>

          {/* 4 ------------------------------------------------------------ */}
          <Section
            id="ca-levliq"
            n={4}
            title="Leverage & liquidity"
            lead={
              <>
                Leverage of {fmtRatio(lev, cur.ratio.lev)} is {fmtUnits(lev, headroomUnits(lev, cur.ratio.lev))} above
                its {fmtRatio(lev, lev.requirement)} requirement{lev.stack.length > 1 ? " including buffers" : ""} (
                {bn(headroomBn(lev, cur))} of Tier 1). LCR {fmtRatio(lcr, cur.ratio.lcr)} and NSFR{" "}
                {fmtRatio(nsfr, cur.ratio.nsfr)} compare with 100% minimums.
              </>
            }
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-3">
              <TrendFigure
                figLabel="Figure 4.1"
                title="Leverage ratio"
                def={lev}
                history={history}
                compareQ={compareQ}
                extraLines={levExtra}
              />
              <TrendFigure figLabel="Figure 4.2" title="LCR" def={lcr} history={history} compareQ={compareQ} />
              <TrendFigure figLabel="Figure 4.3" title="NSFR" def={nsfr} history={history} compareQ={compareQ} />
            </div>

            <div className="mt-10">
              <Figure label="Table 4.4" title="Leverage and liquidity components" meta="£bn · spot">
                <ComponentsTable cur={cur} prev={prev} reportLabel={reportLabel} cmpLabel={cmpLabel} />
              </Figure>
            </div>
            <Footnotes
              items={[
                {
                  mark: "1",
                  text: "Dashed lines are regulatory minimums (and, for leverage, the requirement including buffers); the dotted line is the management target. The hollow marker is the comparison period.",
                },
                { mark: "2", text: "HQLA is stated after haircuts and excludes assets held in entities with transferability constraints." },
              ]}
            />
          </Section>

          <footer className="border-t border-neutral-200 pt-4 text-[11px] leading-relaxed text-neutral-500">
            Prepared by Group Capital Management for ALCO, 22 Sep 2026. Pelham Bridge Group is a fictional institution;
            all figures are generated from a seeded model and every ratio is derived from the underlying amounts.
          </footer>
        </article>
      </div>
    </div>
  );
}

function MessageItem({ m }: { m: Message }) {
  const mark =
    m.tone === "good" ? (
      <span className="font-bold text-emerald-700">
        <span aria-hidden>✓</span>
        <span className="sr-only">On track:</span>
      </span>
    ) : m.tone === "warn" ? (
      <span className="font-bold text-amber-700">
        <span aria-hidden>▲</span>
        <span className="sr-only">Attention:</span>
      </span>
    ) : (
      <span aria-hidden className="mt-[7px] inline-block h-1.5 w-1.5 bg-blue-900" />
    );
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-neutral-800">
      <span className="flex w-3 shrink-0 justify-center text-xs leading-relaxed">{mark}</span>
      <span>{m.text}</span>
    </li>
  );
}

function ComponentsTable({
  cur,
  prev,
  reportLabel,
  cmpLabel,
}: {
  cur: ReturnType<typeof snapshot>;
  prev: ReturnType<typeof snapshot> | null;
  reportLabel: string;
  cmpLabel: string;
}) {
  const rows: { label: string; get: (s: ReturnType<typeof snapshot>) => number; strong?: boolean; d?: number }[] = [
    { label: "Tier 1 capital", get: (s) => s.t1 },
    { label: "Leverage exposure", get: (s) => s.levExposure, d: 0 },
    { label: "High-quality liquid assets", get: (s) => s.hqla },
    { label: "Net cash outflows (30 days)", get: (s) => s.nco },
    { label: "LCR surplus", get: (s) => s.hqla - s.nco, strong: true },
    { label: "Available stable funding", get: (s) => s.asf, d: 0 },
    { label: "Required stable funding", get: (s) => s.rsf, d: 0 },
    { label: "NSFR surplus", get: (s) => s.asf - s.rsf, strong: true },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">Leverage and liquidity components, £bn</caption>
        <thead>
          <tr className="border-b border-neutral-300">
            <th scope="col" className="px-2 py-1.5 text-left text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Component
            </th>
            <th scope="col" className="w-32 px-2 py-1.5 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              {cmpLabel}
            </th>
            <th scope="col" className="w-32 px-2 py-1.5 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              {reportLabel}
            </th>
            <th scope="col" className="w-32 px-2 py-1.5 text-right text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Change
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => {
            const v = r.get(cur);
            const p = prev ? r.get(prev) : null;
            const dp = r.d ?? 1;
            const cls = r.strong ? "font-semibold text-neutral-900" : "text-neutral-700";
            return (
              <tr key={r.label} className={r.strong ? "bg-neutral-50" : ""}>
                <th scope="row" className={`px-2 py-1.5 text-left ${r.strong ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                  {r.label}
                </th>
                <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${p === null ? "text-neutral-300" : cls}`}>
                  {p === null ? "—" : num(p, dp)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${cls}`}>{num(v, dp)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-neutral-600 tabular-nums">
                  {p === null ? <span className="text-neutral-300">—</span> : signed(v - p, dp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
