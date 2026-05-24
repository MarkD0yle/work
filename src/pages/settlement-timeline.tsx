import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const title = "Settlement Timeline";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Operations — Intraday Settlement Timeline (swimlane Gantt)
 *
 * The settlement day laid out left-to-right. Each lane is a function;
 * each bar is a batch or task positioned by its real start/end. A live
 * playhead shows where the day actually is; dashed red markers are the
 * market cutoffs everything has to clear before.
 *
 * Design rule: a task that finished on time is GREY. Colour only marks
 * what is slipping (amber) or has missed (red). In-progress work is the
 * one calm accent (sky) so the eye can find "what's live right now".
 * ------------------------------------------------------------------ */

/* ---------- Time model ---------- */

const DAY_START = 6; // 06:00
const DAY_END = 20; // 20:00
const SPAN = DAY_END - DAY_START;

/** Scenario "now" advances in real time from this anchor (decimal hours). */
const SCENARIO_NOW_AT_MOUNT = 13 + 24 / 60; // 13:24
const MOUNT = Date.now();

function scenarioNow(real: number): number {
  return SCENARIO_NOW_AT_MOUNT + (real - MOUNT) / 3_600_000;
}

function pct(hour: number): number {
  return ((hour - DAY_START) / SPAN) * 100;
}

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function fmtDelta(fromHour: number, nowHour: number): string {
  const mins = Math.round((fromHour - nowHour) * 60);
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const core = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return mins < 0 ? `${core} ago` : `in ${core}`;
}

/* ---------- Data model ---------- */

type TaskStatus =
  | "complete"
  | "in_progress"
  | "pending"
  | "at_risk"
  | "breached"
  | "holiday";

type Task = {
  id: string;
  name: string;
  start: number;
  end: number;
  status: TaskStatus;
  /** 0..1 fill for in-progress bars */
  progress?: number;
  owner: string;
  dependsOn?: string;
  detail: string;
};

type Lane = {
  id: string;
  name: string;
  region: string;
  tasks: Task[];
};

type Cutoff = {
  id: string;
  hour: number;
  label: string;
  rail: string;
};

const LANES: Lane[] = [
  {
    id: "custody",
    name: "Custody / DvP",
    region: "Global",
    tasks: [
      { id: "c1", name: "SOD positions load", start: 6, end: 6.75, status: "complete", owner: "Batch", detail: "Start-of-day position file from sub-custodians loaded and reconciled." },
      { id: "c2", name: "Affirmation sweep", start: 7, end: 9, status: "complete", owner: "Pune ops", detail: "CTM affirmations matched for T+1 equity trades." },
      { id: "c3", name: "DvP settlement — EUR", start: 9.5, end: 11.5, status: "complete", owner: "Clearstream", detail: "Euroclear/Clearstream DvP leg cleared ahead of TARGET2." },
      { id: "c4", name: "DvP settlement — USD", start: 12, end: 15, status: "in_progress", progress: 0.46, owner: "DTC", dependsOn: "c2", detail: "DTC settlement window in flight. 142 of 308 instructions matched." },
      { id: "c5", name: "Fail investigation", start: 15.25, end: 16.5, status: "pending", owner: "Howard W", dependsOn: "c4", detail: "Work any unmatched instructions before the recycle." },
    ],
  },
  {
    id: "fx",
    name: "FX & Funding",
    region: "Global",
    tasks: [
      { id: "f1", name: "Overnight FX fixings", start: 6, end: 6.5, status: "complete", owner: "Batch", detail: "WM/Reuters 4pm prior-day fixings ingested." },
      { id: "f2", name: "Hedge rebalance", start: 8, end: 10, status: "complete", owner: "London desk", detail: "Share-class hedge ratios rebalanced to target." },
      { id: "f3", name: "FX swap — EUR near leg", start: 10.5, end: 12, status: "at_risk", progress: 0.7, owner: "BNP", dependsOn: "f2", detail: "Near leg confirmation outstanding from counterparty — chase before the cash cutoff." },
      { id: "f4", name: "USD funding sweep", start: 13, end: 14.5, status: "in_progress", progress: 0.2, owner: "Treasury", detail: "Sweeping USD shortfalls ahead of CHIPS." },
      { id: "f5", name: "JPY far leg", start: 16, end: 17.5, status: "pending", owner: "MUFG", detail: "Far leg settles tomorrow JST." },
    ],
  },
  {
    id: "cash",
    name: "Cash & Payments",
    region: "Global",
    tasks: [
      { id: "p1", name: "Inbound subs reconcile", start: 7, end: 9.5, status: "complete", owner: "Pune ops", detail: "Subscription cash matched to dealing file." },
      { id: "p2", name: "Margin calls — EUR", start: 9, end: 10, status: "complete", owner: "Collateral", detail: "Eurex variation margin met." },
      { id: "p3", name: "Margin calls — USD", start: 11.5, end: 13, status: "breached", progress: 0.85, owner: "Collateral", dependsOn: "f4", detail: "CME variation call not met by 13:00 — funding shortfall escalated to Treasury." },
      { id: "p4", name: "Redemption payments", start: 13.5, end: 16, status: "pending", owner: "Payments", dependsOn: "p3", detail: "Outbound redemption wires, gated on USD funding." },
    ],
  },
  {
    id: "corpact",
    name: "Corporate Actions",
    region: "Global",
    tasks: [
      { id: "a1", name: "Entitlement capture", start: 6.5, end: 8, status: "complete", owner: "Batch", detail: "Ex-date entitlements posted to positions." },
      { id: "a2", name: "Election deadline — tender", start: 10, end: 11, status: "complete", owner: "CA desk", detail: "Voluntary tender elections submitted to agent." },
      { id: "a3", name: "Dividend posting", start: 14, end: 15.5, status: "pending", owner: "CA desk", detail: "Cash dividends post after USD settlement confirms." },
    ],
  },
  {
    id: "reporting",
    name: "Client Reporting",
    region: "Global",
    tasks: [
      { id: "r1", name: "Intraday position pack", start: 11, end: 12, status: "complete", owner: "Batch", detail: "Midday position snapshot delivered to oversight." },
      { id: "r2", name: "NAV input freeze", start: 15.5, end: 16, status: "pending", owner: "Fund acct", dependsOn: "c4", detail: "Positions freeze for NAV strike." },
      { id: "r3", name: "EOD client reporting", start: 17, end: 19, status: "pending", owner: "Reporting", dependsOn: "r2", detail: "Generate and distribute end-of-day client packs." },
    ],
  },
];

