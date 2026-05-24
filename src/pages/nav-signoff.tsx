import { useMemo, useState, type ReactNode } from "react";

export const title = "NAV Sign-off";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Model — end-of-day NAV approval pipeline. Each fund flows through
 * six gates; each gate is owned by a single team and stamps a
 * sign-off with audit timestamps. Tolerance checks at each gate must
 * pass or be overridden with rationale.
 * ------------------------------------------------------------------ */

type StageKey =
  | "trial"
  | "fund-acct"
  | "product-ctrl"
  | "pm-review"
  | "compliance"
  | "final";

type StageStatus = "pending" | "in-progress" | "exception" | "signed";

const STAGES: { key: StageKey; label: string; owner: string; short: string }[] = [
  { key: "trial", label: "Trial NAV", owner: "Fund Acct", short: "Trial" },
  { key: "fund-acct", label: "Fund Acct check", owner: "Fund Acct", short: "FA" },
  { key: "product-ctrl", label: "Product Control", owner: "Product Ctrl", short: "PC" },
  { key: "pm-review", label: "PM review", owner: "Portfolio Mgmt", short: "PM" },
  { key: "compliance", label: "Compliance gate", owner: "Compliance", short: "Cmp" },
  { key: "final", label: "Final sign-off", owner: "Head of Ops", short: "Final" },
];

const STAGE_INDEX: Record<StageKey, number> = STAGES.reduce(
  (acc, s, i) => {
    acc[s.key] = i;
    return acc;
  },
  {} as Record<StageKey, number>,
);

