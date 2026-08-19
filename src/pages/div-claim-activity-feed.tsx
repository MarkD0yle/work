export const title = "Div Claim - Activity Feed";
export const section = "processing";
export const fullWidth = true;

type StepState = "done" | "current" | "future";

type ProgressStep = {
  label: string;
  state: StepState;
};

type NotificationKind = "approved" | "rejected" | "assigned" | "info";

type FeedItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  rejection?: boolean;
};

type DividendEvent = {
  ticker: string;
  line: string;
  amount: string;
  sub: string;
};

type Callout = {
  heading: string;
  body: string;
};

const steps: ProgressStep[] = [
  { label: "Submitted", state: "done" },
  { label: "Validated", state: "done" },
  { label: "In review", state: "current" },
  { label: "Live", state: "future" },
];

const feed: FeedItem[] = [
  {
    id: "n1",
    kind: "assigned",
    title: "REQ-2041 assigned to M. Chen",
    detail: "Your rule change moved to the review queue",
    time: "2h ago",
    unread: true,
  },
  {
    id: "n2",
    kind: "approved",
    title: "REQ-2038 approved",
    detail: "FX conversion rule for JPY payouts is now live",
    time: "5h ago",
    unread: true,
  },
  {
    id: "n3",
    kind: "rejected",
    title: "REQ-2035 rejected",
    detail: "Rejected: withholding source must reference treaty table v2",
    time: "Yesterday",
    unread: false,
    rejection: true,
  },
  {
    id: "n4",
    kind: "info",
    title: "Batch window reminder",
    detail: "EMEA payout batch closes today at 4:00 PM ET",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n5",
    kind: "approved",
    title: "REQ-2031 approved",
    detail: "Rounding precision update applied to 3 payout rules",
    time: "2d ago",
    unread: false,
  },
  {
    id: "n6",
    kind: "info",
    title: "Reviewer roster updated",
    detail: "K. Ito joined the checker pool for APAC rules",
    time: "3d ago",
    unread: false,
  },
];

const dividends: DividendEvent[] = [
  { ticker: "AAPL", line: "Ex-date in 2 days", amount: "$0.26", sub: "per share" },
  { ticker: "MSFT", line: "Ex-date in 5 days", amount: "$0.83", sub: "per share" },
  { ticker: "JNJ", line: "Pay date in 1 week", amount: "$1.24", sub: "per share" },
  { ticker: "KO", line: "Record date in 9 days", amount: "$0.49", sub: "per share" },
];

const callouts: Callout[] = [
  {
    heading: "Order-status-card progress display",
    body: "One request shown large, like a consumer-fintech order status card → adopted as the summary card at the top of My Requests.",
  },
  {
    heading: "Status written in plain language",
    body: "One sentence carrying the owner and ETA, like \"M. Chen is reviewing…\" → applied to the next-approver / ETA display.",
  },
  {
    heading: "Feed-style alerts + inline rejection reasons",
    body: "Rejection reasons shown right in the feed with a Fix & resubmit button → the in-app notification panel pattern.",
  },
  {
    heading: "Relative timestamps",
    body: "Relative times like \"in 2 days\" convey urgency more intuitively than dates → adopted for the ex-date urgency display.",
  },
];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6.28 4.86a1 1 0 0 0-1.42 1.42L8.59 10l-3.73 3.72a1 1 0 1 0 1.42 1.42L10 11.41l3.72 3.73a1 1 0 0 0 1.42-1.42L11.41 10l3.73-3.72a1 1 0 0 0-1.42-1.42L10 8.59 6.28 4.86Z" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h4.09c.4 0 .78.16 1.06.44l2.91 2.91c.28.28.44.66.44 1.06v9.09A1.5 1.5 0 0 1 13.5 17h-7A1.5 1.5 0 0 1 5 15.5v-12Zm2.5 5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 2a5 5 0 0 0-5 5v2.2c0 .55-.18 1.08-.5 1.52l-1 1.36A1 1 0 0 0 4.3 13.7h11.4a1 1 0 0 0 .8-1.62l-1-1.36a2.56 2.56 0 0 1-.5-1.52V7a5 5 0 0 0-5-5Zm0 15a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 10 17Z" />
    </svg>
  );
}

function LampIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 2a5.5 5.5 0 0 0-3.1 10.04c.5.35.85.88.96 1.46h4.28c.11-.58.46-1.11.96-1.46A5.5 5.5 0 0 0 10 2Zm-2 12.75v.25a2 2 0 1 0 4 0v-.25H8Z" />
    </svg>
  );
}

const feedIconStyle: Record<NotificationKind, { bg: string; fg: string }> = {
  approved: { bg: "bg-emerald-100", fg: "text-emerald-600" },
  rejected: { bg: "bg-red-100", fg: "text-red-500" },
  assigned: { bg: "bg-blue-100", fg: "text-blue-500" },
  info: { bg: "bg-gray-100", fg: "text-gray-500" },
};

function FeedIcon({ kind }: { kind: NotificationKind }) {
  const style = feedIconStyle[kind];
  const icon =
    kind === "approved" ? (
      <CheckIcon className="h-4 w-4" />
    ) : kind === "rejected" ? (
      <XIcon className="h-4 w-4" />
    ) : kind === "assigned" ? (
      <DocIcon className="h-4 w-4" />
    ) : (
      <BellIcon className="h-4 w-4" />
    );
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.fg}`}>
      {icon}
    </div>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon className="h-4 w-4" />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-4 ring-emerald-200">
        <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-emerald-500" />
      </div>
    );
  }
  return <div className="h-7 w-7 rounded-full border-2 border-gray-200 bg-white" />;
}

export default function DivClaimActivityFeed() {
  return (
    <div className="min-h-screen bg-white py-14 text-gray-900">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-600">
          Pattern Study · Processing
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Consumer-grade status &amp; notifications</h1>
        <p className="mt-2 text-sm text-gray-500">
          Consumer-fintech-style activity feed — applied to maker-checker request tracking.
        </p>

        {/* Hero status card */}
        <section className="mt-10 rounded-lg bg-gray-50 p-8">
          <p className="text-sm text-gray-500">Your rule change request · REQ-2041</p>
          <h2 className="mt-1 text-3xl font-bold text-emerald-600">In review</h2>

          <div className="mt-8">
            <div className="flex items-center">
              {steps.map((step, i) => (
                <div key={step.label} className="flex flex-1 items-center last:flex-none">
                  <StepDot state={step.state} />
                  {i < steps.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 rounded-full ${
                        step.state === "done" ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between">
              {steps.map((step) => (
                <span
                  key={step.label}
                  className={`text-xs font-medium ${
                    step.state === "future" ? "text-gray-400" : "text-gray-700"
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-gray-600">
            M. Chen is reviewing your request. Typically takes 1–2 business days.
          </p>
        </section>

        {/* Notification feed */}
        <section className="mt-14">
          <h3 className="text-lg font-semibold">Activity</h3>
          <div className="mt-2 divide-y divide-gray-100">
            {feed.map((item) => (
              <div key={item.id} className="flex items-start gap-4 py-5">
                <FeedIcon kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className={`mt-0.5 text-sm ${item.rejection ? "text-red-600" : "text-gray-500"}`}>
                    {item.detail}
                  </p>
                  {item.rejection && (
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Fix &amp; resubmit
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="text-xs text-gray-400">{item.time}</span>
                  {item.unread && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming dividends timeline */}
        <section className="mt-14">
          <h3 className="text-lg font-semibold">Upcoming dividends</h3>
          <div className="mt-2 divide-y divide-gray-100">
            {dividends.map((d) => (
              <div key={d.ticker} className="flex items-center gap-4 py-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                  {d.ticker.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{d.ticker}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{d.line}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tracking-tight">{d.amount}</p>
                  <p className="text-xs text-gray-400">{d.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Korean annotation callouts */}
        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          {callouts.map((c) => (
            <div key={c.heading} className="rounded-lg bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-amber-700">
                <LampIcon className="h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">Takeaway: {c.heading}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/80">{c.body}</p>
            </div>
          ))}
        </section>

        <p className="mt-14 pb-6 text-center text-xs text-gray-400">
          Internal pattern study only. No affiliation with any consumer fintech brand.
        </p>
      </div>
    </div>
  );
}
