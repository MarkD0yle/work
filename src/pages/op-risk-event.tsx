import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Op-Risk Event";
export const fullWidth = true;

/* Operational Risk Event Capture — page-level demo of a multi-step Modal wizard.
 * Page shows logged loss events as a triage pipeline; primary action opens the
 * wizard. Inside the modal: a stepper rail on the left, the form on the right,
 * a footer with Back / Next / Submit. The modal owns the entire decision —
 * focus is trapped, Esc abandons, Submit closes back to the list with a new
 * "logged" entry routed to triage. */

type Step = "event" | "classify" | "impact" | "control" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "event", label: "What happened", help: "Describe the operational event." },
  { id: "classify", label: "Classification", help: "Basel event type and business line." },
  { id: "impact", label: "Impact", help: "Financial and recovery." },
  { id: "control", label: "Cause & control", help: "Root cause and remediation." },
  { id: "review", label: "Review", help: "Confirm before logging." },
];

type BusinessLine =
  | "trading"
  | "settlements"
  | "treasury"
  | "custody"
  | "asset-servicing";

type EventType =
  | "internal-fraud"
  | "external-fraud"
  | "employment"
  | "clients-products"
  | "physical-assets"
  | "business-disruption"
  | "execution-delivery";

const BUSINESS_LINE_LABELS: Record<BusinessLine, string> = {
  trading: "Trading & sales",
  settlements: "Settlements",
  treasury: "Treasury",
  custody: "Custody",
  "asset-servicing": "Asset servicing",
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "internal-fraud": "Internal fraud",
  "external-fraud": "External fraud",
  employment: "Employment practices & workplace safety",
  "clients-products": "Clients, products & business practices",
  "physical-assets": "Damage to physical assets",
  "business-disruption": "Business disruption & system failures",
  "execution-delivery": "Execution, delivery & process management",
};

type FormState = {
  title: string;
  dateOccurred: string;
  dateDiscovered: string;
  businessLine: BusinessLine;
  eventType: EventType;
  grossLoss: string;
  recovery: string;
  ccy: "USD" | "EUR" | "GBP";
  rootCause: string;
  controlFailure: string;
  remediationOwner: string;
  targetDate: string;
};

const EMPTY: FormState = {
  title: "",
  dateOccurred: "",
  dateDiscovered: "",
  businessLine: "trading",
  eventType: "execution-delivery",
  grossLoss: "",
  recovery: "",
  ccy: "USD",
  rootCause: "",
  controlFailure: "",
  remediationOwner: "",
  targetDate: "",
};

type Submitted = {
  id: string;
  title: string;
  businessLine: BusinessLine;
  eventType: EventType;
  netLoss: string;
  ccy: FormState["ccy"];
  submittedAt: string;
  stage: "triage" | "investigation" | "closed";
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "OPR-00318",
    title: "Duplicate USD wire to counterparty — failed stop on payment queue",
    businessLine: "settlements",
    eventType: "execution-delivery",
    netLoss: "420000",
    ccy: "USD",
    submittedAt: "2026-05-27T15:42:00Z",
    stage: "triage",
  },
  {
    id: "OPR-00317",
    title: "Fat-finger order — notional entered 10x on rates desk",
    businessLine: "trading",
    eventType: "execution-delivery",
    netLoss: "1850000",
    ccy: "EUR",
    submittedAt: "2026-05-23T08:11:00Z",
    stage: "investigation",
  },
  {
    id: "OPR-00316",
    title: "Missed dividend election on corporate action — client shortfall",
    businessLine: "asset-servicing",
    eventType: "clients-products",
    netLoss: "96500",
    ccy: "GBP",
    submittedAt: "2026-05-19T13:05:00Z",
    stage: "closed",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  triage: "bg-blue-100 text-blue-700",
  investigation: "bg-amber-100 text-amber-800",
  closed: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 130px 110px 120px 130px";
const PIPELINE_MIN = 820;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  triage: "Triage",
  investigation: "Investigation",
  closed: "Closed",
};