const CUTOFFS: Cutoff[] = [
  { id: "target2", hour: 11.5, label: "TARGET2", rail: "EUR cash" },
  { id: "chips", hour: 13, label: "CHIPS", rail: "USD margin" },
  { id: "fedwire", hour: 16.5, label: "Fedwire", rail: "USD wires" },
  { id: "navfreeze", hour: 16, label: "NAV freeze", rail: "Pricing" },
];

/* ---------- Status meta ---------- */

const STATUS_META: Record<
  TaskStatus,
  { label: string; bar: string; text: string; fill: string }
> = {
  complete: {
    label: "Complete",
    bar: "border-neutral-300 bg-neutral-200/70 text-neutral-600",
    text: "text-neutral-600",
    fill: "bg-neutral-300",
  },
  in_progress: {
    label: "In progress",
    bar: "border-sky-300 bg-sky-100 text-sky-800 ring-1 ring-sky-300/60",
    text: "text-sky-700",
    fill: "bg-sky-300/70",
  },
  pending: {
    label: "Pending",
    bar: "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400",
    text: "text-neutral-400",
    fill: "bg-neutral-200",
  },
  at_risk: {
    label: "At risk",
    bar: "border-amber-400 bg-amber-100 text-amber-900 ring-1 ring-amber-300/60",
    text: "text-amber-700",
    fill: "bg-amber-300/70",
  },
  breached: {
    label: "Missed",
    bar: "border-red-500 bg-red-500 text-white",
    text: "text-red-700",
    fill: "bg-red-400",
  },
  holiday: {
    label: "Holiday",
    bar: "border-neutral-200 bg-neutral-50 text-neutral-300",
    text: "text-neutral-400",
    fill: "bg-neutral-100",
  },
};

/* ---------- Atoms ---------- */

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

/* ================================================================== *
 * Page
 * ================================================================== */

