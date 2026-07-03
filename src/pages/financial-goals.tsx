import { useMemo, useState } from "react";

export const title = "Financial Goals";
export const fullWidth = true;

/* Financial Goals — goal-based planning for a household.
 *
 * Each goal is a card: a funding ring (assigned vs required today), the target
 * amount and horizon, monthly contribution, and an on-track / at-risk / behind
 * verdict from a simple projection. The header rolls the plan up — total goal
 * value, aggregate funded %, and how many goals are off track — with a stacked
 * projection bar showing funded vs gap across the whole plan. */

type Status = "on-track" | "at-risk" | "behind";

type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  assigned: number; // capital assigned today
  requiredToday: number; // PV of what's needed today to be on track
  monthly: number;
  targetYear: number;
  priority: "Essential" | "Important" | "Aspirational";
  projected: number; // projected value at target year
};

const THIS_YEAR = 2026;

const GOALS: Goal[] = [
  {
    id: "G-01",
    name: "Retirement income",
    icon: "🏖️",
    target: 6_500_000,
    assigned: 4_180_000,
    requiredToday: 4_050_000,
    monthly: 12_000,
    targetYear: 2041,
    priority: "Essential",
    projected: 6_720_000,
  },
  {
    id: "G-02",
    name: "Family gifting & legacy",
    icon: "🎁",
    target: 3_000_000,
    assigned: 1_240_000,
    requiredToday: 1_560_000,
    monthly: 6_500,
    targetYear: 2036,
    priority: "Important",
    projected: 2_610_000,
  },
  {
    id: "G-03",
    name: "Grandchildren education",
    icon: "🎓",
    target: 900_000,
    assigned: 610_000,
    requiredToday: 590_000,
    monthly: 2_800,
    targetYear: 2034,
    priority: "Important",
    projected: 945_000,
  },
  {
    id: "G-04",
    name: "Coastal property",
    icon: "🏡",
    target: 2_200_000,
    assigned: 520_000,
    requiredToday: 980_000,
    monthly: 4_000,
    targetYear: 2030,
    priority: "Aspirational",
    projected: 1_480_000,
  },
  {
    id: "G-05",
    name: "Philanthropic fund",
    icon: "❤️",
    target: 1_500_000,
    assigned: 1_150_000,
    requiredToday: 1_120_000,
    monthly: 3_200,
    targetYear: 2032,
    priority: "Aspirational",
    projected: 1_560_000,
  },
];

const PRIORITY_TONE: Record<Goal["priority"], string> = {
  Essential: "bg-rose-100 text-rose-700",
  Important: "bg-amber-100 text-amber-800",
  Aspirational: "bg-sky-100 text-sky-700",
};

const STATUS_META: Record<Status, { label: string; ring: string; badge: string }> = {
  "on-track": {
    label: "On track",
    ring: "#059669",
    badge: "bg-emerald-100 text-emerald-700",
  },
  "at-risk": {
    label: "At risk",
    ring: "#f59e0b",
    badge: "bg-amber-100 text-amber-800",
  },
  behind: {
    label: "Behind",
    ring: "#e11d48",
    badge: "bg-rose-100 text-rose-700",
  },
};

function statusFor(g: Goal): Status {
  const ratio = g.projected / g.target;
  if (ratio >= 1) return "on-track";
  if (ratio >= 0.85) return "at-risk";
  return "behind";
}

function fmtM(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, pct);
  const dash = (clamped / 100) * c;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[76px] w-[76px]" role="img">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f0f0f0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        className="fill-neutral-900 font-semibold"
        fontSize={15}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function FinancialGoalsPage() {
  const [filter, setFilter] = useState<"all" | Status>("all");

  const enriched = useMemo(
    () =>
      GOALS.map((g) => {
        const status = statusFor(g);
        const funded = (g.assigned / g.target) * 100;
        const projectedPct = (g.projected / g.target) * 100;
        const gap = Math.max(0, g.target - g.projected);
        return { ...g, status, funded, projectedPct, gap };
      }),
    [],
  );

  const totals = useMemo(() => {
    const target = enriched.reduce((s, g) => s + g.target, 0);
    const assigned = enriched.reduce((s, g) => s + g.assigned, 0);
    const projected = enriched.reduce((s, g) => s + g.projected, 0);
    const offTrack = enriched.filter((g) => g.status !== "on-track").length;
    const monthly = enriched.reduce((s, g) => s + g.monthly, 0);
    return { target, assigned, projected, offTrack, monthly };
  }, [enriched]);

  const shown = enriched.filter((g) => filter === "all" || g.status === filter);
  const fundedPct = (totals.projected / totals.target) * 100;

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Wealth · Goal-based planning
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Financial Goals
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Every objective, how well it's funded today, and whether the plan
              projects to hit it.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Contributions
            </div>
            <div className="text-sm font-semibold tabular-nums text-neutral-900">
              {fmtM(totals.monthly)}/mo
            </div>
          </div>
        </div>

        {/* Plan roll-up */}
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Plan funded (projected)
                </div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
                  {fundedPct.toFixed(0)}%
                </div>
              </div>
              <div className="text-xs text-neutral-500">
                {fmtM(totals.projected)} projected of {fmtM(totals.target)}{" "}
                across {GOALS.length} goals
              </div>
            </div>
            {totals.offTrack > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {totals.offTrack} goal{totals.offTrack === 1 ? "" : "s"} need
                attention
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Every goal on track
              </span>
            )}
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="bg-emerald-500"
              style={{ width: `${Math.min(100, fundedPct)}%` }}
              title="Projected funded"
            />
          </div>
        </div>
      </header>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-white px-6 py-2.5">
        {(["all", "on-track", "at-risk", "behind"] as const).map((f) => {
          const active = filter === f;
          const count =
            f === "all"
              ? enriched.length
              : enriched.filter((g) => g.status === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
              }`}
            >
              {f === "all" ? "All goals" : STATUS_META[f].label}
              <span className="ml-1.5 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Goal cards */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {shown.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center text-sm text-neutral-500">
            No goals in this state.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((g) => {
              const meta = STATUS_META[g.status];
              const yearsAway = g.targetYear - THIS_YEAR;
              return (
                <article
                  key={g.id}
                  className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg"
                      aria-hidden
                    >
                      {g.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-neutral-900">
                        {g.name}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_TONE[g.priority]}`}
                        >
                          {g.priority}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {g.targetYear} · {yearsAway}y away
                        </span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <Ring pct={g.funded} color={meta.ring} />
                    <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-neutral-500">Target</span>
                        <span className="font-mono font-semibold tabular-nums text-neutral-900">
                          {fmtM(g.target)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-neutral-500">Assigned</span>
                        <span className="font-mono tabular-nums text-neutral-700">
                          {fmtM(g.assigned)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-neutral-500">Projected</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            g.projectedPct >= 100
                              ? "text-emerald-600"
                              : "text-neutral-800"
                          }`}
                        >
                          {fmtM(g.projected)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* projection bar: assigned (solid) → projected growth (light) → gap */}
                  <div className="mt-3">
                    <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="bg-emerald-500"
                        style={{
                          width: `${Math.min(100, g.funded)}%`,
                        }}
                        title="Assigned today"
                      />
                      <div
                        className="bg-emerald-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, g.projectedPct) - Math.min(100, g.funded),
                          )}%`,
                        }}
                        title="Projected growth + contributions"
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-500">
                      <span>{fmtM(g.monthly)}/mo contribution</span>
                      {g.gap > 0 ? (
                        <span className="font-medium text-rose-600">
                          {fmtM(g.gap)} short
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-600">
                          Fully funded
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
