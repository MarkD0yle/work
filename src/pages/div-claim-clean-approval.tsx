import { useState } from "react";

export const title = "Div Claim - Clean Approval";
export const section = "processing";
export const fullWidth = true;

/* Pattern study — clean SaaS-dashboard treatment of the rule change
 * request detail screen (maker-checker approval). Evaluates whether a
 * light visual language (white surfaces, 13px type, indigo accent, thin
 * borders, right metadata rail) fits our dividend-processing system.
 */

interface DiffRow {
  field: string;
  before: string;
  after: string;
}

interface TimelineEvent {
  label: string;
  detail?: string;
  actor: string;
  time: string;
  kind: "done" | "comment" | "current";
}

interface MetaRow {
  label: string;
  value: string;
  avatar?: string;
}

interface NotificationItem {
  tone: "approved" | "rejected";
  text: string;
  time: string;
  unread: boolean;
}

const DIFF_ROWS: DiffRow[] = [
  { field: "withholding_rate_source", before: "STATIC_TABLE_2024", after: "VENDOR_FEED_ICE" },
  { field: "claim_window_days", before: "30", after: "45" },
  { field: "min_claim_amount", before: "USD 25.00", after: "USD 10.00" },
  { field: "entitlement_rounding", before: "ROUND_HALF_UP", after: "ROUND_DOWN" },
  { field: "auto_release_threshold", before: "USD 5,000", after: "USD 2,500" },
];

const TIMELINE: TimelineEvent[] = [
  { label: "Request submitted", actor: "J. Lee", time: "Aug 18, 09:14", kind: "done" },
  { label: "Auto-validation passed", detail: "12 checks · 0 warnings", actor: "System", time: "Aug 18, 09:15", kind: "done" },
  { label: "Assigned to approver", actor: "M. Chen", time: "Aug 18, 10:02", kind: "done" },
  { label: "Comment", detail: "“Please confirm withholding rate source — is the ICE feed certified for LU domicile?”", actor: "M. Chen", time: "Aug 18, 14:37", kind: "comment" },
  { label: "Awaiting approver decision", actor: "M. Chen", time: "Now", kind: "current" },
];

const META_ROWS: MetaRow[] = [
  { label: "Request ID", value: "REQ-2041" },
  { label: "Type", value: "Amend" },
  { label: "Rule set", value: "Dividend Claim Rules" },
  { label: "Submitted", value: "Aug 18, 2026 09:14" },
  { label: "SLA", value: "2 days remaining" },
  { label: "Current owner", value: "M. Chen", avatar: "MC" },
];

const NOTIFICATIONS: NotificationItem[] = [
  { tone: "approved", text: "REQ-2038 “JP Equity Entitlement v2” was approved by M. Chen", time: "2h ago", unread: true },
  { tone: "rejected", text: "REQ-2035 “DE Tax Reclaim Split” was rejected — see comments", time: "Yesterday", unread: false },
];

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
    <path fillRule="evenodd" d="M10 2c-4.418 0-8 3.134-8 7 0 1.741.73 3.333 1.938 4.559-.148.885-.504 1.7-1.038 2.386a.5.5 0 00.393.805 6.98 6.98 0 003.582-1.02A9.02 9.02 0 0010 16c4.418 0 8-3.134 8-7s-3.582-7-8-7z" clipRule="evenodd" />
  </svg>
);

const BulbIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true">
    <path d="M10 2a6 6 0 00-3.815 10.631c.375.312.599.745.68 1.21l.088.509h6.094l.088-.51c.081-.464.305-.897.68-1.209A6 6 0 0010 2zM8.5 16a.5.5 0 000 1h3a.5.5 0 000-1h-3zm.75 2a.5.5 0 000 1h1.5a.5.5 0 000-1h-1.5z" />
  </svg>
);

function Callout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
      <BulbIcon />
      <span>{text}</span>
    </div>
  );
}