interface ToleranceCheck {
  key: string;
  label: string;
  band: string;
  bandMin?: number;
  bandMax?: number;
  observedNum?: number;
  observed: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface SignOff {
  stage: StageKey;
  who: string;
  initials: string;
  at: string;
  note?: string;
}

interface Exception {
  id: string;
  stage: StageKey;
  raisedAt: string;
  raisedBy: string;
  severity: "info" | "warn" | "block";
  summary: string;
  detail: string;
  proposedAction: string;
  status: "open" | "investigating" | "override-pending" | "cleared";
}

interface FundLine {
  code: string;
  name: string;
  ccy: string;
  nav: number;
  shares: number;
  pricePerShare: number;
  priorPrice: number;
  variancePct: number;
  varianceBand: number;
  bmkVariancePct: number;
  forecastDeltaBps: number;
  aum: number;
  currentStage: StageKey;
  stageStatus: StageStatus;
  stageMap: Record<StageKey, StageStatus>;
  signOffs: SignOff[];
  checks: ToleranceCheck[];
  exceptions: Exception[];
  minutesToCut: number;
}

const FUNDS: FundLine[] = [
  {
    code: "GLM",
    name: "Global Macro Fund",
    ccy: "USD",
    nav: 4_215_300_000,
    shares: 38_400_000,
    pricePerShare: 109.77,
    priorPrice: 109.45,
    variancePct: 0.29,
    varianceBand: 0.5,
    bmkVariancePct: -0.04,
    forecastDeltaBps: 6,
    aum: 4_215_300_000,
    currentStage: "compliance",
    stageStatus: "in-progress",
    stageMap: {
      trial: "signed",
      "fund-acct": "signed",
      "product-ctrl": "signed",
      "pm-review": "signed",
      compliance: "in-progress",
      final: "pending",
    },
    signOffs: [
      { stage: "trial", who: "T. Bauer", initials: "TB", at: "17:14", note: "Trial struck on time." },
      { stage: "fund-acct", who: "T. Bauer", initials: "TB", at: "17:21" },
      { stage: "product-ctrl", who: "K. Meir", initials: "KM", at: "17:38", note: "All P&L attribution within ±2 bps band." },
      { stage: "pm-review", who: "L. Romano", initials: "LR", at: "17:51" },
    ],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±50 bps", bandMin: -50, bandMax: 50, observedNum: 29, observed: "+29 bps", status: "pass", detail: "Within fund volatility band." },
      { key: "bmk", label: "vs Benchmark", band: "±25 bps", bandMin: -25, bandMax: 25, observedNum: -4, observed: "-4 bps", status: "pass", detail: "Tracking holds." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "100%", status: "pass", detail: "All 4pm fixings captured." },
      { key: "pricesrc", label: "Stale prices", band: "0", observed: "0", status: "pass", detail: "No stale instruments." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "1", status: "warn", detail: "USD/TRY override pending WM confirm." },
    ],
    exceptions: [
      {
        id: "EX-119",
        stage: "compliance",
        raisedAt: "17:55",
        raisedBy: "Compliance bot",
        severity: "warn",
        summary: "USD/TRY override still in book at compliance gate",
        detail: "Manual rate override on USD/TRY is still flagged. NAV uses an unconfirmed rate on $23.4m of EM Debt.",
        proposedAction: "Confirm WM/R TRY rate or accept compliance override with rationale.",
        status: "open",
      },
    ],
    minutesToCut: 4,
  },
  {
    code: "EMD",
    name: "EM Debt Fund",
    ccy: "USD",
    nav: 1_812_400_000,
    shares: 14_900_000,
    pricePerShare: 121.64,
    priorPrice: 121.92,
    variancePct: -0.23,
    varianceBand: 0.6,
    bmkVariancePct: -0.09,
    forecastDeltaBps: -3,
    aum: 1_812_400_000,
    currentStage: "product-ctrl",
    stageStatus: "exception",
    stageMap: {
      trial: "signed",
      "fund-acct": "signed",
      "product-ctrl": "exception",
      "pm-review": "pending",
      compliance: "pending",
      final: "pending",
    },
    signOffs: [
      { stage: "trial", who: "T. Bauer", initials: "TB", at: "17:11" },
      { stage: "fund-acct", who: "T. Bauer", initials: "TB", at: "17:22" },
    ],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±60 bps", bandMin: -60, bandMax: 60, observedNum: -23, observed: "-23 bps", status: "pass", detail: "Within band." },
      { key: "bmk", label: "vs Benchmark", band: "±30 bps", bandMin: -30, bandMax: 30, observedNum: -9, observed: "-9 bps", status: "pass", detail: "Tracking nominal." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "94%", status: "fail", detail: "USD/TRY fix missing on a $23.4m sleeve." },
      { key: "pricesrc", label: "Stale prices", band: "0", observed: "2", status: "warn", detail: "Two off-the-run EM bonds priced from yesterday." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "1", status: "warn", detail: "TRY rate override applied." },
    ],
    exceptions: [
      {
        id: "EX-117",
        stage: "product-ctrl",
        raisedAt: "17:34",
        raisedBy: "K. Meir",
        severity: "block",
        summary: "FX fix coverage below 100% — TRY missing",
        detail: "USD/TRY 4pm fix did not land from the primary source. Override applied is awaiting WM/R confirm.",
        proposedAction: "Wait for WM/R confirm by 17:55 or strike with override + product-control rationale.",
        status: "investigating",
      },
      {
        id: "EX-118",
        stage: "product-ctrl",
        raisedAt: "17:36",
        raisedBy: "K. Meir",
        severity: "warn",
        summary: "Two stale prices on off-the-run EM bonds",
        detail: "Bonds with no traded prints today; pricing committee approval needed if no fresh marks by 17:50.",
        proposedAction: "Escalate to pricing committee for sign-off on stale-price exception.",
        status: "open",
      },
    ],
    minutesToCut: 4,
  },
  {
    code: "DGF",
    name: "Diversified Growth Fund",
    ccy: "GBP",
    nav: 2_990_100_000,
    shares: 24_800_000,
    pricePerShare: 120.57,
    priorPrice: 120.12,
    variancePct: 0.37,
    varianceBand: 0.5,
    bmkVariancePct: 0.11,
    forecastDeltaBps: 9,
    aum: 2_990_100_000,
    currentStage: "final",
    stageStatus: "in-progress",
    stageMap: {
      trial: "signed",
      "fund-acct": "signed",
      "product-ctrl": "signed",
      "pm-review": "signed",
      compliance: "signed",
      final: "in-progress",
    },
    signOffs: [
      { stage: "trial", who: "T. Bauer", initials: "TB", at: "17:09" },
      { stage: "fund-acct", who: "T. Bauer", initials: "TB", at: "17:17" },
      { stage: "product-ctrl", who: "K. Meir", initials: "KM", at: "17:30" },
      { stage: "pm-review", who: "S. Nguyen", initials: "SN", at: "17:42" },
      { stage: "compliance", who: "A. Costa", initials: "AC", at: "17:49", note: "All limits inside IMA." },
    ],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±50 bps", bandMin: -50, bandMax: 50, observedNum: 37, observed: "+37 bps", status: "pass", detail: "Within band." },
      { key: "bmk", label: "vs Benchmark", band: "±25 bps", bandMin: -25, bandMax: 25, observedNum: 11, observed: "+11 bps", status: "pass", detail: "Tracking inside band." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "100%", status: "pass", detail: "Complete." },
      { key: "pricesrc", label: "Stale prices", band: "0", observed: "0", status: "pass", detail: "All instruments fresh." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "0", status: "pass", detail: "None." },
    ],
    exceptions: [],
    minutesToCut: 4,
  },
  {
    code: "STG",
    name: "Sterling Hedged Acc",
    ccy: "GBP",
    nav: 612_000_000,
    shares: 6_120_000,
    pricePerShare: 100.00,
    priorPrice: 99.78,
    variancePct: 0.22,
    varianceBand: 0.4,
    bmkVariancePct: 0.05,
    forecastDeltaBps: -2,
    aum: 612_000_000,
    currentStage: "pm-review",
    stageStatus: "in-progress",
    stageMap: {
      trial: "signed",
      "fund-acct": "signed",
      "product-ctrl": "signed",
      "pm-review": "in-progress",
      compliance: "pending",
      final: "pending",
    },
    signOffs: [
      { stage: "trial", who: "T. Bauer", initials: "TB", at: "17:10" },
      { stage: "fund-acct", who: "T. Bauer", initials: "TB", at: "17:19" },
      { stage: "product-ctrl", who: "K. Meir", initials: "KM", at: "17:33", note: "Hedge top-up reflected." },
    ],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±40 bps", bandMin: -40, bandMax: 40, observedNum: 22, observed: "+22 bps", status: "pass", detail: "Within band." },
      { key: "bmk", label: "vs Benchmark", band: "±20 bps", bandMin: -20, bandMax: 20, observedNum: 5, observed: "+5 bps", status: "pass", detail: "Tight tracking." },
      { key: "hedge", label: "Hedge ratio", band: "98–102%", observed: "100.4%", status: "pass", detail: "After top-up." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "100%", status: "pass", detail: "Complete." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "0", status: "pass", detail: "None." },
    ],
    exceptions: [],
    minutesToCut: 4,
  },
  {
    code: "USIG",
    name: "US IG Credit",
    ccy: "USD",
    nav: 1_205_000_000,
    shares: 11_400_000,
    pricePerShare: 105.70,
    priorPrice: 105.61,
    variancePct: 0.09,
    varianceBand: 0.3,
    bmkVariancePct: -0.02,
    forecastDeltaBps: 1,
    aum: 1_205_000_000,
    currentStage: "fund-acct",
    stageStatus: "in-progress",
    stageMap: {
      trial: "signed",
      "fund-acct": "in-progress",
      "product-ctrl": "pending",
      "pm-review": "pending",
      compliance: "pending",
      final: "pending",
    },
    signOffs: [
      { stage: "trial", who: "T. Bauer", initials: "TB", at: "17:24" },
    ],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±30 bps", bandMin: -30, bandMax: 30, observedNum: 9, observed: "+9 bps", status: "pass", detail: "Within band." },
      { key: "bmk", label: "vs Benchmark", band: "±15 bps", bandMin: -15, bandMax: 15, observedNum: -2, observed: "-2 bps", status: "pass", detail: "On benchmark." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "100%", status: "pass", detail: "Complete." },
      { key: "pricesrc", label: "Stale prices", band: "0", observed: "0", status: "pass", detail: "Clean." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "0", status: "pass", detail: "None." },
    ],
    exceptions: [],
    minutesToCut: 4,
  },
  {
    code: "ABS",
    name: "Asset-Backed Income",
    ccy: "USD",
    nav: 415_200_000,
    shares: 3_900_000,
    pricePerShare: 106.46,
    priorPrice: 105.21,
    variancePct: 1.19,
    varianceBand: 0.5,
    bmkVariancePct: 0.83,
    forecastDeltaBps: 18,
    aum: 415_200_000,
    currentStage: "trial",
    stageStatus: "exception",
    stageMap: {
      trial: "exception",
      "fund-acct": "pending",
      "product-ctrl": "pending",
      "pm-review": "pending",
      compliance: "pending",
      final: "pending",
    },
    signOffs: [],
    checks: [
      { key: "dod", label: "Day-on-day move", band: "±50 bps", bandMin: -50, bandMax: 50, observedNum: 119, observed: "+119 bps", status: "fail", detail: "Outside band — investigate before trial signs." },
      { key: "bmk", label: "vs Benchmark", band: "±30 bps", bandMin: -30, bandMax: 30, observedNum: 83, observed: "+83 bps", status: "fail", detail: "Exceeds tracking budget." },
      { key: "fxfix", label: "FX fix coverage", band: "100%", observed: "100%", status: "pass", detail: "Complete." },
      { key: "pricesrc", label: "Stale prices", band: "0", observed: "5", status: "warn", detail: "Off-the-run ABS tranches awaiting price." },
      { key: "manual", label: "Manual overrides", band: "0", observed: "0", status: "pass", detail: "None." },
    ],
    exceptions: [
      {
        id: "EX-120",
        stage: "trial",
        raisedAt: "17:25",
        raisedBy: "Trial engine",
        severity: "block",
        summary: "Day-on-day move +119 bps breaches band",
        detail: "ABS sleeve repriced after a CLO mark refresh. Need pricing committee review before trial NAV signs.",
        proposedAction: "Pricing committee review; if material, restate prior-day for like-for-like.",
        status: "open",
      },
    ],
    minutesToCut: 4,
  },
];