function fmtMoney(amount: string, ccy: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${ccy} ${(n / 1_000_000_000).toFixed(2)}b`;
  if (n >= 1_000_000) return `${ccy} ${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${ccy} ${(n / 1_000).toFixed(0)}k`;
  return `${ccy} ${n}`;
}

function validate(step: Step, f: FormState): string | null {
  if (step === "event") {
    if (!f.title.trim()) return "Event title is required.";
    if (!f.dateOccurred) return "Date occurred is required.";
    if (!f.dateDiscovered) return "Date discovered is required.";
  }
  if (step === "classify") {
    return null;
  }
  if (step === "impact") {
    const gross = Number(f.grossLoss);
    if (f.grossLoss === "" || !Number.isFinite(gross) || gross < 0)
      return "Gross loss must be a non-negative number.";
    const recovery = Number(f.recovery);
    if (f.recovery === "" || !Number.isFinite(recovery) || recovery < 0)
      return "Recovery must be a non-negative number.";
    if (recovery > gross) return "Recovery cannot exceed gross loss.";
  }
  if (step === "control") {
    if (!f.rootCause.trim()) return "Root cause is required.";
    if (!f.remediationOwner.trim()) return "Remediation owner is required.";
  }
  return null;
}

export default function OpRiskEventPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("event");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("event");
    setError(null);
    setOpen(true);
  }

  function next() {
    const err = validate(step, form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const nextStep = STEPS[stepIdx + 1];
    if (nextStep) setStep(nextStep.id);
  }

  function back() {
    setError(null);
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev.id);
  }

  function submit() {
    const err = validate("impact", form);
    if (err) {
      setError(err);
      setStep("impact");
      return;
    }
    const ctrlErr = validate("control", form);
    if (ctrlErr) {
      setError(ctrlErr);
      setStep("control");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `OPR-${String(318 + pipeline.length + 1).padStart(5, "0")}`;
      const netLoss = String(
        Math.max(0, Number(form.grossLoss) - Number(form.recovery)),
      );
      setPipeline((prev) => [
        {
          id,
          title: form.title,
          businessLine: form.businessLine,
          eventType: form.eventType,
          netLoss,
          ccy: form.ccy,
          submittedAt: new Date().toISOString(),
          stage: "triage",
        },
        ...prev,
      ]);
      setSubmitting(false);
      setOpen(false);
    }, 600);
  }

  const counts = useMemo(() => {
    return {
      total: pipeline.length,
      triage: pipeline.filter((p) => p.stage === "triage").length,
      investigation: pipeline.filter((p) => p.stage === "investigation").length,
      closed: pipeline.filter((p) => p.stage === "closed").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Operational Risk
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Operational Risk Event Capture
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The capture wizard lives in a focus-trapped modal — one event, no
            distraction. Submit drops back here with the new loss event logged
            and routed to triage.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Log event
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total events" value={counts.total} />
          <SummaryTile label="Triage" value={counts.triage} tone="blue" />
          <SummaryTile
            label="Investigation"
            value={counts.investigation}
            tone="amber"
          />
          <SummaryTile label="Closed" value={counts.closed} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Event</div>
            <div>Description</div>
            <div>Business line</div>
            <div className="text-right">Net loss</div>
            <div>Logged</div>
            <div>Stage</div>
          </div>
          {pipeline.map((p) => (
            <div
              key={p.id}
              style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
              className="grid gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <div className="font-mono text-xs text-neutral-700">{p.id}</div>
              <div className="min-w-0">
                <div className="truncate font-medium text-neutral-900">
                  {p.title}
                </div>
                <div className="text-xs text-neutral-500">
                  {EVENT_TYPE_LABELS[p.eventType]}
                </div>
              </div>
              <div className="text-xs text-neutral-700">
                {BUSINESS_LINE_LABELS[p.businessLine]}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {fmtMoney(p.netLoss, p.ccy)}
              </div>
              <div className="text-xs text-neutral-600">
                {new Date(p.submittedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_TONE[p.stage]}`}
                >
                  {STAGE_LABEL[p.stage]}
                </span>
              </div>
            </div>
          ))}
          {pipeline.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              No operational-risk events logged. Capture one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log operational risk event"
        description="Submit logs the loss event and routes it to triage. You can save and resume anytime."
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="text-xs text-neutral-500">
              Step {stepIdx + 1} of {STEPS.length} ·{" "}
              <span className="text-neutral-700">{STEPS[stepIdx].label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Cancel
              </button>
              {!isFirst && (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Back
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Next
                </button>
              )}
              {isLast && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? "Logging…" : "Log event"}
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="-mx-5 -my-4 flex min-h-[420px]">
          {/* Stepper rail */}
          <ol className="w-44 shrink-0 border-r border-neutral-200 bg-neutral-50 px-3 py-4">
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx;
              return (
                <li key={s.id} className="relative pb-4 last:pb-0">
                  <button
                    type="button"
                    onClick={() => (i <= stepIdx ? setStep(s.id) : undefined)}
                    disabled={i > stepIdx}
                    className="flex w-full items-start gap-2 text-left disabled:cursor-default"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : current
                            ? "border-neutral-900 bg-white text-neutral-900"
                            : "border-neutral-300 bg-white text-neutral-400"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-xs font-semibold ${
                          current
                            ? "text-neutral-900"
                            : done
                              ? "text-neutral-700"
                              : "text-neutral-400"
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {s.help}
                      </span>
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={`absolute top-6 left-[9px] h-[calc(100%-1rem)] w-px ${
                        done ? "bg-emerald-300" : "bg-neutral-200"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Step body */}
          <div className="min-w-0 flex-1 px-6 py-5">
            {step === "event" && <StepEvent form={form} setForm={setForm} />}
            {step === "classify" && (
              <StepClassify form={form} setForm={setForm} />
            )}
            {step === "impact" && <StepImpact form={form} setForm={setForm} />}
            {step === "control" && <StepControl form={form} setForm={setForm} />}
            {step === "review" && <StepReview form={form} />}

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "blue" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "blue"
      ? "text-blue-700"
      : tone === "amber"
        ? "text-amber-800"
        : tone === "emerald"
          ? "text-emerald-700"
          : "text-neutral-900";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none";

function StepEvent({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Describe what happened
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Summarise the operational event in plain language. Capture both the date
        it occurred and the date it was discovered.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Event title">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Duplicate USD wire to counterparty"
            />
          </Field>
        </div>
        <Field label="Date occurred">
          <input
            type="date"
            className={inputCls}
            value={form.dateOccurred}
            onChange={(e) => setForm({ ...form, dateOccurred: e.target.value })}
          />
        </Field>
        <Field label="Date discovered" hint="When the event was first identified.">
          <input
            type="date"
            className={inputCls}
            value={form.dateDiscovered}
            onChange={(e) => setForm({ ...form, dateDiscovered: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function StepClassify({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Classification</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Map the event to the affected business line and the Basel II Level 1
        event-type category.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Business line">
          <select
            className={inputCls}
            value={form.businessLine}
            onChange={(e) =>
              setForm({ ...form, businessLine: e.target.value as BusinessLine })
            }
          >
            {(Object.keys(BUSINESS_LINE_LABELS) as BusinessLine[]).map((k) => (
              <option key={k} value={k}>
                {BUSINESS_LINE_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Basel event type">
          <select
            className={inputCls}
            value={form.eventType}
            onChange={(e) =>
              setForm({ ...form, eventType: e.target.value as EventType })
            }
          >
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((k) => (
              <option key={k} value={k}>
                {EVENT_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepImpact({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const gross = Number(form.grossLoss);
  const recovery = Number(form.recovery);
  const net =
    Number.isFinite(gross) && Number.isFinite(recovery)
      ? Math.max(0, gross - recovery)
      : 0;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Financial impact</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Record the gross loss and any recovery already secured. Net loss is
        computed and used for reporting.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Gross loss">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.grossLoss}
            onChange={(e) => setForm({ ...form, grossLoss: e.target.value })}
            placeholder="e.g. 420000"
            min={0}
          />
        </Field>
        <Field label="Recovery" hint="Insurance, reversal, write-back.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.recovery}
            onChange={(e) => setForm({ ...form, recovery: e.target.value })}
            placeholder="e.g. 0"
            min={0}
          />
        </Field>
        <Field label="Currency">
          <select
            className={inputCls}
            value={form.ccy}
            onChange={(e) =>
              setForm({ ...form, ccy: e.target.value as FormState["ccy"] })
            }
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </Field>
      </div>
      <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
          Net loss
        </div>
        <div className="mt-1 font-mono text-lg tabular-nums text-neutral-900">
          {fmtMoney(String(net), form.ccy)}
        </div>
      </div>
    </div>
  );
}

function StepControl({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Cause & control
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Capture the root cause, the control that failed, and who owns the
        remediation. This drives the corrective-action plan.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Root cause">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={form.rootCause}
              onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
              placeholder="What underlying failure allowed this to happen?"
            />
          </Field>
        </div>
        <Field label="Control that failed">
          <input
            className={inputCls}
            value={form.controlFailure}
            onChange={(e) =>
              setForm({ ...form, controlFailure: e.target.value })
            }
            placeholder="e.g. Four-eyes release check"
          />
        </Field>
        <Field label="Remediation owner">
          <input
            className={inputCls}
            value={form.remediationOwner}
            onChange={(e) =>
              setForm({ ...form, remediationOwner: e.target.value })
            }
            placeholder="e.g. Head of Payments Ops"
          />
        </Field>
        <Field label="Target date" hint="Optional. Remediation deadline.">
          <input
            type="date"
            className={inputCls}
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const gross = Number(form.grossLoss);
  const recovery = Number(form.recovery);
  const net =
    Number.isFinite(gross) && Number.isFinite(recovery)
      ? Math.max(0, gross - recovery)
      : 0;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and log</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Logging routes this event to triage. Risk will confirm the
        classification and assign it for investigation.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Event title" value={form.title || "—"} />
        <ReviewRow
          label="Occurred · discovered"
          value={`${form.dateOccurred || "—"} · ${form.dateDiscovered || "—"}`}
        />
        <ReviewRow
          label="Business line"
          value={BUSINESS_LINE_LABELS[form.businessLine]}
        />
        <ReviewRow
          label="Event type"
          value={EVENT_TYPE_LABELS[form.eventType]}
        />
        <ReviewRow
          label="Gross loss"
          value={fmtMoney(form.grossLoss || "0", form.ccy)}
          mono
        />
        <ReviewRow
          label="Recovery"
          value={fmtMoney(form.recovery || "0", form.ccy)}
          mono
        />
        <ReviewRow
          label="Net loss"
          value={fmtMoney(String(net), form.ccy)}
          mono
        />
        <ReviewRow label="Root cause" value={form.rootCause || "—"} />
        <ReviewRow
          label="Control failed"
          value={form.controlFailure || "—"}
        />
        <ReviewRow
          label="Remediation"
          value={
            form.remediationOwner
              ? `${form.remediationOwner} · ${form.targetDate || "no target date"}`
              : "—"
          }
        />
      </dl>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="grid gap-3 px-3 py-2 text-sm"
      style={{ gridTemplateColumns: "180px 1fr" }}
    >
      <dt className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </dt>
      <dd className={`text-neutral-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