export default function DivClaimCleanApproval() {
  const [env, setEnv] = useState<"sandbox" | "production">("production");

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans text-[13px] text-slate-700 antialiased">
      {/* Top bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex items-center gap-1.5 text-slate-500">
            <span className="hover:text-slate-700">Rules</span>
            <span className="text-slate-300">/</span>
            <span className="hover:text-slate-700">Requests</span>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">REQ-2041</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-neutral-200 bg-slate-100 p-0.5 text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setEnv("sandbox")}
                className={`rounded-full px-3 py-1 transition-colors ${env === "sandbox" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
              >
                Sandbox rules
              </button>
              <button
                type="button"
                onClick={() => setEnv("production")}
                className={`rounded-full px-3 py-1 transition-colors ${env === "production" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
              >
                Production rules
              </button>
            </div>
            <button
              type="button"
              className="rounded-md bg-indigo-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Review request
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-4">
        <div className="mb-5">
          <Callout text="Takeaway: environment toggle (Sandbox | Production) → applied to the Draft vs Production rule switch UI" />
        </div>

        <div className="flex items-start gap-8">
          {/* LEFT column */}
          <div className="min-w-0 flex-1">
            {/* Request header */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rule change request</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  US Equity Cash Dividend — Claim Calc v3
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[12px] font-medium text-indigo-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  In review
                </span>
              </div>
              <p className="mt-1 text-slate-500">
                Amendment to the claim calculation rule for US-domiciled equity cash dividends. Effective on approval.
              </p>
            </div>

            {/* Diff block */}
            <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h2 className="text-[13px] font-semibold text-slate-900">Proposed changes</h2>
                <span className="text-[12px] text-slate-400">{DIFF_ROWS.length} fields</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {DIFF_ROWS.map((row) => (
                  <div key={row.field} className="grid grid-cols-[minmax(180px,1.2fr)_1fr_auto_1fr] items-center gap-3 px-4 py-2.5">
                    <span className="truncate font-mono text-[12px] text-slate-500">{row.field}</span>
                    <span className="justify-self-start rounded bg-red-50 px-1.5 py-0.5 font-mono text-[12px] text-red-600 line-through decoration-red-300">
                      {row.before}
                    </span>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-300" aria-hidden="true">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                    <span className="justify-self-start rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[12px] font-medium text-emerald-700">
                      {row.after}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Callout text="Takeaway: field-level before/after diff → applied to the change-review block on the Approver Review screen" />
            </div>

            {/* Timeline */}
            <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-[13px] font-semibold text-slate-900">Activity</h2>
              <ol className="relative ml-2 border-l border-neutral-200 pl-6">
                {TIMELINE.map((ev, i) => (
                  <li key={ev.label + ev.time} className={i === TIMELINE.length - 1 ? "" : "pb-5"}>
                    <span
                      className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white ${
                        ev.kind === "current"
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : ev.kind === "comment"
                            ? "bg-slate-100 text-slate-400"
                            : "bg-indigo-600 text-white"
                      }`}
                    >
                      {ev.kind === "done" && <CheckIcon />}
                      {ev.kind === "comment" && <ChatIcon />}
                      {ev.kind === "current" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600" />}
                    </span>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className={`font-medium ${ev.kind === "current" ? "text-indigo-700" : "text-slate-900"}`}>{ev.label}</p>
                      <span className="whitespace-nowrap text-[12px] text-slate-400">{ev.time}</span>
                    </div>
                    {ev.detail && <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{ev.detail}</p>}
                    <p className="mt-0.5 text-[12px] text-slate-400">{ev.actor}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-3">
              <Callout text="Takeaway: activity timeline (dot + vertical line) → applied to the progress history on the My Requests detail screen" />
            </div>
          </div>

          {/* RIGHT rail */}
          <aside className="w-[320px] shrink-0">
            <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-4 py-3">
                <h2 className="text-[13px] font-semibold text-slate-900">Details</h2>
              </div>
              <dl className="divide-y divide-neutral-100">
                {META_ROWS.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-[12px] text-slate-500">{row.label}</dt>
                    <dd className="flex items-center gap-2 text-right font-medium text-slate-900">
                      {row.avatar && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                          {row.avatar}
                        </span>
                      )}
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-4 rounded-lg border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h2 className="text-[13px] font-semibold text-slate-900">Notifications</h2>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">In-app</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.text} className="flex items-start gap-2.5 px-4 py-3">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.unread ? "bg-indigo-500" : "bg-transparent"}`} />
                    <div className="min-w-0">
                      <p className="leading-snug text-slate-700">
                        <span className={`mr-1.5 rounded px-1 py-px text-[11px] font-semibold ${n.tone === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                          {n.tone === "approved" ? "Approved" : "Rejected"}
                        </span>
                        {n.text}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <Callout text="Takeaway: right metadata rail → keep the current owner and SLA always visible on the detail screen" />
            </div>

            <p className="mt-6 text-center text-[11px] text-slate-400">Clean SaaS-dashboard approval layout · pattern study</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