const SEV: Record<
  Exception["severity"],
  { label: string; pill: string; ring: string; dot: string }
> = {
  info: { label: "Info", pill: "bg-neutral-100 text-neutral-700", ring: "ring-neutral-200", dot: "bg-neutral-400" },
  warn: { label: "Warning", pill: "bg-amber-50 text-amber-800", ring: "ring-amber-200", dot: "bg-amber-500" },
  block: { label: "Blocker", pill: "bg-rose-50 text-rose-800", ring: "ring-rose-200", dot: "bg-rose-500" },
};

/* ------------------------------------------------------------------ *
 * Formatters
 * ------------------------------------------------------------------ */

const ccyFmt = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
    notation: n >= 1_000_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(n);

const px = (n: number, ccy: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 2,
  }).format(n);

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const bps = (n: number) => `${n >= 0 ? "+" : ""}${n} bps`;

/* ------------------------------------------------------------------ *
 * Pipeline cell — chevron-style stage indicator.
 * ------------------------------------------------------------------ */

function StageCell({
  status,
  signOff,
  ownerLabel,
}: {
  status: StageStatus;
  signOff?: SignOff;
  ownerLabel: string;
}) {
  if (status === "signed" && signOff) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-emerald-50/60 px-2 py-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
          {signOff.initials}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide uppercase text-emerald-700">
            Signed
          </div>
          <div className="font-mono text-[10px] tabular-nums text-neutral-500">
            {signOff.at}
          </div>
        </div>
      </div>
    );
  }
  if (status === "in-progress") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-blue-50/60 px-2 py-1.5">
        <span className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide uppercase text-blue-700">
            In progress
          </div>
          <div className="text-[10px] text-neutral-500 truncate">
            {ownerLabel}
          </div>
        </div>
      </div>
    );
  }
  if (status === "exception") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-rose-50/60 px-2 py-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-semibold text-white">
          !
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-wide uppercase text-rose-700">
            Exception
          </div>
          <div className="text-[10px] text-neutral-500 truncate">{ownerLabel}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-neutral-300">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold tracking-wide uppercase text-neutral-400">
          Pending
        </div>
        <div className="text-[10px] text-neutral-400 truncate">{ownerLabel}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pipeline row — one fund, six stages flowing left → right.
 * ------------------------------------------------------------------ */

