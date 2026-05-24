import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const title = "Corporate Actions";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Asset Servicing — Corporate Actions election board (kanban)
 *
 * Every event flows left-to-right through its lifecycle. Voluntary
 * events stall in "Awaiting election" until someone instructs them —
 * that column is the work queue. Capturing an election in the drawer
 * advances the card.
 *
 * Design rule: a card on track is GREY. The deadline countdown is the
 * only thing that turns amber, then red, as the agent cutoff nears —
 * so a scan of the board reads as "what runs out of time first".
 * ------------------------------------------------------------------ */

/* ---------- Model ---------- */

type EventType = "dividend" | "tender" | "merger" | "rights" | "split" | "consent";
type Stage = "announced" | "validated" | "awaiting" | "instructed" | "settled";

type ElectionOption = {
  key: string;
  label: string;
  detail: string;
};

type CAEvent = {
  id: string;
  security: string;
  isin: string;
  type: EventType;
  mandatory: boolean;
  stage: Stage;
  /** minutes from mount; null = no agent deadline (mandatory/settled) */
  deadlineOffsetMin: number | null;
  positionShares: number;
  valueAtRisk: number; // USD
  owner: string;
  terms: string;
  exDate: string;
  payDate: string;
  options?: ElectionOption[];
  /** key of elected option once instructed */
  elected?: string;
};

const MOUNT = Date.now();

const TYPE_META: Record<
  EventType,
  { label: string; short: string; chip: string }
