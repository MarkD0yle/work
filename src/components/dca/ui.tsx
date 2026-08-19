/* Shared UI primitives for the Div Claim Automation prototype.
 * All colors come from the theme tokens defined on the page root (.dca). */

import type { ReactNode } from "react";
import type { FieldChange, RequestStatus, WfRequest } from "./types";
import { useDca } from "./store";

/* ---------- Badges ---------- */

export type Tone = "green" | "gray" | "amber" | "red" | "blue";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`dca-badge dca-b-${tone}`}>{children}</span>;
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "Active":
    case "Approved":
    case "Matched":
    case "Confirmed":
    case "Paid":
      return "green";
    case "Submitted":
    case "In Review":
    case "Pending":
    case "Announced":
      return "amber";
    case "Rejected":
    case "Discrepancy":
      return "red";
    case "Draft":
      return "blue";
    default:
      return "gray";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

/* ---------- Buttons ---------- */

export function Btn({
  kind = "secondary",
  onClick,
  disabled,
  title,
  children,
  small,
}: {
  kind?: "primary" | "secondary" | "danger" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`dca-btn dca-btn-${kind} ${small ? "dca-btn-sm" : ""}`}
    >
      {children}
    </button>
  );
}

/* ---------- Icons (20x20 inline) ---------- */

const I = ({ d, className = "h-3.5 w-3.5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d={d} clipRule="evenodd" />
  </svg>
);

export const Icons = {
  search: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.33 3.33a.75.75 0 1 1-1.06 1.06l-3.33-3.33A7 7 0 0 1 2 9Z" />
  ),
  x: (c?: string) => (
    <I className={c ?? "h-3 w-3"} d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
  ),
  chevronDown: (c?: string) => (
    <I className={c ?? "h-3 w-3"} d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
  ),
  chevronLeft: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M12.78 5.22a.75.75 0 0 1 0 1.06L9.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" />
  ),
  chevronRight: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M7.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L10.94 10 7.22 6.28a.75.75 0 0 1 0-1.06Z" />
  ),
  bell: (c?: string) => (
    <I className={c ?? "h-4 w-4"} d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.9 32.9 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.9 32.9 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.45 11.45 0 0 1 16 8a6 6 0 0 0-6-6ZM8.05 14.943a33.5 33.5 0 0 0 3.9 0 2 2 0 0 1-3.9 0Z" />
  ),
  sun: (c?: string) => (
    <I className={c ?? "h-4 w-4"} d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.66 5.4a.75.75 0 0 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.46 14.6a.75.75 0 0 0-1.06-1.06L4.34 14.6a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.6 15.66a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 0 0-1.06 1.06l1.06 1.06ZM5.4 6.46A.75.75 0 0 0 6.46 5.4L5.4 4.34A.75.75 0 0 0 4.34 5.4l1.06 1.06Z" />
  ),
  moon: (c?: string) => (
    <I className={c ?? "h-4 w-4"} d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" />
  ),
  pencil: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.732 5.44 4 13.172V16h2.828l7.732-7.732-2.828-2.828Z" />
  ),
  off: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM5.5 9.25a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z" />
  ),
  export: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75ZM3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
  ),
  check: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M16.7 5.15a.75.75 0 0 1 .14 1.05l-8 10.5a.75.75 0 0 1-1.12.08l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.89 3.89 7.48-9.82a.75.75 0 0 1 1.05-.14Z" />
  ),
  plus: (c?: string) => (
    <I className={c ?? "h-3.5 w-3.5"} d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
  ),
  collapse: (c?: string) => (
    <I className={c ?? "h-4 w-4"} d="M3 4.75A.75.75 0 0 1 3.75 4h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 4.75ZM3 10a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 10Zm0 5.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
  ),
  link: (c?: string) => (
    <I className={c ?? "h-3 w-3"} d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3ZM8.603 17.53a4 4 0 0 0 5.656-5.656l-.225-.225a.75.75 0 0 0-1.061 1.06l.225.226a2.5 2.5 0 0 1-3.535 3.535l-3-3a2.5 2.5 0 0 1 .141-3.666.75.75 0 0 0-.977-1.139 4 4 0 0 0-.224 5.865l3 3Z" />
  ),
};

/* ---------- Definition list ---------- */

export function DL({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,180px)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="dca-muted">{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Empty state ---------- */

export function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="dca-card px-6 py-14 text-center">
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="dca-faint mt-1 text-xs">{sub}</p>}
    </div>
  );
}

/* ---------- Modal shell ---------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { theme } = useDca();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-6 pt-12">
      <div data-theme={theme} className={`dca dca-modal w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="dca-modal-head flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="dca-iconbtn" aria-label="Close">
            {Icons.x("h-3.5 w-3.5")}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="dca-modal-foot flex items-center justify-end gap-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Progress stepper ---------- */