function PipelineRow({
  fund,
  selected,
  onSelect,
}: {
  fund: FundLine;
  selected: boolean;
  onSelect: () => void;
}) {
  const blocked = fund.stageStatus === "exception";
  const cIdx = STAGE_INDEX[fund.currentStage];
  const progress = (cIdx / (STAGES.length - 1)) * 100;
  const dodTone =
    Math.abs(fund.variancePct) > fund.varianceBand * 100
      ? "text-rose-700"
      : Math.abs(fund.variancePct) > fund.varianceBand * 50
        ? "text-amber-700"
        : "text-neutral-900";

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer border-b border-neutral-100 transition ${
        selected ? "bg-neutral-50" : "hover:bg-neutral-50/60"
      } ${blocked ? "ring-1 ring-inset ring-rose-100" : ""}`}
    >
      <div className="grid grid-cols-[200px_1fr_140px] items-center gap-4 px-4 py-3">
        {/* Fund identity */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-neutral-500 tabular-nums">
              {fund.code}
            </span>
            {blocked && (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase text-rose-700">
                Blocked
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
            {fund.name}
          </div>
          <div className="mt-0.5 text-[11px] tabular-nums text-neutral-500">
            {ccyFmt(fund.aum, fund.ccy)} AUM
          </div>
        </div>

        {/* Stage flow */}
        <div className="relative">
          {/* connecting rail */}
          <div className="absolute top-1/2 right-0 left-0 -z-0 h-px -translate-y-1/2 bg-neutral-200" />
          <div
            className="absolute top-1/2 left-0 -z-0 h-px -translate-y-1/2 bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
          <div className="relative z-10 grid grid-cols-6 gap-1.5">
            {STAGES.map((s) => (
              <StageCell
                key={s.key}
                status={fund.stageMap[s.key]}
                signOff={fund.signOffs.find((so) => so.stage === s.key)}
                ownerLabel={s.owner}
              />
            ))}
          </div>
        </div>

        {/* Day-on-day variance */}
        <div className="text-right">
          <div className={`text-base font-semibold tabular-nums ${dodTone}`}>
            {pct(fund.variancePct)}
          </div>
          <div className="text-[10px] tabular-nums text-neutral-500">
            band ±{(fund.varianceBand * 100).toFixed(0)}bp · bmk {pct(fund.bmkVariancePct)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tolerance check — bar visual when numeric; pill when categorical.
 * ------------------------------------------------------------------ */

function CheckBar({ check }: { check: ToleranceCheck }) {
  const tone =
    check.status === "pass"
      ? "bg-emerald-500"
      : check.status === "warn"
        ? "bg-amber-500"
        : "bg-rose-500";
  const textTone =
    check.status === "pass"
      ? "text-emerald-700"
      : check.status === "warn"
        ? "text-amber-700"
        : "text-rose-700";

  const hasBand =
    check.bandMin !== undefined &&
    check.bandMax !== undefined &&
    check.observedNum !== undefined;

  return (
    <div className="grid grid-cols-[1fr_220px_120px_60px] items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="font-medium text-neutral-800">{check.label}</div>
        <div className="text-[11px] text-neutral-500">{check.detail}</div>
      </div>
      <div>
        {hasBand ? (
          <BandBar
            min={check.bandMin!}
            max={check.bandMax!}
            value={check.observedNum!}
            tone={tone}
          />
        ) : (
          <div className="text-[11px] text-neutral-500">band {check.band}</div>
        )}
      </div>
      <div className={`text-right font-mono text-sm font-semibold tabular-nums ${textTone}`}>
        {check.observed}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
        <span className={`text-[10px] font-semibold tracking-wide uppercase ${textTone}`}>
          {check.status === "pass" ? "Pass" : check.status === "warn" ? "Warn" : "Fail"}
        </span>
      </div>
    </div>
  );
}

function BandBar({
  min,
  max,
  value,
  tone,
}: {
  min: number;
  max: number;
  value: number;
  tone: string;
}) {
  // Place 0 at centre. Map to 0–100% with max range = max(|min|, |max|).
  const range = Math.max(Math.abs(min), Math.abs(max));
  const clamped = Math.max(-range * 1.5, Math.min(range * 1.5, value));
  const pos = ((clamped + range * 1.5) / (range * 3)) * 100;
  // band edges
  const minPos = ((min + range * 1.5) / (range * 3)) * 100;
  const maxPos = ((max + range * 1.5) / (range * 3)) * 100;
  const outOfBand = value < min || value > max;
  return (
    <div className="relative h-5">
      <div className="absolute inset-y-2 right-0 left-0 rounded-full bg-neutral-100" />
      <div
        className="absolute inset-y-2 rounded-full bg-emerald-100"
        style={{ left: `${minPos}%`, width: `${maxPos - minPos}%` }}
      />
      <div
        className="absolute inset-y-1 w-px bg-neutral-400"
        style={{ left: "50%" }}
      />
      <div
        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${tone}`}
        style={{ left: `${pos}%` }}
        aria-label={`Observed ${value}`}
      />
      {outOfBand && (
        <span className="absolute -top-1.5 right-0 text-[9px] font-semibold uppercase text-rose-600">
          OOB
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Variance gauge — single hero gauge for the selected fund.
 * ------------------------------------------------------------------ */

function VarianceGauge({ fund }: { fund: FundLine }) {
  const range = fund.varianceBand * 100 * 1.5;
  const pos = ((fund.variancePct * 100 + range) / (range * 2)) * 100;
  const outOfBand = Math.abs(fund.variancePct) > fund.varianceBand;
  const tone = outOfBand
    ? "bg-rose-500"
    : Math.abs(fund.variancePct) > fund.varianceBand * 0.7
      ? "bg-amber-500"
      : "bg-emerald-500";
  const bandStart =
    ((-fund.varianceBand * 100 + range) / (range * 2)) * 100;
  const bandEnd = ((fund.varianceBand * 100 + range) / (range * 2)) * 100;
  const textTone = outOfBand
    ? "text-rose-700"
    : Math.abs(fund.variancePct) > fund.varianceBand * 0.7
      ? "text-amber-700"
      : "text-emerald-700";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
            Day-on-day variance
          </div>
          <div
            className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${textTone}`}
          >
            {pct(fund.variancePct)}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            band ±{(fund.varianceBand * 100).toFixed(0)} bps
          </div>
        </div>
        <div className="text-right text-[11px] tabular-nums text-neutral-500">
          <div>
            Price{" "}
            <span className="font-semibold text-neutral-800">
              {px(fund.pricePerShare, fund.ccy)}
            </span>
          </div>
          <div>
            Prior{" "}
            <span className="font-medium text-neutral-700">
              {px(fund.priorPrice, fund.ccy)}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 h-6">
        <div className="absolute inset-y-2 right-0 left-0 rounded-full bg-neutral-100" />
        <div
          className="absolute inset-y-2 rounded-full bg-emerald-100"
          style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
        />
        <div
          className="absolute inset-y-1 w-px bg-neutral-400"
          style={{ left: "50%" }}
        />
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ${tone}`}
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-400">
        <span>-{(fund.varianceBand * 150).toFixed(0)}bp</span>
        <span>0</span>
        <span>+{(fund.varianceBand * 150).toFixed(0)}bp</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-[11px]">
        <Mini label="NAV" value={ccyFmt(fund.nav, fund.ccy)} />
        <Mini label="vs Benchmark" value={pct(fund.bmkVariancePct)} />
        <Mini label="vs Forecast" value={bps(fund.forecastDeltaBps)} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Exception card
 * ------------------------------------------------------------------ */

function ExceptionCard({ ex }: { ex: Exception }) {
  const sev = SEV[ex.severity];
  return (
    <div
      className={`rounded-xl border-l-2 bg-white p-4 shadow-sm ring-1 ${sev.ring} ${
        ex.severity === "block"
          ? "border-l-rose-500"
          : ex.severity === "warn"
            ? "border-l-amber-500"
            : "border-l-neutral-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
              {sev.label}
            </span>
            <span className="font-mono text-[11px] font-semibold text-neutral-500 tabular-nums">
              {ex.id}
            </span>
            <span className="text-[11px] text-neutral-400">
              {STAGES.find((s) => s.key === ex.stage)?.label} ·{" "}
              <span className="tabular-nums">{ex.raisedAt}</span> · {ex.raisedBy}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-neutral-900">
            {ex.summary}
          </div>
          <p className="mt-1 text-xs leading-snug text-neutral-600">
            {ex.detail}
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold tracking-wide uppercase text-neutral-500">
          {ex.status.replace("-", " ")}
        </span>
      </div>

      <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
        <span className="font-semibold text-neutral-700">Proposed: </span>
        {ex.proposedAction}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Override with rationale
        </button>
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800"
        >
          Clear exception
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function NavSignoff() {
  const [selectedCode, setSelectedCode] = useState<string>(FUNDS[0].code);

  const selected = useMemo(
    () => FUNDS.find((f) => f.code === selectedCode) ?? FUNDS[0],
    [selectedCode],
  );

  const batch = useMemo(() => {
    const totalNav = FUNDS.reduce((acc, f) => acc + f.nav, 0);
    const exceptions = FUNDS.reduce((acc, f) => acc + f.exceptions.length, 0);
    const blocked = FUNDS.filter((f) => f.stageStatus === "exception").length;
    const finalSigned = FUNDS.filter((f) => f.stageMap.final === "signed").length;
    const avg =
      FUNDS.reduce(
        (acc, f) =>
          acc +
          STAGE_INDEX[f.currentStage] +
          (f.stageMap[f.currentStage] === "signed" ? 1 : 0),
        0,
      ) /
      FUNDS.length /
      STAGES.length;
    return {
      totalNav,
      exceptions,
      blocked,
      finalSigned,
      progress: Math.round(avg * 100),
    };
  }, []);

  const blocked = selected.stageStatus === "exception";
  const stage = STAGES.find((s) => s.key === selected.currentStage)!;
  const isFinal = selected.currentStage === "final";

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-500">
                <span>Daily strike</span>
                <span aria-hidden className="text-neutral-300">/</span>
                <span className="text-neutral-700">NAV Sign-off</span>
              </nav>
              <div className="mt-2 flex items-baseline gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
                  19 May 2026 · 18:00 strike
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  Cut in 4 min
                </span>
              </div>
              <p className="mt-1 max-w-prose text-sm text-neutral-600">
                Chair the strike. Sign each gate, clear exceptions before they
                block, publish before the cut.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Audit trail
              </button>
              <button
                type="button"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Request delay
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Publish all green
              </button>
            </div>
          </div>

          {/* Batch rollup */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Funds in batch"
              value={String(FUNDS.length)}
              hint={`${batch.finalSigned} signed · ${batch.blocked} blocked`}
            />
            <Kpi
              label="Total NAV"
              value={ccyFmt(batch.totalNav, "USD")}
              hint="USD-equivalent"
            />
            <Kpi
              label="Open exceptions"
              value={String(batch.exceptions)}
              hint={`across ${batch.blocked} fund(s)`}
              tone={batch.exceptions ? "amber" : "emerald"}
            />
            <Kpi
              label="Batch progress"
              value={`${batch.progress}%`}
              hint="average stage completion"
              tone={batch.progress > 70 ? "emerald" : "amber"}
              progress={batch.progress}
            />
          </div>
        </div>

        {/* Stage legend strip */}
        <div className="flex items-center gap-4 border-t border-neutral-100 bg-neutral-50/60 px-8 py-2.5 text-[11px]">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-400">
            Pipeline stages
          </span>
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200 font-mono text-[9px] font-semibold text-neutral-700">
                {i + 1}
              </span>
              <span className="font-medium text-neutral-700">{s.label}</span>
              <span className="text-neutral-400">· {s.owner}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="grid flex-1 grid-cols-[1fr_440px] overflow-hidden">
        {/* Pipeline */}
        <div className="flex h-full flex-col overflow-y-auto px-8 py-5">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                Pipeline
              </h2>
              <span className="text-[11px] text-neutral-500">
                Click a fund to inspect tolerance checks and sign its current gate.
              </span>
            </div>
            <div>
              {FUNDS.map((f) => (
                <PipelineRow
                  key={f.code}
                  fund={f}
                  selected={f.code === selectedCode}
                  onSelect={() => setSelectedCode(f.code)}
                />
              ))}
            </div>
          </div>

          {/* Tolerance checks */}
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Tolerance checks · {selected.name}
                </h2>
                <div className="text-[11px] text-neutral-500">
                  Each check must pass before the gate signs — or be overridden
                  with rationale.
                </div>
              </div>
              <div className="hidden grid-cols-[1fr_220px_120px_60px] gap-3 px-4 text-[10px] font-semibold tracking-wider uppercase text-neutral-400 md:grid">
                <span>Check</span>
                <span>Band</span>
                <span className="text-right">Observed</span>
                <span className="text-right">Status</span>
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {selected.checks.map((c) => (
                <CheckBar key={c.key} check={c} />
              ))}
            </div>
          </div>

          {/* Exceptions */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Exceptions
                <span className="ml-2 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-700">
                  {selected.exceptions.length}
                </span>
              </h2>
              <span className="text-[11px] text-neutral-500">
                Block sign-off until cleared or overridden.
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {selected.exceptions.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-6 text-center">
                  <div className="text-2xl">✓</div>
                  <div className="mt-1 text-sm font-medium text-emerald-800">
                    All clear on this fund
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    No tolerance breaks, no manual flags.
                  </div>
                </div>
              ) : (
                selected.exceptions.map((ex) => (
                  <ExceptionCard key={ex.id} ex={ex} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right rail — variance hero + audit + sticky sign-off */}
        <aside className="flex h-full min-h-0 flex-col border-l border-neutral-200 bg-white">
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
            {/* Fund header */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-neutral-500 tabular-nums">
                  {selected.code}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    blocked
                      ? "bg-rose-50 text-rose-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${blocked ? "bg-rose-500" : "bg-blue-500"}`}
                  />
                  {blocked ? "Exception" : "In progress"}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-950">
                {selected.name}
              </h2>
              <p className="text-[11px] text-neutral-500">
                At <span className="font-medium text-neutral-700">{stage.label}</span> · owned by {stage.owner}
              </p>
            </div>

            {/* Variance gauge hero */}
            <div className="mt-4">
              <VarianceGauge fund={selected} />
            </div>

            {/* Audit trail */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  Audit trail
                </h3>
                <span className="text-[10px] text-neutral-400 tabular-nums">
                  {selected.signOffs.length} of {STAGES.length} signed
                </span>
              </div>
              <ol className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3">
                {selected.signOffs.length === 0 && (
                  <li className="text-xs text-neutral-400">
                    No sign-offs yet — start with the trial NAV.
                  </li>
                )}
                {selected.signOffs.map((so) => (
                  <li key={so.stage} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
                      {so.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs">
                        <span className="font-semibold text-neutral-900">
                          {STAGES.find((s) => s.key === so.stage)?.label}
                        </span>
                        <span className="text-neutral-400"> signed at </span>
                        <span className="font-mono tabular-nums text-neutral-700">
                          {so.at}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {so.who}
                        {so.note && (
                          <span className="text-neutral-400"> — <em>{so.note}</em></span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Sticky sign-off panel */}
          <div className="border-t border-neutral-200 bg-neutral-50/60 px-5 py-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                  Current gate
                </div>
                <div className="text-sm font-semibold text-neutral-900">
                  {stage.label}{" "}
                  <span className="text-neutral-400">· {stage.owner}</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide uppercase ${
                  blocked ? "text-rose-700" : "text-blue-700"
                }`}
              >
                {blocked ? "Blocked" : "Ready to sign"}
              </span>
            </div>

            <textarea
              rows={2}
              placeholder="Sign-off note (optional) — e.g. P&L attribution reconciled"
              className="mt-3 w-full resize-none rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:border-neutral-400 focus:outline-none"
            />

            <div className="mt-3 grid grid-cols-[1fr_120px] gap-2">
              <button
                type="button"
                disabled={blocked}
                className={`rounded-md px-3 py-2 text-xs font-semibold shadow-sm ${
                  blocked
                    ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
                    : isFinal
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
              >
                {blocked
                  ? "Resolve exceptions first"
                  : isFinal
                    ? "Strike & publish NAV"
                    : "Sign · advance to next gate"}
              </button>
              <button
                type="button"
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Send back
              </button>
            </div>
            <div className="mt-2 text-[10px] tabular-nums text-neutral-500">
              Cut in {selected.minutesToCut}m · sign-off is auditable and timestamped
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  progress,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "amber" | "rose" | "emerald";
  progress?: number;
}) {
  const valueTone =
    tone === "amber"
      ? "text-amber-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-neutral-950";
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
        {label}
      </span>
      <span
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}
      >
        {value}
      </span>
      {hint && (
        <span className="mt-1 text-[11px] text-neutral-500">{hint}</span>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full ${
              tone === "amber" ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
