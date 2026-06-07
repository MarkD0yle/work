import { useState, type ReactNode } from "react";

export const title = "Payments Center";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Payments Center — client-facing operations dashboard.
 *
 * Layout follows the rest of the workspace: sticky header, neutral
 * canvas, rounded-2xl cards on white, mono tabular numerals for every
 * money figure. Colour is reserved for action — neutral by default,
 * amber for thin, red for breach, sky for inflow, emerald for healthy
 * deltas. Generous padding (px-10, py-8, gap-8) gives this dashboard
 * room to breathe at the institutional density it carries.
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * Mock data — chosen to match the rough screens 1:1 so the content
 * round-trips with the brief.
 * ================================================================== */

type Rail = "RTP" | "ACH" | "Fedwire" | "SWIFT" | "SEPA";

const RAIL_MIX: { rail: Rail; share: number; color: string }[] = [
  { rail: "SWIFT", share: 43, color: "#0f1f3d" },
  { rail: "ACH", share: 29, color: "#1e63d9" },
  { rail: "SEPA", share: 14, color: "#1f9d6f" },
  { rail: "RTP", share: 8, color: "#1ab6b6" },
  { rail: "Fedwire", share: 6, color: "#c8932b" },
];

const FORECAST_DAYS = [
  { label: "May 9", projected: 31.2, actual: 31.4 },
  { label: "May 10", projected: 32.0, actual: 32.1 },
  { label: "May 11", projected: 31.6, actual: 31.7 },
  { label: "May 12", projected: 33.0, actual: 33.2 },
  { label: "May 13", projected: 34.0, actual: 34.1 },
  { label: "May 14", projected: 36.4, actual: 36.5 },
  { label: "May 15", projected: 42.2, actual: null as number | null },
];

const FLOWS = [
  { day: "Mon", in: 3.6, out: 2.4 },
  { day: "Tue", in: 5.1, out: 3.2 },
  { day: "Wed", in: 3.4, out: 4.0 },
  { day: "Thu", in: 5.6, out: 2.8 },
  { day: "Fri", in: 6.4, out: 5.2 },
  { day: "Sat", in: 0.9, out: 0.7 },
  { day: "Sun", in: 0.5, out: 0.4 },
];

interface NextAction {
  title: string;
  blurb: string;
  metrics: { label: string; value: number; tone: "info" | "muted" | "warn" }[];
  cta: string;
  pill: string;
}

const NEXT_ACTIONS: NextAction[] = [
  {
    title: "Sweep idle EUR to payroll cover",
    blurb:
      "Move €1.8M from low-yield concentration to next-week USD payroll funding window. Reduces overdraft risk and FX slippage.",
    pill: "Projected annualised savings · $146K",
    metrics: [
      { label: "Savings confidence", value: 88, tone: "info" },
      { label: "Operational lift", value: 76, tone: "info" },
      { label: "Execution readiness", value: 92, tone: "info" },
    ],
    cta: "Review sweep plan",
  },
  {
    title: "Consolidate duplicate payment rails",
    blurb:
      "Route low-value cross-border supplier payments from SWIFT to SEPA corridors where available to reduce fee leakage.",
    pill: "Estimated fee reduction · 11.4%",
    metrics: [
      { label: "Fee optimization", value: 84, tone: "info" },
      { label: "Change complexity", value: 41, tone: "warn" },
      { label: "Policy fit", value: 89, tone: "info" },
    ],
    cta: "Simulate reroute",
  },
  {
    title: "Auto-resolve repetitive exceptions",
    blurb:
      "58 exception patterns are near-identical this quarter. Promote approved patterns into policy rules to cut manual review.",
    pill: "Manual reduction · 9.2 hrs/week",
    metrics: [
      { label: "Pattern certainty", value: 91, tone: "info" },
      { label: "Risk containment", value: 86, tone: "info" },
      { label: "Approval readiness", value: 79, tone: "info" },
    ],
    cta: "Create policy draft",
  },
];

const INSIGHT_LADDER = [
  {
    label: "Visibility",
    value: 100,
    note: "Realtime balances synced across 14 banks",
  },
  {
    label: "Insight",
    value: 75,
    note: "3 optimisations detected by State Street IQ™",
  },
  {
    label: "Decision",
    value: 45,
    note: "2 awaiting your approval",
  },
  {
    label: "Action",
    value: 20,
    note: "1 sweep ready to execute",
  },
];

