import { useState } from "react";

export const title = "Claim - Stage Path";
export const section = "processing";
export const fullWidth = true;

type StageState = "complete" | "current" | "future";

interface Stage {
  label: string;
  state: StageState;
}

interface HighlightField {
  label: string;
  value: string;
}

interface DetailField {
  label: string;
  value: string;
}

interface ApprovalRow {
  step: string;
  date: string;
  assignedTo: string;
  status: "Approved" | "Rejected" | "Pending" | "Submitted";
  comments: string;
}

interface RelatedList {
  title: string;
  count: number;
  items: string[];
}

const STAGES: Stage[] = [
  { label: "Draft", state: "complete" },
  { label: "Submitted", state: "complete" },
  { label: "In Review", state: "current" },
  { label: "Approved", state: "future" },
  { label: "In Production", state: "future" },
];

const HIGHLIGHT_FIELDS: HighlightField[] = [
  { label: "Status", value: "In Review" },
  { label: "Rule Set", value: "EU Withholding Tax v4" },
  { label: "Submitted By", value: "M. Keller (Ops Maker)" },
  { label: "SLA", value: "Due in 6h 20m" },
];

const DETAIL_FIELDS: DetailField[] = [
  { label: "Request ID", value: "RCR-2026-0417" },
  { label: "Record Type", value: "Rule Change Request" },
  { label: "Rule Category", value: "Withholding — Treaty Rate" },
  { label: "Market", value: "Germany (XETRA)" },
  { label: "Security Scope", value: "EU Equities · 1,284 ISINs" },
  { label: "Effective Date", value: "2026-09-01" },
  { label: "Proposed Rate", value: "15.0% (was 26.375%)" },
  { label: "Treaty Source", value: "DE–US DTT Art. 10(2)(b)" },
  { label: "Impact Estimate", value: "~$2.4M annual reclaim delta" },
  { label: "Four-Eyes Required", value: "Yes — Checker approval" },
];

const APPROVAL_HISTORY: ApprovalRow[] = [
  { step: "Checker Review (2nd pass)", date: "2026-08-19 09:12", assignedTo: "S. Park (Ops Checker)", status: "Pending", comments: "Re-review after treaty source attached." },
  { step: "Maker Resubmission", date: "2026-08-18 16:45", assignedTo: "M. Keller (Ops Maker)", status: "Submitted", comments: "Added OECD treaty citation and rate evidence PDF." },
  { step: "Checker Review (1st pass)", date: "2026-08-18 11:03", assignedTo: "S. Park (Ops Checker)", status: "Rejected", comments: "Rejected — missing treaty rate source. Attach DTT article reference before resubmitting." },
  { step: "Initial Submission", date: "2026-08-17 14:30", assignedTo: "M. Keller (Ops Maker)", status: "Submitted", comments: "Rate amendment drafted from custodian notice CN-8841." },
  { step: "Draft Created", date: "2026-08-17 10:02", assignedTo: "M. Keller (Ops Maker)", status: "Approved", comments: "Auto-validation passed: schema + duplicate check." },
];

const RELATED_LISTS: RelatedList[] = [
  {
    title: "Affected Rules",
    count: 2,
    items: ["WHT-DE-EQ-001 · Treaty rate override", "WHT-DE-EQ-014 · Reclaim eligibility"],
  },
  {
    title: "Notifications",
    count: 3,
    items: ["Checker queue alert (S. Park)", "SLA warning — 6h remaining", "Custodian notice CN-8841 linked"],
  },
];

const TABS = ["Details", "Approval History", "Related"] as const;
type Tab = (typeof TABS)[number];

const STATUS_BADGE: Record<ApprovalRow["status"], string> = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Submitted: "bg-sky-50 text-sky-700 border-sky-200",
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.586 2.586a2 2 0 112.828 2.828l-8.793 8.793a1 1 0 01-.44.253l-3.187.91a.5.5 0 01-.618-.618l.91-3.187a1 1 0 01.253-.44l8.793-8.793 .254.254z" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456V15a1 1 0 001 1h2a1 1 0 001-1v-.544c0-1.013.762-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
    </svg>
  );
}

function RuleGlyphIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 4a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
}

const CHEVRON_MID =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)]";
const CHEVRON_FIRST =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]";

function stageClasses(state: StageState): string {
  if (state === "complete") return "bg-teal-600 text-white";
  if (state === "current") return "bg-sky-900 text-white";
  return "bg-slate-200 text-slate-600";
}

function TakeawayCallout({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <LightbulbIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <p className="text-[12px] leading-relaxed text-amber-800">{text}</p>
    </div>
  );
}

export default function DivClaimStagePath() {
  const [activeTab, setActiveTab] = useState<Tab>("Details");

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-[13px] text-slate-700">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Pattern Study · Chevron stage-path layout
        </p>

        {/* Record highlights panel */}
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-700">
                <RuleGlyphIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Rule Change Request</p>
                <h1 className="text-lg font-semibold text-slate-900">EU Equity Withholding — Amend</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-md border border-sky-700 bg-white px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-50">Approve</button>
              <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">Reject</button>
              <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">Reassign</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-t border-slate-100 px-5 py-3 md:grid-cols-4">
            {HIGHLIGHT_FIELDS.map((f) => (
              <div key={f.label}>
                <p className="text-[11px] text-slate-500">{f.label}</p>
                <p className="font-medium text-slate-900">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        <TakeawayCallout text="Takeaway: Highlights panel → pin the key request facts at the top" />

        {/* Path component */}
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center">
              {STAGES.map((stage, i) => (
                <div
                  key={stage.label}
                  className={`${i === 0 ? CHEVRON_FIRST : `-ml-2 ${CHEVRON_MID}`} flex h-8 flex-1 items-center justify-center gap-1.5 px-4 font-medium ${stageClasses(stage.state)}`}
                >
                  {stage.state === "complete" && <CheckIcon className="h-3 w-3" />}
                  <span className="truncate">{stage.label}</span>
                </div>
              ))}
            </div>
            <button className="flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">
              <CheckIcon className="h-3 w-3" />
              Advance to Approved
            </button>
          </div>
        </div>

        <TakeawayCallout text="Takeaway: Path stepper → apply to progress stages in My Requests" />

        {/* Tabs card */}
        <div className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 px-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-4 py-2.5 font-medium ${
                  activeTab === tab
                    ? "border-sky-700 text-sky-800"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Details" && (
            <div className="grid grid-cols-1 gap-x-10 px-5 py-4 md:grid-cols-2">
              {DETAIL_FIELDS.map((f) => (
                <div key={f.label} className="group flex items-center justify-between border-b border-slate-100 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">{f.label}</p>
                    <p className="truncate font-medium text-slate-900">{f.value}</p>
                  </div>
                  <PencilIcon className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}

          {activeTab === "Approval History" && (
            <div className="flex flex-col gap-3 p-4">
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-160 text-left">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Step</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Assigned To</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {APPROVAL_HISTORY.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-sky-800">{row.step}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{row.date}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">{row.assignedTo}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{row.comments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TakeawayCallout text="Takeaway: Approval History table → rejection reasons stay on the record" />
            </div>
          )}

          {activeTab === "Related" && (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              {RELATED_LISTS.map((list) => (
                <div key={list.title} className="rounded-md border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <p className="font-semibold text-slate-800">
                      {list.title} ({list.count})
                    </p>
                    <button className="text-[12px] font-medium text-sky-700 hover:underline">View All</button>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {list.items.map((item) => (
                      <li key={item} className="px-4 py-2 text-sky-800 hover:bg-slate-50">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="md:col-span-2">
                <TakeawayCallout text="Takeaway: Related list cards → browse linked rules and alerts from the request screen" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
