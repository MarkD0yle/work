import { useMemo, useState, type ReactNode } from "react";

export const title = "Currency Ops Risk";

/* ------------------------------------------------------------------ *
 * Model — currency operations confidence, owned by the PM
 *
 * One taxonomy, three states:
 *   clean    — within tolerance, nothing exposed
 *   at-risk  — exposure is live but has not failed yet
 *   broken   — a control has actually failed
 * ------------------------------------------------------------------ */

type State = "clean" | "at-risk" | "broken";

const STATE_RANK: Record<State, number> = {
  clean: 0,
  "at-risk": 1,
  broken: 2,
};

const STATE: Record<
  State,
  {
    label: string;
    dot: string;
    text: string;
    pill: string;
    bar: string;
    rail: string;
  }
> = {
  clean: {
    label: "Clean",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    bar: "bg-emerald-500",
    rail: "bg-emerald-500",
  },
  "at-risk": {
    label: "At risk",
    dot: "bg-amber-500",
    text: "text-amber-700",
    pill: "bg-amber-50 text-amber-700 ring-amber-600/20",
    bar: "bg-amber-500",
    rail: "bg-amber-500",
  },
  broken: {
    label: "Broken",
    dot: "bg-red-500",
    text: "text-red-700",
    pill: "bg-red-50 text-red-700 ring-red-600/20",
    bar: "bg-red-500",
    rail: "bg-red-500",
  },
};

/* ------------------------------------------------------------------ *
 * Trade lifecycle — the six stages a trade moves through in a day.
 * A trade that is at-risk or broken has stalled (or failed) at one
 * stage: everything before it has cleared, everything after is pending.
 * Monitoring statuses that aren't a trade-in-flight carry no lifecycle.
 * ------------------------------------------------------------------ */

type StageKey =
  | "received"
  | "generated"
  | "executed"
  | "matched"
  | "confirmed"
  | "settled";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "received", label: "Date received" },
  { key: "generated", label: "Trades generated" },
  { key: "executed", label: "Trades executed" },
  { key: "matched", label: "Matched" },
  { key: "confirmed", label: "Confirmed" },
  { key: "settled", label: "Settled" },
];

type RiskItem = {
  id: string;
  domain: string;
  state: State;
  title: string;
  fund: string;
  exposureLabel: string;
  exposureValue: string;
  ageMins: number;
  sla: string;
  slaBreached: boolean;
  deadlineMins?: number;
  deadlineLabel?: string;
  owner: string;
  rootCause: string;
  control: string;
  fundImpact: string;
  recommendedAction: string;
  // Where the trade has reached in the day's lifecycle. Omitted for
  // monitoring statuses that aren't a single trade in flight.
  lifecycle?: { stage: StageKey };
};

type Domain = {
  key: string;
  label: string;
  // One area-level pointer per state — what the PM is told before issues.
  pointer: Record<State, string>;
  icon: ReactNode;
};

const ic = (path: string) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d={path} clipRule="evenodd" />
  </svg>
);

