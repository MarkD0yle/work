export const title = "Clearing & Margin";
export const section = "dashboards";

/* Global Markets lifecycle · Stage 6 — Clearing.
 *
 * Design: one lane per clearing house. Each lane tracks today's
 * submissions through novation and carries that CCP's margin call on the
 * right — pay or receive, with the wire deadline front and centre. */

type SubState = "submitted" | "accepted" | "novated" | "rejected";

type Submission = {
  ref: string;
  trade: string;
  state: SubState;
  time: string;
  reason?: string;
};

type CcpLane = {
  ccp: string;
  service: string;
  cutoff: string;
  submissions: Submission[];
};

type MarginCall = {
  direction: "pay" | "receive";
  vm: string;
  im: string;
  total: string;
  deadline: string;
  urgent?: boolean;
};

const LANES: CcpLane[] = [
  {
    ccp: "LCH",
    service: "SwapClear",
    cutoff: "18:00 UTC",
    submissions: [
      { ref: "S-7741", trade: "EUR 10Y IRS · €250M · Meridian", state: "novated", time: "14:21" },
      { ref: "S-7738", trade: "GBP 30Y RPI · £120M · Northgate", state: "accepted", time: "14:05" },
      {
        ref: "S-7735",
        trade: "EUR 2Y IRS · €80M · Bastion LP",
        state: "rejected",
        time: "13:52",
        reason: "Counterparty not enabled for SwapClear — needs client clearing agreement.",
      },
    ],
  },
  {
    ccp: "CME",
    service: "IRS + F&O",
    cutoff: "19:30 UTC",
    submissions: [
      { ref: "S-7742", trade: "USD 5Y IRS · $140M · Halcyon", state: "novated", time: "14:26" },
      { ref: "S-7740", trade: "ZN Dec26 futures give-up · 340 lots", state: "novated", time: "14:15" },
    ],
  },
  {
    ccp: "Eurex",
    service: "OTC Clear",
    cutoff: "17:00 UTC",
    submissions: [
      { ref: "S-7739", trade: "EUR 5Y IRS · €60M · Halcyon", state: "submitted", time: "14:11" },
    ],
  },
  {
    ccp: "ICE",
    service: "CDS Clear",
    cutoff: "20:00 UTC",
    submissions: [
      { ref: "S-7736", trade: "CDX IG 5Y · $75M · Halcyon", state: "accepted", time: "13:58" },
      { ref: "S-7733", trade: "CDX HY 5Y · $25M · Vela", state: "novated", time: "13:40" },
    ],
  },
];

const MARGIN: Record<string, MarginCall> = {
  LCH: { direction: "pay", vm: "$8.4M", im: "$2.1M", total: "$10.5M", deadline: "15:00", urgent: true },
  CME: { direction: "receive", vm: "$3.2M", im: "—", total: "$3.2M", deadline: "16:30" },
  Eurex: { direction: "pay", vm: "€1.1M", im: "€0.4M", total: "€1.5M", deadline: "15:45" },
  ICE: { direction: "pay", vm: "$0.9M", im: "$0.3M", total: "$1.2M", deadline: "17:00" },
};

const STEPS: SubState[] = ["submitted", "accepted", "novated"];

const STATE_LABEL: Record<SubState, string> = {
  submitted: "Submitted",
  accepted: "Accepted",
  novated: "Novated",
  rejected: "Rejected",
};

function StepDots({ state }: { state: SubState }) {
  if (state === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
        <span className="h-2.5 w-2.5 bg-rose-500" aria-hidden />
        Rejected
      </span>
    );
  }
  const idx = STEPS.indexOf(state);
  return (
    <span className="inline-flex items-center gap-1">
      {STEPS.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span
            className={`h-2.5 w-2.5 ${
              i < idx ? "bg-emerald-300" : i === idx ? "bg-emerald-500" : "bg-neutral-200"
            }`}
            aria-hidden
          />
          {i < STEPS.length - 1 && <span className="h-px w-3 bg-neutral-200" aria-hidden />}
        </span>
      ))}
      <span className="ml-2 text-xs font-medium text-neutral-600">{STATE_LABEL[state]}</span>
    </span>
  );
}

export default function GmClearingMargin() {
  const novated = LANES.flatMap((l) => l.submissions).filter((s) => s.state === "novated").length;
  const rejected = LANES.flatMap((l) => l.submissions).filter((s) => s.state === "rejected").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Global markets · Lifecycle 06 — Clearing
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Clearing &amp; Margin</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Today's CCP submissions and what each clearing house is calling for.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-emerald-600">{novated}</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Novated</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-rose-600">{rejected}</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Rejected</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900">$16.4M</p>
            <p className="text-[11px] uppercase tracking-wide text-neutral-400">Net to pay</p>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {LANES.map((lane) => {
          const margin = MARGIN[lane.ccp];
          const pay = margin.direction === "pay";
          return (
            <div key={lane.ccp} className="grid grid-cols-1 border border-neutral-200 bg-white lg:grid-cols-[1fr_240px]">
              {/* Submissions */}
              <div>
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-neutral-900">{lane.ccp}</span>
                    <span className="text-xs text-neutral-400">{lane.service}</span>
                  </div>
                  <span className="text-xs text-neutral-400">Cut-off {lane.cutoff}</span>
                </div>
                <ul className="divide-y divide-neutral-50">
                  {lane.submissions.map((s) => (
                    <li key={s.ref} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] text-neutral-400">{s.ref}</span>
                          <span className="text-sm text-neutral-800">{s.trade}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] text-neutral-400">{s.time}</span>
                          <StepDots state={s.state} />
                        </div>
                      </div>
                      {s.reason && (
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-l-2 border-rose-400 bg-rose-50/60 py-1.5 pl-3 pr-2">
                          <p className="text-xs text-rose-700">{s.reason}</p>
                          <button
                            type="button"
                            className="bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                          >
                            Resubmit bilateral
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Margin call */}
              <div
                className={`flex flex-col justify-between border-t border-neutral-200 p-4 lg:border-l lg:border-t-0 ${
                  pay ? "bg-amber-50/50" : "bg-emerald-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      Margin call
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        pay ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
                      }`}
                    >
                      {pay ? "We pay" : "We receive"}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">{margin.total}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    VM {margin.vm} · IM {margin.im}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      margin.urgent ? "text-rose-600" : "text-neutral-500"
                    }`}
                  >
                    {margin.urgent ? "⚠ " : ""}Wire by {margin.deadline}
                  </span>
                  {pay && (
                    <button
                      type="button"
                      className="bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
                    >
                      Instruct
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