> = {
  dividend: { label: "Cash dividend", short: "DIV", chip: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
  tender: { label: "Tender offer", short: "TEND", chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  merger: { label: "Merger / scheme", short: "MRGR", chip: "bg-sky-50 text-sky-700 ring-sky-200" },
  rights: { label: "Rights issue", short: "RGHT", chip: "bg-teal-50 text-teal-700 ring-teal-200" },
  split: { label: "Stock split", short: "SPLT", chip: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
  consent: { label: "Consent solicitation", short: "CNST", chip: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
};

const STAGES: { key: Stage; label: string }[] = [
  { key: "announced", label: "Announced" },
  { key: "validated", label: "Validated" },
  { key: "awaiting", label: "Awaiting election" },
  { key: "instructed", label: "Instructed" },
  { key: "settled", label: "Settled" },
];

const VOTE_OPTIONS: ElectionOption[] = [
  { key: "tender_all", label: "Tender full position", detail: "Submit entire holding to the offer" },
  { key: "tender_part", label: "Tender partial", detail: "Submit a specified portion" },
  { key: "decline", label: "Decline / take no action", detail: "Hold the position, lapse the offer" },
];

const RIGHTS_OPTIONS: ElectionOption[] = [
  { key: "take_up", label: "Take up rights", detail: "Subscribe to new shares at the offer price" },
  { key: "sell_rights", label: "Sell rights nil-paid", detail: "Sell entitlement in the market" },
  { key: "lapse", label: "Lapse", detail: "Allow rights to lapse (default)" },
];

const DIV_OPTIONS: ElectionOption[] = [
  { key: "cash", label: "Take cash", detail: "Standard cash dividend" },
  { key: "scrip", label: "Scrip / DRIP", detail: "Reinvest into additional shares" },
];

const EVENTS: CAEvent[] = [
  {
    id: "ca-01", security: "Novartis AG", isin: "CH0012005267", type: "tender", mandatory: false,
    stage: "awaiting", deadlineOffsetMin: 92, positionShares: 1_240_000, valueAtRisk: 132_400_000,
    owner: "Howard W", terms: "Cash offer CHF 96.00 / share. Pro-ration possible.", exDate: "21 May", payDate: "04 Jun",
    options: VOTE_OPTIONS,
  },
  {
    id: "ca-02", security: "Vodafone Group plc", isin: "GB00BH4HKS39", type: "rights", mandatory: false,
    stage: "awaiting", deadlineOffsetMin: 41, positionShares: 8_600_000, valueAtRisk: 24_900_000,
    owner: "Priya N", terms: "3-for-7 rights at 62p. Nil-paid trading to 30 May.", exDate: "19 May", payDate: "06 Jun",
    options: RIGHTS_OPTIONS,
  },
  {
    id: "ca-03", security: "Roche Holding AG", isin: "CH0012032048", type: "dividend", mandatory: false,
    stage: "awaiting", deadlineOffsetMin: 372, positionShares: 540_000, valueAtRisk: 8_100_000,
    owner: "Howard W", terms: "Optional scrip dividend, ratio TBC at strike.", exDate: "22 May", payDate: "12 Jun",
    options: DIV_OPTIONS,
  },
  {
    id: "ca-04", security: "Activision Blizzard", isin: "US00507V1098", type: "merger", mandatory: false,
    stage: "awaiting", deadlineOffsetMin: 1480, positionShares: 320_000, valueAtRisk: 30_200_000,
    owner: "Diego R", terms: "Scheme of arrangement, $95.00 cash. Court sanction pending.", exDate: "—", payDate: "TBC",
    options: VOTE_OPTIONS,
  },
  {
    id: "ca-05", security: "Shell plc", isin: "GB00BP6MXD84", type: "dividend", mandatory: true,
    stage: "validated", deadlineOffsetMin: null, positionShares: 4_100_000, valueAtRisk: 5_600_000,
    owner: "Batch", terms: "Q1 cash dividend $0.344 / share.", exDate: "16 May", payDate: "20 Jun",
  },
  {
    id: "ca-06", security: "ASML Holding NV", isin: "NL0010273215", type: "dividend", mandatory: true,
    stage: "announced", deadlineOffsetMin: null, positionShares: 210_000, valueAtRisk: 1_300_000,
    owner: "Batch", terms: "Final dividend €4.75 / share, pending AGM approval.", exDate: "28 May", payDate: "07 Jun",
  },
  {
    id: "ca-07", security: "Tesla Inc", isin: "US88160R1014", type: "split", mandatory: true,
    stage: "announced", deadlineOffsetMin: null, positionShares: 95_000, valueAtRisk: 0,
    owner: "Batch", terms: "3-for-1 stock split, record date 30 May.", exDate: "31 May", payDate: "31 May",
  },
  {
    id: "ca-08", security: "Credit Agricole SA", isin: "FR0000045072", type: "consent", mandatory: false,
    stage: "validated", deadlineOffsetMin: 720, positionShares: 2_300_000, valueAtRisk: 0,
    owner: "Priya N", terms: "Bondholder consent on covenant amendment.", exDate: "—", payDate: "—",
    options: [
      { key: "consent", label: "Consent", detail: "Vote in favour of the amendment" },
      { key: "reject", label: "Reject", detail: "Vote against" },
      { key: "abstain", label: "Abstain", detail: "No vote" },
    ],
  },
  {
    id: "ca-09", security: "Siemens AG", isin: "DE0007236101", type: "dividend", mandatory: false,
    stage: "instructed", deadlineOffsetMin: null, positionShares: 680_000, valueAtRisk: 3_200_000,
    owner: "Howard W", terms: "Optional scrip — cash elected.", exDate: "14 May", payDate: "30 May",
    options: DIV_OPTIONS, elected: "cash",
  },
  {
    id: "ca-10", security: "Unilever plc", isin: "GB00B10RZP78", type: "tender", mandatory: false,
    stage: "instructed", deadlineOffsetMin: null, positionShares: 1_900_000, valueAtRisk: 41_000_000,
    owner: "Diego R", terms: "Buyback tender — full position submitted.", exDate: "10 May", payDate: "27 May",
    options: VOTE_OPTIONS, elected: "tender_all",
  },
  {
    id: "ca-11", security: "Nestle SA", isin: "CH0038863350", type: "dividend", mandatory: true,
    stage: "settled", deadlineOffsetMin: null, positionShares: 3_400_000, valueAtRisk: 0,
    owner: "Batch", terms: "Annual cash dividend CHF 3.00 — paid.", exDate: "08 May", payDate: "16 May",
  },
  {
    id: "ca-12", security: "BP plc", isin: "GB0007980591", type: "dividend", mandatory: true,
    stage: "settled", deadlineOffsetMin: null, positionShares: 6_200_000, valueAtRisk: 0,
    owner: "Batch", terms: "Q1 dividend $0.0726 — paid and reconciled.", exDate: "09 May", payDate: "20 May",
  },
  {
    id: "ca-13", security: "LVMH SE", isin: "FR0000121014", type: "rights", mandatory: false,
    stage: "validated", deadlineOffsetMin: 2600, positionShares: 44_000, valueAtRisk: 12_700_000,
    owner: "Priya N", terms: "1-for-12 rights at €620. Subscription opens 27 May.", exDate: "26 May", payDate: "11 Jun",
    options: RIGHTS_OPTIONS,
  },
];

/* ---------- Helpers ---------- */

function compactUsd(n: number): string {
  if (n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n}`;
}

function compactShares(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}m`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return `${n}`;
}

type Urgency = "none" | "soon" | "imminent" | "overdue";

function deadlineUrgency(offMin: number | null, now: number): Urgency {
  if (offMin == null) return "none";
  const mins = (MOUNT + offMin * 60_000 - now) / 60_000;
  if (mins < 0) return "overdue";
  if (mins <= 120) return "imminent";
  if (mins <= 600) return "soon";
  return "none";
}

function fmtDeadline(offMin: number | null, now: number): string {
  if (offMin == null) return "no deadline";
  const ms = MOUNT + offMin * 60_000 - now;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const core = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms < 0 ? `${core} overdue` : core;
}

const URGENCY_META: Record<Urgency, { chip: string; dot: string }> = {
  none: { chip: "bg-neutral-100 text-neutral-500 ring-neutral-200", dot: "bg-neutral-400" },
  soon: { chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  imminent: { chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  overdue: { chip: "bg-red-100 text-red-800 ring-red-300", dot: "bg-red-500" },
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-[9px] font-semibold text-white">
      {initials}
    </span>
  );
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function CorpActions() {
  const [now, setNow] = useState(() => Date.now());
  const [events, setEvents] = useState<CAEvent[]>(EVENTS);
  const [typeFilter, setTypeFilter] = useState<"all" | "voluntary" | EventType>(
    "all",
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return events;
    if (typeFilter === "voluntary") return events.filter((e) => !e.mandatory);
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  const byStage = useMemo(() => {
    const map: Record<Stage, CAEvent[]> = {
      announced: [],
      validated: [],
      awaiting: [],
      instructed: [],
      settled: [],
    };
    for (const e of filtered) map[e.stage].push(e);
    // within awaiting, sort by soonest deadline
    map.awaiting.sort(
      (a, b) => (a.deadlineOffsetMin ?? 1e9) - (b.deadlineOffsetMin ?? 1e9),
    );
    return map;
  }, [filtered]);

  const awaiting = events.filter((e) => e.stage === "awaiting");
  const imminent = awaiting.filter(
    (e) => deadlineUrgency(e.deadlineOffsetMin, now) !== "none",
  );
  const valueAtRisk = awaiting.reduce((s, e) => s + e.valueAtRisk, 0);
  const overdue = awaiting.filter(
    (e) => deadlineUrgency(e.deadlineOffsetMin, now) === "overdue",
  ).length;

  const selectedEvent = events.find((e) => e.id === selected) ?? null;

  function submitElection(id: string, optionKey: string) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, stage: "instructed", elected: optionKey, deadlineOffsetMin: null }
          : e,
      ),
    );
    setSelected(null);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Corporate Actions
          </span>
          <span className="text-xs text-neutral-400">Election board</span>
        </div>

        <div className="ml-auto">
          {overdue > 0 ? (
            <Badge tone="error">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {overdue} election{overdue > 1 ? "s" : ""} overdue
            </Badge>
          ) : imminent.length > 0 ? (
            <Badge tone="warning">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {imminent.length} deadline{imminent.length > 1 ? "s" : ""} approaching
            </Badge>
          ) : (
            <Badge tone="ok">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              No elections at risk
            </Badge>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="px-8 pt-6">
          {/* ---------- KPI strip ---------- */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Awaiting election" value={String(awaiting.length)} hint="Voluntary, open" />
            <Kpi
              label="Deadline ≤ today"
              value={String(imminent.length)}
              hint="Within agent cutoff"
              tone={imminent.length > 0 ? "warning" : "neutral"}
            />
            <Kpi
              label="Value at risk"
              value={compactUsd(valueAtRisk)}
              hint="Across open elections"
            />
            <Kpi
              label="Overdue"
              value={String(overdue)}
              hint="Past agent cutoff"
              tone={overdue > 0 ? "error" : "neutral"}
            />
          </div>

          {/* ---------- Filter pills ---------- */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All"],
                ["voluntary", "Voluntary"],
                ["dividend", "Dividends"],
                ["tender", "Tenders"],
                ["merger", "Mergers"],
                ["rights", "Rights"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  typeFilter === key
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- Kanban ---------- */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-6">
          <div className="flex h-full gap-4">
            {STAGES.map((stage) => {
              const items = byStage[stage.key];
              const isQueue = stage.key === "awaiting";
              return (
                <div
                  key={stage.key}
                  className={`flex h-full w-72 shrink-0 flex-col rounded-2xl border bg-white ${
                    isQueue ? "border-neutral-300 ring-1 ring-neutral-200" : "border-neutral-200"
                  }`}
                >
                  {/* column header */}
                  <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <span className="text-xs font-semibold tracking-wider text-neutral-600 uppercase">
                      {stage.label}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-500">
                      {items.length}
                    </span>
                  </div>

                  {/* cards */}
                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-[11px] text-neutral-300">
                        Empty
                      </div>
                    ) : (
                      items.map((e) => (
                        <EventCard
                          key={e.id}
                          event={e}
                          now={now}
                          onClick={() => setSelected(e.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Drawer ---------- */}
      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          now={now}
          onClose={() => setSelected(null)}
          onElect={(key) => submitElection(selectedEvent.id, key)}
        />
      )}
    </div>
  );
}

/* ================================================================== *
 * KPI tile
 * ================================================================== */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "error";
}) {
  const accent = {
    neutral: "border-l-neutral-300",
    warning: "border-l-amber-500",
    error: "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    warning: "text-amber-700",
    error: "text-red-700",
  }[tone];
  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/* ================================================================== *
 * Event card
 * ================================================================== */

function EventCard({
  event,
  now,
  onClick,
}: {
  event: CAEvent;
  now: number;
  onClick: () => void;
}) {
  const type = TYPE_META[event.type];
  const urgency = deadlineUrgency(event.deadlineOffsetMin, now);
  const uMeta = URGENCY_META[urgency];

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${type.chip}`}
        >
          {type.short}
        </span>
        {event.mandatory ? (
          <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
            Mandatory
          </span>
        ) : (
          <span className="text-[10px] font-medium tracking-wide text-violet-500 uppercase">
            Voluntary
          </span>
        )}
      </div>

      <div className="mt-2 truncate text-sm font-semibold text-neutral-800">
        {event.security}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-neutral-400">
        {event.isin}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar name={event.owner} />
          <span className="font-mono text-[11px] text-neutral-500">
            {compactShares(event.positionShares)} sh
          </span>
        </div>
        {event.deadlineOffsetMin != null ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${uMeta.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${uMeta.dot}`} />
            {fmtDeadline(event.deadlineOffsetMin, now)}
          </span>
        ) : event.elected ? (
          <span className="font-mono text-[10px] text-neutral-400">
            elected
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* ================================================================== *
 * Event drawer — election capture
 * ================================================================== */

function EventDrawer({
  event,
  now,
  onClose,
  onElect,
}: {
  event: CAEvent;
  now: number;
  onClose: () => void;
  onElect: (optionKey: string) => void;
}) {
  const type = TYPE_META[event.type];
  const canElect =
    !event.mandatory && event.stage === "awaiting" && !!event.options;
  const [choice, setChoice] = useState<string | null>(
    event.elected ?? null,
  );
  const urgency = deadlineUrgency(event.deadlineOffsetMin, now);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-neutral-900/20"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed top-0 right-0 z-50 flex h-screen w-[440px] flex-col border-l border-neutral-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${type.chip}`}
              >
                {type.short}
              </span>
              <h2 className="truncate text-lg font-semibold text-neutral-900">
                {event.security}
              </h2>
            </div>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">
              {event.isin} · {type.label}
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

        {/* deadline banner */}
        {event.deadlineOffsetMin != null && (
          <div
            className={`flex items-center gap-2 border-b px-5 py-2.5 text-xs font-medium ${
              urgency === "imminent" || urgency === "overdue"
                ? "border-red-200 bg-red-50 text-red-700"
                : urgency === "soon"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-neutral-200 bg-neutral-50 text-neutral-600"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${URGENCY_META[urgency].dot}`} />
            Agent cutoff {fmtDeadline(event.deadlineOffsetMin, now)}
          </div>
        )}

        <div className="grid grid-cols-3 gap-px border-b border-neutral-200 bg-neutral-100">
          {[
            { label: "Position", value: `${compactShares(event.positionShares)} sh` },
            { label: "At risk", value: compactUsd(event.valueAtRisk) },
            { label: "Pay date", value: event.payDate },
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
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
            Terms
          </div>
          <p className="mb-5 text-sm leading-relaxed text-neutral-700">
            {event.terms}
          </p>

          {/* Election options */}
          {event.options && (
            <>
              <div className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                {canElect ? "Choose election" : "Election"}
              </div>
              <div className="space-y-2">
                {event.options.map((opt) => {
                  const isChosen = choice === opt.key;
                  const locked = !canElect;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={locked}
                      onClick={() => setChoice(opt.key)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        isChosen
                          ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                          : "border-neutral-200 hover:border-neutral-300"
                      } ${locked ? "cursor-default opacity-80" : ""}`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isChosen
                            ? "border-neutral-900 bg-neutral-900"
                            : "border-neutral-300"
                        }`}
                      >
                        {isChosen && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-neutral-800">
                          {opt.label}
                        </span>
                        <span className="block text-[11px] text-neutral-500">
                          {opt.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Audit hint */}
          <div className="mt-5 rounded-lg bg-neutral-50 px-3 py-2.5 text-[11px] text-neutral-500 ring-1 ring-neutral-200 ring-inset">
            <span className="font-medium text-neutral-600">Owner</span> {event.owner}
            {" · "}
            ex-date {event.exDate}
            {event.elected && (
              <>
                {" · "}
                <span className="text-neutral-600">
                  instructed{" "}
                  {event.options?.find((o) => o.key === event.elected)?.label}
                </span>
              </>
            )}
          </div>
        </div>

        {/* sticky action bar */}
        <div className="border-t border-neutral-200 bg-neutral-50/60 px-5 py-3">
          {canElect ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!choice}
                onClick={() => choice && onElect(choice)}
                className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
              >
                Submit election
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-center text-[11px] text-neutral-400">
              {event.mandatory
                ? "Mandatory event — no election required"
                : event.stage === "instructed"
                  ? "Election submitted — awaiting agent confirmation"
                  : "No action available at this stage"}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