export default function SettlementTimeline() {
  const [now, setNow] = useState(() => Date.now());
  const [laneFilter, setLaneFilter] = useState<"all" | "issues">("all");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowHour = scenarioNow(now);

  const allTasks = useMemo(() => LANES.flatMap((l) => l.tasks), []);
  const counts = useMemo(() => {
    const c = { breached: 0, at_risk: 0, in_progress: 0, complete: 0, pending: 0 };
    for (const t of allTasks) {
      if (t.status === "breached") c.breached++;
      else if (t.status === "at_risk") c.at_risk++;
      else if (t.status === "in_progress") c.in_progress++;
      else if (t.status === "complete") c.complete++;
      else if (t.status === "pending") c.pending++;
    }
    return c;
  }, [allTasks]);

  const lanes = useMemo(() => {
    if (laneFilter === "all") return LANES;
    return LANES.map((l) => ({
      ...l,
      tasks: l.tasks.filter(
        (t) => t.status === "at_risk" || t.status === "breached",
      ),
    })).filter((l) => l.tasks.length > 0);
  }, [laneFilter]);

  const nextCutoff = CUTOFFS.filter((c) => c.hour > nowHour).sort(
    (a, b) => a.hour - b.hour,
  )[0];

  const selectedTask = allTasks.find((t) => t.id === selected) ?? null;
  const selectedLane = LANES.find((l) =>
    l.tasks.some((t) => t.id === selected),
  );

  const hourTicks: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h += 1) hourTicks.push(h);

  const overall =
    counts.breached > 0 ? "error" : counts.at_risk > 0 ? "warning" : "ok";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Settlement Timeline
          </span>
          <span className="font-mono text-sm text-neutral-500">
            · {fmtHour(nowHour)} EST
          </span>
        </div>

        {nextCutoff && (
          <span className="text-sm text-neutral-600">
            {nextCutoff.label} cutoff{" "}
            <span className="font-mono font-medium text-neutral-900">
              {fmtDelta(nextCutoff.hour, nowHour)}
            </span>
          </span>
        )}

        <div className="ml-auto">
          {overall === "ok" ? (
            <Badge tone="ok">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              On schedule · {counts.complete} done
            </Badge>
          ) : overall === "warning" ? (
            <Badge tone="warning">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {counts.at_risk} task{counts.at_risk > 1 ? "s" : ""} slipping
            </Badge>
          ) : (
            <Badge tone="error">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {counts.breached} cutoff missed
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto min-w-[980px] max-w-[1700px] px-8 py-6">
          {/* ---------- Toolbar ---------- */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
              {(["all", "issues"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLaneFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                    laneFilter === f
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {f === "all" ? "All lanes" : "Issues only"}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
              {(
                [
                  ["complete", "Complete"],
                  ["in_progress", "Live"],
                  ["at_risk", "At risk"],
                  ["breached", "Missed"],
                  ["pending", "Pending"],
                ] as const
              ).map(([k, label]) => (
                <span key={k} className="flex items-center gap-1">
                  <span
                    className={`h-2.5 w-3 rounded-[2px] ${
                      STATUS_META[k as TaskStatus].fill
                    }`}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ---------- Gantt ---------- */}
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {/* Hour axis */}
            <div className="grid grid-cols-[180px_1fr] border-b border-neutral-100">
              <div className="px-4 py-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                Function
              </div>
              <div className="relative h-8">
                {hourTicks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 -translate-x-1/2"
                    style={{ left: `${pct(h)}%` }}
                  >
                    <span className="font-mono text-[10px] text-neutral-400">
                      {String(h).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Body: lanes + overlay */}
            <div className="relative">
              {/* overlay: gridlines, cutoffs, playhead — sits over the 1fr track area */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0"
                style={{ left: 180 }}
              >
                {/* hour gridlines */}
                {hourTicks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 w-px bg-neutral-100"
                    style={{ left: `${pct(h)}%` }}
                  />
                ))}
                {/* cutoff markers */}
                {CUTOFFS.map((c) => (
                  <div
                    key={c.id}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${pct(c.hour)}%` }}
                  >
                    <div className="h-full w-px border-l border-dashed border-red-300" />
                    <span className="absolute top-1 left-1 rounded bg-red-50 px-1 font-mono text-[9px] font-medium whitespace-nowrap text-red-600 ring-1 ring-red-200 ring-inset">
                      {c.label} {fmtHour(c.hour)}
                    </span>
                  </div>
                ))}
                {/* playhead */}
                <div
                  className="absolute top-0 bottom-0 z-10 w-0.5 bg-sky-500"
                  style={{ left: `${pct(nowHour)}%` }}
                >
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded bg-sky-500 px-1 py-0.5 font-mono text-[9px] whitespace-nowrap text-white">
                    now
                  </span>
                </div>
              </div>

              {/* lanes */}
              {lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="grid grid-cols-[180px_1fr] border-t border-neutral-100"
                >
                  {/* lane label */}
                  <div className="flex flex-col justify-center border-r border-neutral-100 px-4 py-3">
                    <span className="text-sm font-semibold text-neutral-800">
                      {lane.name}
                    </span>
                    <span className="text-[10px] tracking-wide text-neutral-400 uppercase">
                      {lane.tasks.length} task
                      {lane.tasks.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* track */}
                  <div className="relative h-14">
                    {lane.tasks.map((t) => (
                      <TaskBar
                        key={t.id}
                        task={t}
                        active={selected === t.id}
                        onClick={() => setSelected(t.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {lanes.length === 0 && (
                <div className="grid grid-cols-[180px_1fr] border-t border-neutral-100">
                  <div />
                  <div className="px-4 py-10 text-center text-sm text-neutral-400">
                    No tasks at risk or missed. The day is on schedule.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ---------- Footer cards ---------- */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              title="Critical path"
              body={
                <>
                  USD margin call missed at CHIPS gates redemption payments.
                  Treasury funding sweep must clear before{" "}
                  <span className="font-medium text-neutral-900">15:00</span> to
                  recover the wire window.
                </>
              }
              tone="error"
            />
            <SummaryCard
              title="Next cutoff"
              body={
                nextCutoff ? (
                  <>
                    {nextCutoff.label} ({nextCutoff.rail}) at{" "}
                    <span className="font-mono">{fmtHour(nextCutoff.hour)}</span>{" "}
                    — {fmtDelta(nextCutoff.hour, nowHour)}.
                  </>
                ) : (
                  <>All cutoffs passed for the day.</>
                )
              }
              tone="warning"
            />
            <SummaryCard
              title="Live now"
              body={
                <>
                  {counts.in_progress} task
                  {counts.in_progress === 1 ? "" : "s"} in flight,{" "}
                  {counts.pending} still pending. {counts.complete} cleared.
                </>
              }
              tone="neutral"
            />
          </div>
        </div>
      </div>

      {/* ---------- Drawer ---------- */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          laneName={selectedLane?.name ?? ""}
          nowHour={nowHour}
          depName={
            selectedTask.dependsOn
              ? allTasks.find((t) => t.id === selectedTask.dependsOn)?.name
              : undefined
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * Task bar
 * ================================================================== */

function TaskBar({
  task,
  active,
  onClick,
}: {
  task: Task;
  active: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[task.status];
  const left = pct(task.start);
  const width = pct(task.end) - pct(task.start);
  const wide = width > 9;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${task.name} · ${fmtHour(task.start)}–${fmtHour(task.end)} · ${meta.label}`}
      className={`absolute top-1/2 flex h-8 -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-left transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${meta.bar} ${
        active ? "ring-2 ring-sky-500 ring-offset-1" : ""
      }`}
      style={{ left: `${left}%`, width: `${width}%`, minWidth: 8 }}
    >
      {/* progress fill for live/slipping bars */}
      {task.progress != null && task.status !== "complete" && (
        <span
          className={`absolute inset-y-0 left-0 ${meta.fill}`}
          style={{ width: `${task.progress * 100}%` }}
        />
      )}
      {wide && (
        <span className="relative truncate text-[11px] font-medium">
          {task.name}
        </span>
      )}
    </button>
  );
}

/* ================================================================== *
 * Summary card
 * ================================================================== */

function SummaryCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: ReactNode;
  tone: "error" | "warning" | "neutral";
}) {
  const accent = {
    error: "border-l-red-500",
    warning: "border-l-amber-500",
    neutral: "border-l-neutral-300",
  }[tone];
  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {title}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{body}</p>
    </div>
  );
}

/* ================================================================== *
 * Task drawer
 * ================================================================== */

function TaskDrawer({
  task,
  laneName,
  nowHour,
  depName,
  onClose,
}: {
  task: Task;
  laneName: string;
  nowHour: number;
  depName?: string;
  onClose: () => void;
}) {
  const meta = STATUS_META[task.status];
  const tone =
    task.status === "breached"
      ? "error"
      : task.status === "at_risk"
        ? "warning"
        : task.status === "in_progress"
          ? "info"
          : "muted";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-neutral-900/20"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 z-50 flex h-screen w-[440px] flex-col border-l border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {task.name}
              </h2>
              <Badge tone={tone}>{meta.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">{laneName}</p>
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

        <div className="grid grid-cols-3 gap-px border-b border-neutral-200 bg-neutral-100">
          {[
            { label: "Start", value: fmtHour(task.start) },
            { label: "End", value: fmtHour(task.end) },
            {
              label: "Window",
              value: `${Math.round((task.end - task.start) * 60)}m`,
            },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3">
              <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                {s.label}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-neutral-800">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DrawerField label="Owner" value={task.owner} />
          {depName && <DrawerField label="Depends on" value={depName} />}
          <DrawerField
            label="Timing"
            value={
              task.status === "complete"
                ? `Finished ${fmtDelta(task.end, nowHour)}`
                : task.end < nowHour
                  ? `Overran — due ${fmtDelta(task.end, nowHour)}`
                  : `Due ${fmtDelta(task.end, nowHour)}`
            }
          />
          {task.progress != null && task.status !== "complete" && (
            <div className="mb-4">
              <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                Progress
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full ${meta.fill}`}
                  style={{ width: `${task.progress * 100}%` }}
                />
              </div>
              <div className="mt-1 font-mono text-[11px] text-neutral-500">
                {Math.round(task.progress * 100)}% complete
              </div>
            </div>
          )}

          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
            What's happening
          </div>
          <p className="text-sm leading-relaxed text-neutral-700">
            {task.detail}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
              {task.status === "breached" ? "Escalate" : "Investigate"}
            </button>
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
              Reassign
            </button>
            <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
              Add note
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-neutral-800">{value}</div>
    </div>
  );
}