const DOMAINS: Domain[] = [
  {
    key: "hedging",
    label: "FX Exposure & Hedging",
    pointer: {
      clean: "Hedge ratios within band",
      "at-risk": "A share class is exposed into a fix",
      broken: "A hedge has missed its fix",
    },
    icon: ic(
      "M10 1a.75.75 0 0 1 .75.75v1.06a7.001 7.001 0 0 1 6.44 6.44h1.06a.75.75 0 0 1 0 1.5h-1.06a7.001 7.001 0 0 1-6.44 6.44v1.06a.75.75 0 0 1-1.5 0v-1.06a7.001 7.001 0 0 1-6.44-6.44H1.75a.75.75 0 0 1 0-1.5h1.06A7.001 7.001 0 0 1 9.25 2.81V1.75A.75.75 0 0 1 10 1Zm0 4a5 5 0 1 0 0 10A5 5 0 0 0 10 5Z",
    ),
  },
  {
    key: "settlement",
    label: "Currency Settlement",
    pointer: {
      clean: "All currency legs settling",
      "at-risk": "A roll or leg may not settle",
      broken: "A currency leg has failed to settle",
    },
    icon: ic(
      "M3 4.75A1.75 1.75 0 0 1 4.75 3h10.5A1.75 1.75 0 0 1 17 4.75v10.5A1.75 1.75 0 0 1 15.25 17H4.75A1.75 1.75 0 0 1 3 15.25V4.75Zm9.03 3.28a.75.75 0 0 0-1.06-1.06L8.75 9.19 7.78 8.22a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l2.75-2.75Z",
    ),
  },
  {
    key: "valuation",
    label: "Valuation & Rates",
    pointer: {
      clean: "Fixings confirmed for all majors",
      "at-risk": "An unconfirmed rate is in tonight's NAV",
      broken: "A struck NAV used a wrong rate",
    },
    icon: ic(
      "M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z",
    ),
  },
  {
    key: "mandate",
    label: "Mandate & Limits",
    pointer: {
      clean: "All exposures within IMA",
      "at-risk": "An exposure is near a cap",
      broken: "A mandate cap has been breached",
    },
    icon: ic(
      "M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Z",
    ),
  },
  {
    key: "funding",
    label: "Cash & Funding",
    pointer: {
      clean: "Currency funding within buffer",
      "at-risk": "A currency may be short to fund",
      broken: "A currency account is overdrawn",
    },
    icon: ic(
      "M1 4.25C1 3.56 1.56 3 2.25 3h15.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25H2.25C1.56 14 1 13.44 1 12.75v-8.5ZM10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 6.75A.75.75 0 0 1 4.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 4 6.75Zm10.75 3a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Z",
    ),
  },
];