const SHORTFALLS = [
  {
    ccy: "EUR",
    amount: "€1.24M",
    acct: "EMEA Receivables · ••••4490",
    when: "Today 16:00 CET",
    severity: "warn" as const,
  },
  {
    ccy: "GBP",
    amount: "£0.42M",
    acct: "Vendor Reserve · ••••6213",
    when: "Tomorrow 09:00 BST",
    severity: "warn" as const,
  },
  {
    ccy: "USD",
    amount: "$0.31M",
    acct: "US Tax Escrow · ••••2725",
    when: "Tomorrow 14:00 ET",
    severity: "muted" as const,
  },
];

const APPROVAL_HEATMAP: {
  band: "Coming due" | "Late";
  high: number;
  medium: number;
  low: number;
}[] = [
  { band: "Coming due", high: 11, medium: 11, low: 6 },
  { band: "Late", high: 1, medium: 0, low: 5 },
];

/* ================================================================== *
 * Helpers
 * ================================================================== */

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function PaymentsCenter() {
  const [forecastWindow, setForecastWindow] = useState<"7d" | "30d" | "90d">(
    "7d",
  );
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-5 border-b border-neutral-200 bg-white px-12">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Payments Center
          </span>
          <span className="text-xs text-neutral-400">
            Operations · client-facing
          </span>
        </div>

        <ClientPicker />

        <div className="relative ml-3 min-w-[260px] flex-1 max-w-[640px]">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 3.473 9.78l2.624 2.624a.75.75 0 1 0 1.06-1.06l-2.624-2.624A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <input
            placeholder="Search accounts, payments, references, beneficiaries…"
            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pr-10 pl-9 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white focus:outline-none"
          />
          <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
            ⌘K
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPaymentOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
          </svg>
          Initiate payment
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-12 py-10">
          {/* ---------- Smart insight banner ---------- */}
          {!insightDismissed && (
            <SmartInsight onDismiss={() => setInsightDismissed(true)} />
          )}

          {/* ---------- KPI strip ---------- */}
          {/* KPI tiles use p-6 / gap-5 — a half-step denser than the
              gap-6 / p-7 content cards below, since they carry a single
              number each and look airy at the full content-card spacing. */}
          <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
            <Kpi
              label="Total liquidity (USD eq.)"
              value="$32.54M"
              delta={{ value: "+0.1%", trend: "up" }}
              hint="vs. yesterday"
              accent="trend"
            />
            <Kpi
              label="Payments today"
              value="$7.99M"
              delta={{ value: "+5.0%", trend: "up" }}
              hint="196 transactions"
              accent="pulse"
            />
            <Kpi
              label="STP rate"
              value="98.4%"
              delta={{ value: "−0.4%", trend: "down" }}
              hint="last 30d avg."
              accent="sparkle"
            />
            <Kpi
              label="Exceptions open"
              value="10"
              delta={{ value: "−14.3%", trend: "down" }}
              hint="vs. last week"
              accent="alert"
            />
          </div>

          {/* ---------- Next best actions ---------- */}
          <Section
            className="mt-10"
            eyebrow="Next best actions"
            title="Senior payment agent recommendations"
            sub="Based on current liquidity, rail usage, and exception patterns."
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {NEXT_ACTIONS.map((a) => (
                <NextActionCard key={a.title} action={a} />
              ))}
            </div>
          </Section>

          {/* ---------- Forecast + rail mix ---------- */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <LiquidityForecast
              window={forecastWindow}
              onWindowChange={setForecastWindow}
            />
            <PaymentsByRail />
          </div>

          {/* ---------- Flows + insight ladder ---------- */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <InflowsOutflows />
            <InsightToAction />
          </div>

          {/* ---------- Cash at risk + shortfalls ---------- */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CashAtRisk />
            <ShortfallAlerts />
          </div>

          {/* ---------- Bottlenecks + heatmap ---------- */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ApprovalBottlenecks />
            <ApprovalHeatmap />
          </div>

          <Footnote />
        </div>
      </div>

      {paymentOpen && (
        <InitiatePaymentModal onClose={() => setPaymentOpen(false)} />
      )}
    </div>
  );
}

/* ================================================================== *
 * Atoms — Badge, Section, Kpi
 * ================================================================== */

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "muted" | "info" | "warning" | "error" | "ok";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    muted: "bg-neutral-50 text-neutral-500 ring-neutral-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    error: "bg-red-50 text-red-700 ring-red-200",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Section({
  className = "",
  eyebrow,
  title,
  sub,
  right,
  children,
}: {
  className?: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      {(eyebrow || title || right) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-neutral-900">
                {title}
              </h2>
            )}
            {eyebrow && !title && (
              <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                {eyebrow}
              </h2>
            )}
            {sub && (
              <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  delta,
  hint,
  accent,
}: {
  label: string;
  value: string;
  delta: { value: string; trend: "up" | "down" | "flat" };
  hint: string;
  accent: "trend" | "pulse" | "sparkle" | "alert";
}) {
  const trendColor =
    delta.trend === "up"
      ? "text-emerald-600"
      : delta.trend === "down"
        ? "text-red-600"
        : "text-neutral-500";

  const accentDot: Record<typeof accent, string> = {
    trend: "bg-emerald-400",
    pulse: "bg-sky-400",
    sparkle: "bg-emerald-400",
    alert: "bg-amber-400",
  };

  return (
    <div className="group rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          {label}
        </div>
        <span
          className={`h-2 w-2 rounded-full ${accentDot[accent]} ring-2 ring-white`}
          aria-hidden
        />
      </div>
      <div className="mt-3 font-mono text-3xl leading-none font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-mono text-xs font-semibold ${trendColor}`}>
          {delta.value}
        </span>
        <span className="text-[11px] text-neutral-400">{hint}</span>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Smart insight banner
 * ================================================================== */

function SmartInsight({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-white p-7">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M11 2a1 1 0 0 0-1.78-.64L4.4 7.34a1 1 0 0 0 .79 1.61h3.31L7.78 17.6a1 1 0 0 0 1.78.65l4.81-6a1 1 0 0 0-.78-1.62h-3.31L11 2Z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-sky-900">
            Smart insight
          </span>
          <span className="font-mono text-[11px] text-sky-700/70">12:42 PM</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">
          EUR concentration is{" "}
          <span className="font-semibold text-neutral-900">8.4%</span> above
          your target. Consider sweeping{" "}
          <span className="font-semibold text-neutral-900">€1.2M</span> to USD
          operating to fund tomorrow&rsquo;s payroll run.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          Review sweep
        </button>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Next best action card
 * ================================================================== */

function NextActionCard({ action }: { action: NextAction }) {
  // Split "Projected annualised savings · $146K" into eyebrow + hero number.
  // Falls back gracefully if the separator is absent.
  const [eyebrow, hero] = action.pill.includes(" · ")
    ? action.pill.split(" · ")
    : ["Outcome", action.pill];

  return (
    <div className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-7 transition hover:border-neutral-300 hover:shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">{action.title}</h3>

      {/* Hero outcome — the number the user is here for, promoted from a pill. */}
      <div className="mt-3">
        <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          {eyebrow}
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-neutral-900">
          {hero}
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-500">
        {action.blurb}
      </p>

      {/* Score row — three confidence signals on one line. Dot encodes tier
          (good / neutral / watch); the number carries the exact value. No
          progress-bar semantics because these are not progress. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-4">
        {action.metrics.map((m) => (
          <ScoreChip
            key={m.label}
            label={m.label}
            value={m.value}
            tone={m.tone}
          />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          <span className="font-mono">▸</span>
          {action.cta}
        </button>
      </div>
    </div>
  );
}

function ScoreChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "muted" | "warn";
}) {
  const dot =
    tone === "warn"
      ? "bg-amber-500"
      : tone === "muted"
        ? "bg-neutral-400"
        : "bg-emerald-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-neutral-900">
        {value}
      </span>
    </span>
  );
}

/* ================================================================== *
 * Liquidity forecast (SVG area)
 * ================================================================== */

function LiquidityForecast({
  window,
  onWindowChange,
}: {
  window: "7d" | "30d" | "90d";
  onWindowChange: (w: "7d" | "30d" | "90d") => void;
}) {
  const W = 720;
  const H = 240;
  const PAD = { t: 18, r: 18, b: 28, l: 38 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const series = FORECAST_DAYS;
  const allValues = series.flatMap((d) => [d.projected, d.actual ?? d.projected]);
  const lo = 0;
  const hi = Math.ceil(Math.max(...allValues) / 10) * 10;
  const span = hi - lo || 1;

  const x = (i: number) => PAD.l + (i / (series.length - 1)) * plotW;
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * plotH;

  const projPath = series
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.projected).toFixed(1)}`,
    )
    .join(" ");
  const areaPath =
    `${projPath} L ${x(series.length - 1).toFixed(1)} ${y(lo).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${y(lo).toFixed(1)} Z`;

  const actualPoints = series
    .map((d, i) => (d.actual != null ? { i, v: d.actual } : null))
    .filter(Boolean) as { i: number; v: number }[];
  const actualPath = actualPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");

  const ticks = [0, hi / 4, hi / 2, (3 * hi) / 4, hi];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Liquidity forecast
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Projected vs. actual closing balance
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {(["7d", "30d", "90d"] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindowChange(w)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                window === w
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img">
        <defs>
          <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8932b" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#c8932b" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 8}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-neutral-400 font-mono"
              fontSize={9}
            >
              ${t.toFixed(0)}M
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#forecastFill)" />
        <path
          d={projPath}
          fill="none"
          stroke="#c8932b"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="#1e63d9"
            strokeWidth={2}
            strokeDasharray="3 3"
            strokeLinejoin="round"
          />
        )}

        {/* projected dots */}
        {series.map((d, i) => (
          <circle
            key={`p-${i}`}
            cx={x(i)}
            cy={y(d.projected)}
            r={3}
            fill="white"
            stroke="#c8932b"
            strokeWidth={2}
          />
        ))}
        {/* actual dots */}
        {actualPoints.map((p) => (
          <circle
            key={`a-${p.i}`}
            cx={x(p.i)}
            cy={y(p.v)}
            r={2.5}
            fill="#1e63d9"
          />
        ))}

        {/* x labels */}
        {series.map((d, i) => (
          <text
            key={d.label}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            className="fill-neutral-400 font-mono"
            fontSize={9}
          >
            {d.label}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex items-center justify-center gap-5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#c8932b]" /> Projected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 bg-[#1e63d9]" /> Actual
        </span>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Payments by rail (donut)
 * ================================================================== */

function PaymentsByRail() {
  const SIZE = 220;
  const R_OUT = 92;
  const R_IN = 60;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  let acc = 0;
  const arcs = RAIL_MIX.map((m) => {
    const start = acc;
    acc += m.share;
    const end = acc;
    return { ...m, start, end };
  });

  function arcPath(start: number, end: number) {
    const a0 = (start / 100) * Math.PI * 2 - Math.PI / 2;
    const a1 = (end / 100) * Math.PI * 2 - Math.PI / 2;
    const x0 = CX + R_OUT * Math.cos(a0);
    const y0 = CY + R_OUT * Math.sin(a0);
    const x1 = CX + R_OUT * Math.cos(a1);
    const y1 = CY + R_OUT * Math.sin(a1);
    const x2 = CX + R_IN * Math.cos(a1);
    const y2 = CY + R_IN * Math.sin(a1);
    const x3 = CX + R_IN * Math.cos(a0);
    const y3 = CY + R_IN * Math.sin(a0);
    const large = end - start > 50 ? 1 : 0;
    return [
      `M ${x0} ${y0}`,
      `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `A ${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}`,
      "Z",
    ].join(" ");
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Payments by rail
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Volume mix · trailing 7d
          </p>
        </div>
        <Badge tone="muted">196 txns</Badge>
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-6">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-[220px]" role="img">
          {arcs.map((a) => (
            <path key={a.rail} d={arcPath(a.start, a.end)} fill={a.color} />
          ))}
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            className="fill-neutral-400 font-mono"
            fontSize={9}
          >
            TOTAL
          </text>
          <text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            className="fill-neutral-900 font-mono font-semibold"
            fontSize={16}
          >
            $7.99M
          </text>
        </svg>

        <ul className="flex flex-col gap-2.5">
          {RAIL_MIX.map((m) => (
            <li
              key={m.rail}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2 text-xs text-neutral-700">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: m.color }}
                />
                {m.rail}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-neutral-900">
                {m.share}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Inflows / outflows
 * ================================================================== */

function InflowsOutflows() {
  const W = 560;
  const H = 240;
  const PAD = { t: 18, r: 12, b: 28, l: 38 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const hi = Math.ceil(Math.max(...FLOWS.flatMap((f) => [f.in, f.out])));
  const span = hi || 1;
  const groupW = plotW / FLOWS.length;
  const barW = (groupW - 14) / 2;

  const y = (v: number) => PAD.t + (1 - v / span) * plotH;
  const ticks = [0, hi / 4, hi / 2, (3 * hi) / 4, hi];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Inflows vs outflows
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Daily, last 7 days · USD eq.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-neutral-800" /> Outflow
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(t)}
              y2={y(t)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 8}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-neutral-400 font-mono"
              fontSize={9}
            >
              ${t.toFixed(0)}M
            </text>
          </g>
        ))}

        {FLOWS.map((f, i) => {
          const gx = PAD.l + i * groupW + 7;
          return (
            <g key={f.day}>
              <rect
                x={gx}
                y={y(f.in)}
                width={barW}
                height={y(0) - y(f.in)}
                rx={1}
                fill="#1f9d6f"
              />
              <rect
                x={gx + barW + 4}
                y={y(f.out)}
                width={barW}
                height={y(0) - y(f.out)}
                rx={1}
                fill="#0f1f3d"
              />
              <text
                x={gx + barW + 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-neutral-500 font-mono"
                fontSize={9}
              >
                {f.day}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

/* ================================================================== *
 * From insight to action — progress ladder
 * ================================================================== */

function InsightToAction() {
  // Compute the drop between each successive stage, then find which stage
  // RECEIVES the biggest fall-off — that's the bottleneck the user can act on.
  const drops = INSIGHT_LADDER.slice(1).map(
    (s, i) => INSIGHT_LADDER[i].value - s.value,
  );
  const maxDropIdx = drops.indexOf(Math.max(...drops));
  const bottleneckStageIdx = maxDropIdx + 1;
  const bottleneck = INSIGHT_LADDER[bottleneckStageIdx];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            From insight to action
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Where this client is in the optimisation funnel
          </p>
        </div>
        <Badge tone="info">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
          live
        </Badge>
      </div>

      <ol className="mt-6 flex flex-col">
        {INSIGHT_LADDER.map((stage, i) => {
          const isBottleneck = i === bottleneckStageIdx;
          const drop = i > 0 ? drops[i - 1] : null;
          const isLast = i === INSIGHT_LADDER.length - 1;

          return (
            <li
              key={stage.label}
              className="grid grid-cols-[28px_1fr] gap-x-3"
            >
              {/* Left rail — numbered node + connector line. The line ties
                  the four stages together as a single funnel, not four
                  independent rows. */}
              <div className="flex flex-col items-center">
                <span
                  className={`relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset ${
                    isBottleneck
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-white text-neutral-600 ring-neutral-200"
                  }`}
                >
                  {i + 1}
                </span>
                {!isLast && (
                  <span className="-mt-px w-px flex-1 bg-neutral-200" />
                )}
              </div>

              {/* Stage row */}
              <div className={isLast ? "" : "pb-4"}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-neutral-900">
                    {stage.label}
                  </span>
                  <div className="flex items-baseline gap-2.5">
                    {drop !== null && (
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          isBottleneck
                            ? "font-semibold text-amber-700"
                            : "text-neutral-400"
                        }`}
                      >
                        ↓{drop}
                      </span>
                    )}
                    <span className="font-mono text-sm font-semibold tabular-nums text-neutral-900">
                      {stage.value}
                      <span className="text-neutral-400">%</span>
                    </span>
                  </div>
                </div>

                {/* Thin bar — all rows on the same 0–100 scale, so the
                    descending widths form an obvious funnel cascade. */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${
                      isBottleneck ? "bg-amber-500" : "bg-neutral-700"
                    }`}
                    style={{ width: `${stage.value}%` }}
                  />
                </div>

                <div className="mt-1.5 text-[11px] text-neutral-500">
                  {stage.note}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Bottleneck call-out — names the friction in plain English so the
          panel pays for its own real estate even before the user reads
          the stages. */}
      <p className="mt-2 border-t border-neutral-100 pt-4 text-[11px] leading-relaxed text-neutral-600">
        Biggest fall-off is into{" "}
        <span className="font-semibold text-amber-700">{bottleneck.label}</span>{" "}
        <span className="font-mono font-semibold text-amber-700">
          (−{drops[maxDropIdx]} pts)
        </span>
        {" "}— {bottleneck.note.toLowerCase()}.
      </p>
    </section>
  );
}

/* ================================================================== *
 * Cash at risk
 * ================================================================== */

function CashAtRisk() {
  // Numbers reconciled with the existing copy: shortfall $5.5M against
  // a $37M 24h minimum implies a projected trough of $31.5M; same logic
  // for the 7d window. Trough times match the timing already shown in
  // the Expected shortfall alerts panel so the two reads agree.
  const RISKS = [
    {
      horizon: "Next 24h",
      projected: 31.5,
      threshold: 37,
      shortfall: 5.5,
      troughAt: "Wed 14:30 ET",
      tone: "amber" as const,
      hint: "Fund before 13:00 ET cutoff",
    },
    {
      horizon: "Next 7d",
      projected: 31.5,
      threshold: 40,
      shortfall: 8.5,
      troughAt: "Fri 09:00 BST",
      tone: "red" as const,
      hint: "Plan funding before Thu EU close",
    },
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Cash position at risk
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Projected trough vs operating minimum
          </p>
        </div>
        <Badge tone="error">2 projected breaches</Badge>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {RISKS.map((r) => (
          <RiskRow key={r.horizon} {...r} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          Raise FX swap
        </button>
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Draw on facility
        </button>
        <span className="ml-auto text-[11px] text-neutral-400">
          Operating minimums set per CCY in policy
        </span>
      </div>
    </section>
  );
}

function RiskRow({
  horizon,
  projected,
  threshold,
  shortfall,
  troughAt,
  tone,
  hint,
}: {
  horizon: string;
  projected: number;
  threshold: number;
  shortfall: number;
  troughAt: string;
  tone: "amber" | "red";
  hint: string;
}) {
  // Scale runs from $0 to threshold + 30% headroom so the threshold tick
  // sits visibly to the left of the right edge, and the empty space past
  // it reads as "buffer you don't have."
  const scaleMax = threshold * 1.3;
  const projectedPct = (projected / scaleMax) * 100;
  const thresholdPct = (threshold / scaleMax) * 100;

  const fill = tone === "red" ? "bg-red-500" : "bg-amber-500";
  const valueColor = tone === "red" ? "text-red-700" : "text-amber-700";

  return (
    <div>
      {/* Header line: horizon left, trough time right — the two pieces of
          context the eye needs before reading the number. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
          {horizon}
        </span>
        <span className="font-mono text-[11px] text-neutral-500">
          Trough{" "}
          <span className="font-semibold text-neutral-800">{troughAt}</span>
        </span>
      </div>

      {/* Hero — projected number leads, shortfall vs threshold sits right
          next to it so the user reads "$31.5M projected, $5.5M short" as
          one sentence. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-2xl font-semibold tabular-nums ${valueColor}`}
          >
            ${projected.toFixed(1)}M
          </span>
          <span className="text-[11px] text-neutral-500">projected</span>
        </div>
        <span className={`font-mono text-xs font-semibold ${valueColor}`}>
          −${shortfall.toFixed(1)}M vs ${threshold}M min
        </span>
      </div>

      {/* Threshold gauge — bar fills to projected; vertical tick marks
          the operating minimum. The visual gap between bar-end and tick
          IS the shortfall, so users read magnitude geometrically before
          they read the number. */}
      <div className="relative mt-3 h-2 w-full rounded-full bg-neutral-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${fill}`}
          style={{ width: `${clamp(projectedPct)}%` }}
        />
        <div
          className="absolute -top-1 -bottom-1 flex flex-col items-center"
          style={{ left: `${clamp(thresholdPct)}%` }}
        >
          <span className="h-full w-px bg-neutral-700" />
        </div>
      </div>

      {/* Scale endpoints — anchor the gauge in real numbers. The
          threshold itself is labelled inline with the shortfall above
          ("vs $37M min"), so no need to repeat it on the axis. */}
      <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-400">
        <span>$0</span>
        <span>${Math.round(scaleMax)}M</span>
      </div>

      {/* Action hint — tells the user what to do without taking them off
          the dashboard. Mirrors the LiquidityLadder "read" pattern. */}
      <div className="mt-3 text-[11px] text-neutral-600">
        <span className="font-medium text-neutral-700">→</span> {hint}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Shortfall alerts
 * ================================================================== */

function ShortfallAlerts() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Expected shortfall alerts
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Accounts forecast below operating minimum
          </p>
        </div>
        <Badge tone="muted">{SHORTFALLS.length} accounts</Badge>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {SHORTFALLS.map((s) => (
          <li
            key={s.acct}
            className="flex items-center gap-4 rounded-xl border border-neutral-100 bg-neutral-50/40 px-4 py-3"
          >
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
                s.severity === "warn"
                  ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 ring-inset"
                  : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 ring-inset"
              }`}
            >
              {s.ccy}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-neutral-900">
                  {s.ccy} shortfall
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-neutral-900">
                  {s.amount}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                {s.acct}
              </div>
            </div>
            <span
              className={`shrink-0 font-mono text-[11px] ${
                s.severity === "warn" ? "text-amber-700" : "text-neutral-500"
              }`}
            >
              {s.when}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================================== *
 * Approval bottlenecks
 * ================================================================== */

function ApprovalBottlenecks() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Approval bottlenecks
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Workflow queue exposure
          </p>
        </div>
        <Badge tone="muted">12 in queue</Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <BottleneckTile label="Due today" value="12" tone="warn" />
        <BottleneckTile label="Blocked" value="1 of 2" tone="neutral" />
        <BottleneckTile label="Backlog value" value="$62.0M" tone="neutral" />
      </div>

      <p className="mt-6 border-t border-neutral-100 pt-4 text-[11px] leading-relaxed text-neutral-500">
        Concentration is highest in{" "}
        <span className="font-medium text-neutral-700">
          dual-approval workflows
        </span>{" "}
        initiated during EU close. Suggested mitigation: pre-stage at 13:00 CET.
      </p>
    </section>
  );
}

function BottleneckTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "warn";
}) {
  const accent = tone === "warn" ? "border-l-amber-500" : "border-l-neutral-300";
  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Approval heatmap
 * ================================================================== */

function ApprovalHeatmap() {
  const cell = (n: number, sev: "high" | "medium" | "low") => {
    if (n === 0)
      return "bg-neutral-50 text-neutral-300 ring-neutral-100";
    if (sev === "high")
      return n > 5
        ? "bg-red-100 text-red-800 ring-red-200"
        : "bg-red-50 text-red-700 ring-red-100";
    if (sev === "medium")
      return n > 5
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-amber-50 text-amber-700 ring-amber-100";
    return "bg-sky-50 text-sky-700 ring-sky-100";
  };

  const lateTotal = APPROVAL_HEATMAP.find((r) => r.band === "Late");
  const lateSum = lateTotal
    ? lateTotal.high + lateTotal.medium + lateTotal.low
    : 0;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Approvals due &amp; aging heatmap
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Priority × ageing band
          </p>
        </div>
        <Badge tone="error">{lateSum} late</Badge>
      </div>

      <div className="mt-5 grid grid-cols-[80px_1fr_1fr_1fr] gap-3">
        <div></div>
        <div className="pb-1 text-center text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          High
        </div>
        <div className="pb-1 text-center text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          Medium
        </div>
        <div className="pb-1 text-center text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          Low
        </div>

        {APPROVAL_HEATMAP.map((row) => (
          <Cells key={row.band} band={row.band} row={row} cell={cell} />
        ))}
      </div>

      <p className="mt-6 border-t border-neutral-100 pt-4 text-[11px] leading-relaxed text-neutral-500">
        Cells show open approvals in each band. Late + High requires immediate
        action.
      </p>
    </section>
  );
}

function Cells({
  band,
  row,
  cell,
}: {
  band: string;
  row: { high: number; medium: number; low: number };
  cell: (n: number, sev: "high" | "medium" | "low") => string;
}) {
  return (
    <>
      <div className="self-center text-xs font-medium text-neutral-700">
        {band}
      </div>
      {(["high", "medium", "low"] as const).map((sev) => (
        <div
          key={sev}
          className={`flex h-14 items-center justify-center rounded-lg font-mono text-base font-semibold tabular-nums ring-1 ring-inset ${cell(
            row[sev],
            sev,
          )}`}
        >
          {row[sev]}
        </div>
      ))}
    </>
  );
}

/* ================================================================== *
 * Client picker (header)
 * ================================================================== */

function ClientPicker() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-semibold text-white">
        W
      </span>
      <span className="text-neutral-500">Client:</span>
      <span className="font-semibold text-neutral-900">Walmart</span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-neutral-400">
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.13l3.71-3.9a.75.75 0 1 1 1.08 1.04l-4.25 4.47a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

/* ================================================================== *
 * Footnote
 * ================================================================== */

function Footnote() {
  return (
    <div className="mt-10 border-t border-neutral-200 pt-4 text-[11px] text-neutral-400">
      <p>
        Payments Center v0.1 · Walmart treasury workspace · figures USD eq.
        unless noted · feed: Treasury IQ™ realtime + nightly reconciliation
        · Smart insights and Next best actions are agent recommendations and
        require dual-approval before execution.
      </p>
    </div>
  );
}

/* ================================================================== *
 * Initiate payment modal
 * ================================================================== */

function InitiatePaymentModal({ onClose }: { onClose: () => void }) {
  const [rail, setRail] = useState<Rail>("RTP");
  const [amount, setAmount] = useState("245900");
  const [memo, setMemo] = useState("INV-22910 — May supplier settlement");

  const RAILS: { rail: Rail; speed: string; fee: string }[] = [
    { rail: "RTP", speed: "Instant", fee: "$0.50" },
    { rail: "ACH", speed: "Same day", fee: "$0.20" },
    { rail: "Fedwire", speed: "<30 min", fee: "$8.00" },
    { rail: "SWIFT", speed: "1–2 days", fee: "$25.00" },
    { rail: "SEPA", speed: "Same day", fee: "€0.10" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-neutral-900/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 z-50 flex h-screen w-[640px] flex-col border-l border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-7 py-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Initiate payment
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Smart routing will pick the optimal rail and FX rate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          <FormBlock label="From account">
            <Select value="Operating · USD · $18,429,551.23" />
          </FormBlock>

          <FormBlock label="Beneficiary" className="mt-4">
            <Select value="Mitsui Logistics K.K." />
          </FormBlock>

          <div className="mt-4 grid grid-cols-[1fr_180px] gap-3">
            <FormBlock label="Amount">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-sm tabular-nums text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </FormBlock>
            <FormBlock label="Currency">
              <Select value="USD" />
            </FormBlock>
          </div>

          <FormBlock label="Payment rail" className="mt-5">
            <div className="grid grid-cols-3 gap-2">
              {RAILS.map((r) => (
                <button
                  key={r.rail}
                  type="button"
                  onClick={() => setRail(r.rail)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    rail === r.rail
                      ? "border-neutral-900 bg-neutral-900/[0.03] ring-1 ring-neutral-900"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-neutral-900">
                    {r.rail}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                    {r.speed} · {r.fee}
                  </div>
                </button>
              ))}
            </div>
          </FormBlock>

          <FormBlock label="Reference / memo" className="mt-5">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none"
            />
          </FormBlock>

          {/* Smart preview */}
          <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-sky-600">✦</span>
              <h3 className="text-xs font-semibold tracking-wider text-neutral-600 uppercase">
                Smart preview
              </h3>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5 text-xs">
              <PreviewRow
                icon="↻"
                label="Routing"
                value={`${rail} · optimal cost & speed`}
              />
              <PreviewRow
                icon="⏱"
                label="Estimated arrival"
                value="Within 30 seconds"
              />
              <PreviewRow
                icon="✓"
                label="Sanctions screening"
                value="Will run before submission"
              />
              <PreviewRow
                icon=""
                label="FX rate"
                value="1 USD = 150.21 JPY · indicative"
              />
              <PreviewRow icon="" label="Total fees" value="$0.50" />
              <PreviewRow
                icon=""
                label="Draft amount"
                value="$245,900.00"
                emphasis
              />
            </ul>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-white px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            Submit for approval
          </button>
        </div>
      </aside>
    </>
  );
}

function FormBlock({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[11px] font-medium text-neutral-600">
        {label}
      </div>
      {children}
    </div>
  );
}

function Select({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-800 hover:border-neutral-300"
    >
      <span className="truncate">{value}</span>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4 shrink-0 text-neutral-400"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.13l3.71-3.9a.75.75 0 1 1 1.08 1.04l-4.25 4.47a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

function PreviewRow({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: string;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-neutral-500">
        {icon && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-400">
            {icon}
          </span>
        )}
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          emphasis
            ? "text-sm font-semibold text-neutral-900"
            : "text-xs text-neutral-700"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