export function RequestStepper({ req }: { req: WfRequest }) {
  const rejected = req.status === "Rejected";
  const steps: { label: string; state: "done" | "current" | "todo" | "rejected" }[] = [];
  const order: RequestStatus[] = ["Draft", "Submitted", "In Review", "Approved"];
  const idx =
    req.status === "Approved" ? 4 : rejected ? 3 : order.indexOf(req.status);
  const labels = ["Draft", "Submitted", "In Review", rejected ? "Rejected" : "Approved", "In Production"];
  labels.forEach((label, i) => {
    if (rejected && i === 3) steps.push({ label, state: "rejected" });
    else if (rejected && i === 4) steps.push({ label, state: "todo" });
    else if (i < idx) steps.push({ label, state: "done" });
    else if (i === idx) steps.push({ label, state: req.status === "Approved" ? "done" : "current" });
    else steps.push({ label, state: "todo" });
  });
  if (req.status === "Approved") steps[4] = { label: "In Production", state: "done" };

  const activeIdx = rejected ? 3 : req.status === "Approved" ? 4 : idx;

  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <div className={`h-px flex-1 ${i === 0 ? "opacity-0" : ""} dca-step-line ${i <= activeIdx ? "dca-step-line-done" : ""}`} />
            <span className={`dca-step-dot dca-step-${s.state}`}>
              {s.state === "done" ? Icons.check("h-2.5 w-2.5") : s.state === "rejected" ? Icons.x("h-2.5 w-2.5") : null}
            </span>
            <div className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : ""} dca-step-line ${i < activeIdx ? "dca-step-line-done" : ""}`} />
          </div>
          <span className={`mt-1.5 text-[10px] font-medium uppercase tracking-wide ${i === activeIdx ? "" : "dca-faint"}`}>
            {s.label}
          </span>
          {i === activeIdx && req.assignee && (req.status === "Submitted" || req.status === "In Review") && (
            <span className="dca-accent-text mt-0.5 text-[10px]">{req.assignee} (Approver)</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ---------- Before / After diff ---------- */

export function DiffView({ changes, createMode }: { changes: FieldChange[]; createMode?: boolean }) {
  if (createMode) {
    return (
      <div className="dca-panel p-3">
        <p className="dca-muted mb-2 text-[11px] font-semibold uppercase tracking-wide">New record summary</p>
        <DL rows={changes.map((c) => ({ label: c.field, value: <span className="dca-diff-after">{c.after || "N/A"}</span> }))} />
      </div>
    );
  }
  return (
    <div className="dca-panel overflow-hidden">
      <div className="dca-diff-head grid grid-cols-[minmax(0,160px)_1fr_1fr] gap-x-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <span>Field</span>
        <span>Before</span>
        <span>After</span>
      </div>
      {changes.map((c) => (
        <div key={c.field} className="dca-diff-row grid grid-cols-[minmax(0,160px)_1fr_1fr] gap-x-3 px-3 py-2 text-[13px]">
          <span className="dca-muted">{c.field}</span>
          <span className="dca-diff-before">{c.before ?? "—"}</span>
          <span className="dca-diff-after font-medium">{c.after || "N/A"}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Request timeline ---------- */

export function Timeline({ req }: { req: WfRequest }) {
  return (
    <ol className="space-y-0">
      {req.timeline.map((t, i) => (
        <li key={`${t.label}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
          <div className="flex flex-col items-center">
            <span className={`dca-tl-dot ${i === req.timeline.length - 1 ? "dca-tl-dot-last" : ""}`} />
            {i < req.timeline.length - 1 && <span className="dca-tl-line w-px flex-1" />}
          </div>
          <div className="-mt-0.5 text-[12px]">
            <span className="font-medium">{t.label}</span>
            <span className="dca-muted"> · {t.actor}</span>
            <span className="dca-faint block text-[11px]">{t.time}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Toast host ---------- */

export function ToastHost() {
  const { toasts, dismissToast, navigate } = useDca();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="dca-toast pointer-events-auto flex items-start gap-2 px-3 py-2.5 text-[12px]">
          <span className="flex-1">
            {t.text}
            {t.link && (
              <button
                type="button"
                className="dca-accent-text ml-1.5 font-medium underline underline-offset-2"
                onClick={() => {
                  navigate(t.link!.route);
                  dismissToast(t.id);
                }}
              >
                {t.link.label}
              </button>
            )}
          </span>
          <button type="button" onClick={() => dismissToast(t.id)} className="dca-iconbtn" aria-label="Dismiss">
            {Icons.x()}
          </button>
        </div>
      ))}
    </div>
  );
}