const ITEMS: RiskItem[] = [
  {
    id: "s1",
    domain: "settlement",
    state: "broken",
    title: "EUR/USD spot failed to settle — fund overdrawn",
    fund: "Global Macro Fund",
    exposureLabel: "Overdraft now live",
    exposureValue: "$61.0m",
    ageMins: 55,
    sla: "SLA breached +25m",
    slaBreached: true,
    owner: "Settlements — R. Shah",
    rootCause:
      "Custodian rejected the EUR/USD spot on an SSI mismatch; it did not recycle before cut-off.",
    control:
      "Overdraft facility absorbing the gap; fail interest accruing at the penalty rate.",
    fundImpact:
      "Global Macro is $61m overdrawn until the trade resettles — real fail interest hitting the fund today.",
    recommendedAction:
      "Confirm corrected SSIs with the custodian and reinstruct for same-day; treasury to size the overdraft.",
    lifecycle: { stage: "settled" },
  },
  {
    id: "s2",
    domain: "settlement",
    state: "at-risk",
    title: "FX forward roll unmatched — value tomorrow",
    fund: "EM Debt Fund",
    exposureLabel: "Roll notional at risk",
    exposureValue: "$78.0m",
    ageMins: 65,
    sla: "Match by 17:00",
    slaBreached: false,
    deadlineMins: 115,
    deadlineLabel: "17:00 match cut-off",
    owner: "Middle Office — R. Shah",
    rootCause:
      "Counterparty confirmed the prior rate; rebooked at the agreed level, awaiting re-match.",
    control: "Contingency funding line pre-arranged if it slips to VD+1.",
    fundImpact:
      "Unmatched by 17:00 the roll funds late — overdraft interest on $78m and a value-date break.",
    recommendedAction:
      "Chase the re-match; confirm contingency funding with treasury as a fallback.",
    lifecycle: { stage: "matched" },
  },
  {
    id: "h1",
    domain: "hedging",
    state: "at-risk",
    title: "Sterling Hedged share class 6.2% under-hedged",
    fund: "Sterling Hedged Acc",
    exposureLabel: "Unhedged NAV exposure",
    exposureValue: "£42.0m",
    ageMins: 38,
    sla: "Fix in 22m",
    slaBreached: false,
    deadlineMins: 22,
    deadlineLabel: "15:00 WM fix",
    owner: "FX Ops — you",
    rootCause:
      "Subscriptions booked after the 11:00 hedge run; the auto top-up did not pick up the late flow.",
    control: "Manual hedge top-up via the FX desk before the fix; band ±2%.",
    fundImpact:
      "Held across the 15:00 WM fix, the share class carries ~£42m GBP/USD into tonight's NAV.",
    recommendedAction:
      "Instruct the FX desk to top up £42m GBP/USD before the 14:55 cut-off.",
    lifecycle: { stage: "generated" },
  },
  {
    id: "h2",
    domain: "hedging",
    state: "clean",
    title: "Diversified Growth hedge ratio 98.4% — within band",
    fund: "Diversified Growth Fund",
    exposureLabel: "Hedge ratio",
    exposureValue: "98.4%",
    ageMins: 90,
    sla: "Within band",
    slaBreached: false,
    owner: "FX Ops",
    rootCause: "Minor market drift inside the ±2% band.",
    control: "Auto-rebalances on the next hedge run.",
    fundImpact: "None — within tolerance.",
    recommendedAction: "None.",
  },
  {
    id: "v1",
    domain: "valuation",
    state: "at-risk",
    title: "Manual override on USD/TRY feeding tonight's NAV",
    fund: "EM Debt Fund",
    exposureLabel: "Position on override",
    exposureValue: "$23.4m",
    ageMins: 120,
    sla: "NAV strike 18:00",
    slaBreached: false,
    deadlineMins: 230,
    deadlineLabel: "18:00 NAV strike",
    owner: "Product Control — K. Meir",
    rootCause:
      "Primary fix source gapped on TRY; the desk override is applied pending WM confirmation.",
    control:
      "Override flagged; reverts automatically if WM differs by more than 50bps.",
    fundImpact:
      "$23.4m of EM Debt is priced on an unconfirmed rate — tonight's NAV could restate.",
    recommendedAction:
      "Confirm the WM/R TRY rate before the 18:00 strike and clear the override.",
    lifecycle: { stage: "confirmed" },
  },
  {
    id: "v2",
    domain: "valuation",
    state: "clean",
    title: "Today's 4pm fixings captured for all majors",
    fund: "All funds",
    exposureLabel: "Fixings",
    exposureValue: "G10 complete",
    ageMins: 0,
    sla: "—",
    slaBreached: false,
    owner: "Product Control",
    rootCause: "Routine confirmation.",
    control: "Continuous fix-capture monitor — green.",
    fundImpact: "None.",
    recommendedAction: "None.",
  },
  {
    id: "m1",
    domain: "mandate",
    state: "at-risk",
    title: "JPY exposure 0.4% from the prospectus cap",
    fund: "Global Macro Fund",
    exposureLabel: "JPY vs 10% cap",
    exposureValue: "9.6 / 10.0%",
    ageMins: 175,
    sla: "Soft limit",
    slaBreached: false,
    owner: "Compliance",
    rootCause:
      "A yen rally pushed mark-to-market exposure toward the cap; no new positions added.",
    control: "Hard block on adding JPY beyond 10%; passive breach reported if crossed.",
    fundImpact:
      "A further yen move or a subscription could breach the prospectus cap — a reportable passive breach.",
    recommendedAction:
      "Pre-clear any JPY change with compliance; consider trimming into strength.",
  },
  {
    id: "mx",
    domain: "mandate",
    state: "clean",
    title: "All other currency exposures within IMA",
    fund: "All funds",
    exposureLabel: "Mandate breaches",
    exposureValue: "0",
    ageMins: 0,
    sla: "—",
    slaBreached: false,
    owner: "Compliance",
    rootCause: "No portfolio outside its currency limits.",
    control: "Continuous mandate monitor — green.",
    fundImpact: "None.",
    recommendedAction: "None.",
  },
  {
    id: "f1",
    domain: "funding",
    state: "clean",
    title: "EUR T+1 funding gap £1.2m — inside intraday buffer",
    fund: "Global Macro Fund",
    exposureLabel: "Funding gap",
    exposureValue: "£1.2m",
    ageMins: 45,
    sla: "Within buffer",
    slaBreached: false,
    owner: "Treasury",
    rootCause: "Timing of a coupon receipt; covered by the intraday buffer.",
    control: "Auto-swept at the 16:00 funding run.",
    fundImpact: "None — within the intraday buffer.",
    recommendedAction: "None.",
  },
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function fmtAge(mins: number) {
  if (mins <= 0) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtIn(mins: number) {
  if (mins <= 0) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function worstState(items: RiskItem[]): State {
  return items.reduce<State>(
    (acc, i) => (STATE_RANK[i.state] > STATE_RANK[acc] ? i.state : acc),
    "clean",
  );
}

/* ------------------------------------------------------------------ *
 * Confidence gauge — one per operations area
 * ------------------------------------------------------------------ */

function Gauge({ state }: { state: State }) {
  const zones: State[] = ["clean", "at-risk", "broken"];
  const fillPct = ((STATE_RANK[state] + 1) / 3) * 100;
  return (
    <div className="w-full">
      <div className="relative h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${STATE[state].bar}`}
          style={{ width: `${fillPct}%` }}
        />
        <div className="absolute inset-y-0 left-1/3 w-px bg-white" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium tracking-wide uppercase">
        {zones.map((z) => (
          <span
            key={z}
            className={
              z === state ? STATE[z].text + " font-semibold" : "text-neutral-400"
            }
          >
            {STATE[z].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trade lifecycle stepper — six stages, worst-state on the stall point
 * ------------------------------------------------------------------ */

function StageMark({
  status,
  state,
}: {
  status: "done" | "current" | "pending";
  state: State;
}) {
  if (status === "done") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.69 7.8a.75.75 0 0 1-1.08 0l-3.65-3.7a.75.75 0 1 1 1.07-1.05l3.11 3.16 7.16-7.26a.75.75 0 0 1 1.07-.01Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (status === "current" && state === "broken") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    );
  }
  if (status === "current") {
    return <span className="h-2 w-2 rounded-full bg-white" />;
  }
  return <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />;
}

function TradeLifecycle({
  stage,
  state,
}: {
  stage: StageKey;
  state: State;
}) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const st = STATE[state];
  const caption = state === "broken" ? "Failed here" : "Stalled here";

  return (
    <div className="mb-5 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-[10px] font-semibold tracking-wide uppercase text-neutral-400">
        Trade lifecycle
      </div>
      <ol className="mt-4 flex items-start">
        {STAGES.map((s, i) => {
          const status =
            i < currentIdx
              ? "done"
              : i === currentIdx
                ? "current"
                : "pending";

          const dotCls =
            status === "done"
              ? "bg-emerald-500 text-white"
              : status === "current"
                ? `${st.bar} text-white ring-4 ${
                    state === "broken" ? "ring-red-100" : "ring-amber-100"
                  }`
                : "bg-white ring-1 ring-inset ring-neutral-200";

          const labelCls =
            status === "done"
              ? "text-neutral-600"
              : status === "current"
                ? `${st.text} font-semibold`
                : "text-neutral-400";

          return (
            <li key={s.key} className="relative flex-1">
              {i < STAGES.length - 1 && (
                <span
                  className={`absolute top-3 left-1/2 z-0 h-0.5 w-full ${
                    i < currentIdx ? "bg-emerald-500" : "bg-neutral-200"
                  }`}
                />
              )}
              <div className="relative z-10 flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${dotCls}`}
                >
                  <StageMark status={status} state={state} />
                </span>
                <span
                  className={`mt-2 text-center text-[11px] leading-tight ${labelCls}`}
                >
                  {s.label}
                </span>
                {status === "current" && (
                  <span
                    className={`mt-0.5 text-[10px] font-medium ${st.text}`}
                  >
                    {caption}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gauge card — one self-contained confidence gauge per area.
 * Clicking it opens that area's issues in the shared section below.
 * ------------------------------------------------------------------ */

function GaugeCard({
  domain,
  items,
  state,
  selected,
  onSelect,
}: {
  domain: Domain;
  items: RiskItem[];
  state: State;
  selected: boolean;
  onSelect: () => void;
}) {
  const st = STATE[state];
  const issueCount = items.filter((i) => i.state !== "clean").length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col rounded-xl border bg-white p-4 text-left transition ${
        selected
          ? "border-neutral-900 ring-1 ring-neutral-900"
          : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-neutral-400">{domain.icon}</span>
        <span className="text-sm font-semibold text-neutral-900">
          {domain.label}
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </div>

      <div className="mt-4">
        <Gauge state={state} />
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        {domain.pointer[state]}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            issueCount ? st.dot : "bg-emerald-500"
          }`}
        />
        {issueCount > 0
          ? `${issueCount} live issue${
              issueCount > 1 ? "s" : ""
            } — click to open`
          : "No live issues"}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Issue detail — one issue, fully expanded (no accordion)
 * ------------------------------------------------------------------ */

function IssueDetail({ item }: { item: RiskItem }) {
  const s = STATE[item.state];
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
        <span className={`mt-0.5 h-9 w-1 shrink-0 rounded-full ${s.rail}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            <span className="text-[11px] font-medium text-neutral-500">
              {item.fund}
            </span>
          </div>
          <div className="mt-1.5 text-sm font-semibold text-neutral-900">
            {item.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
            <span>
              {item.exposureLabel}{" "}
              <span className="font-semibold tabular-nums text-neutral-700">
                {item.exposureValue}
              </span>
            </span>
            {item.deadlineMins != null && (
              <>
                <span>·</span>
                <span>
                  {fmtIn(item.deadlineMins)} → {item.deadlineLabel}
                </span>
              </>
            )}
            <span>·</span>
            <span
              className={item.slaBreached ? "font-semibold text-red-600" : ""}
            >
              {item.sla}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {item.lifecycle && (
          <TradeLifecycle stage={item.lifecycle.stage} state={item.state} />
        )}

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Affected fund">{item.fund}</Field>
          <Field label={item.exposureLabel}>
            <span className="tabular-nums">{item.exposureValue}</span>
          </Field>
          <Field label="Age / SLA">
            {fmtAge(item.ageMins)} ·{" "}
            <span
              className={item.slaBreached ? "font-semibold text-red-600" : ""}
            >
              {item.sla}
            </span>
          </Field>
          <Field label="Owner">{item.owner}</Field>
          <Field label="Root cause" wide>
            {item.rootCause}
          </Field>
          <Field label="Control in play" wide>
            {item.control}
          </Field>
        </div>

        <div className={`mt-4 rounded-lg p-3 ring-1 ring-inset ${s.pill}`}>
          <div className="text-[10px] font-semibold tracking-wide uppercase opacity-70">
            What this means for the fund
          </div>
          <div className="mt-1 text-sm">{item.fundImpact}</div>
          <div className="mt-2 text-sm font-medium">
            → {item.recommendedAction}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-700"
          >
            Acknowledge
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Escalate to {item.owner.split(" — ")[0]}
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Snooze 15m
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function CurrencyOpsRisk() {
  // One area open at a time; clicking the open gauge again closes it.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const areas = useMemo(
    () =>
      DOMAINS.map((d) => {
        const items = ITEMS.filter((i) => i.domain === d.key);
        return { domain: d, items, state: worstState(items) };
      }),
    [],
  );

  // Worst-first: broken, then at-risk, then clean.
  const orderedAreas = useMemo(
    () =>
      [...areas].sort((a, b) => STATE_RANK[b.state] - STATE_RANK[a.state]),
    [areas],
  );

  const selected =
    selectedKey != null
      ? areas.find((a) => a.domain.key === selectedKey) ?? null
      : null;

  const selectedIssues = selected
    ? selected.items.filter((i) => i.state !== "clean")
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium tracking-wide uppercase text-neutral-500">
          Pattern
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950">
          Currency Ops Confidence
        </h1>
        <p className="mt-2 max-w-prose text-neutral-600">
          One confidence gauge per currency-operations area — clean, at risk,
          or broken — grouped together, worst first. Pick the area you can't
          trust and every live issue in it opens below, fully laid out.
        </p>
      </div>

      {/* Pattern legend */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            name: "A gauge per area",
            q: "Can I trust this area?",
            d: "Every operations area carries its own verdict — clean, at risk or broken — independent of the rest.",
          },
          {
            name: "Grouped, worst first",
            q: "Where do I look?",
            d: "All area gauges sit together, the ones you can't trust first. Green gauges say 'nothing here'.",
          },
          {
            name: "Open it, see everything",
            q: "What, and what I do.",
            d: "Click a gauge and every live issue in that area opens below — cause, control, lifecycle and action. No drilling.",
          },
        ].map((l) => (
          <div
            key={l.name}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <span className="text-[10px] font-semibold tracking-wide uppercase text-neutral-500">
              {l.name}
            </span>
            <div className="mt-3 text-sm font-semibold text-neutral-900">
              {l.q}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-neutral-500">
              {l.d}
            </div>
          </div>
        ))}
      </div>

      {/* ---------------- Area gauges, grouped ---------------- */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wide uppercase text-neutral-500">
            Area confidence — worst first
          </span>
          {selected && (
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              Close
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedAreas.map(({ domain, items, state }) => (
            <GaugeCard
              key={domain.key}
              domain={domain}
              items={items}
              state={state}
              selected={selectedKey === domain.key}
              onSelect={() =>
                setSelectedKey((k) => (k === domain.key ? null : domain.key))
              }
            />
          ))}
        </div>
      </div>

      {/* ------- Selected area — every issue, fully expanded ------- */}
      {selected && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4">
            <span className="text-neutral-400">{selected.domain.icon}</span>
            <span className="text-sm font-semibold text-neutral-900">
              {selected.domain.label}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATE[selected.state].pill}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATE[selected.state].dot}`}
              />
              {STATE[selected.state].label}
            </span>
            <span className="text-[11px] font-medium text-neutral-400">
              {selectedIssues.length > 0
                ? `${selectedIssues.length} live issue${
                    selectedIssues.length > 1 ? "s" : ""
                  }`
                : "no live issues"}
            </span>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="ml-auto text-xs font-medium text-neutral-500 hover:text-neutral-900"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {selectedIssues.length > 0 ? (
              selectedIssues.map((it) => (
                <IssueDetail key={it.id} item={it} />
              ))
            ) : (
              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
                {selected.domain.pointer[selected.state]} — nothing to action
                in this area.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Why this fits a PM POV */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="text-xs font-medium tracking-wide uppercase text-neutral-500">
          Why this fits the PM who owns currency ops
        </div>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-neutral-600">
          <li>
            <strong className="text-neutral-900">A verdict per area, not one
            blended score.</strong>{" "}
            Each area carries its own gauge — clean, at risk or broken — so a
            failing area is never averaged away by the healthy ones.
          </li>
          <li>
            <strong className="text-neutral-900">Grouped, worst first.</strong>{" "}
            The gauges sit together, the ones you can't trust at the front;
            green gauges explicitly say there is nothing to look at.
          </li>
          <li>
            <strong className="text-neutral-900">One click, no drilling.</strong>{" "}
            Open an area and every live issue expands below the whole grid —
            cause, control, lifecycle and action all on screen, no accordions.
          </li>
          <li>
            <strong className="text-neutral-900">Broken means broken.</strong>{" "}
            One taxonomy, not severity grades: a failed control reads "broken",
            a live exposure reads "at risk", everything else "clean".
          </li>
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-neutral-800">{children}</div>
    </div>
  );
}
