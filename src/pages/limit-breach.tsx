import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Limit Breach";
export const fullWidth = true;

/* Trading Limit Breach Escalation — page-level demo of a multi-step Modal
 * wizard. Page shows open and escalated breaches as a workflow list; primary
 * action opens the wizard. Inside the modal: a stepper rail on the left, the
 * form on the right, a footer with Back / Next / Submit. The modal owns the
 * entire decision — focus is trapped, Esc abandons, Submit closes back to the
 * list with a new "open" breach raised against the pipeline. */

type Step = "breach" | "measure" | "cause" | "action" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "breach", label: "Breach", help: "What limit was breached." },
  { id: "measure", label: "Measure", help: "Observed vs limit." },
  { id: "cause", label: "Cause", help: "Why it breached." },
  { id: "action", label: "Action", help: "Remediation and escalation." },
  { id: "review", label: "Review", help: "Confirm before raising." },
];

type FormState = {
  limitType: "var" | "notional" | "concentration" | "dv01" | "stop-loss";
  book: string;
  desk: "rates" | "fx" | "credit" | "equities" | "commodities";
  limitValue: string;
  observedValue: string;
  ccy: "USD" | "EUR" | "GBP";
  breachTime: string;
  cause: string;
  intentional: boolean;
  remediation: string;
  escalateTo: "desk-head" | "cro" | "risk-committee";
  approver: string;
};

const EMPTY: FormState = {
  limitType: "var",
  book: "",
  desk: "rates",
  limitValue: "",
  observedValue: "",
  ccy: "USD",
  breachTime: "",
  cause: "",
  intentional: false,
  remediation: "",
  escalateTo: "desk-head",
  approver: "",
};

const LIMIT_TYPE_LABEL: Record<FormState["limitType"], string> = {
  var: "VaR",
  notional: "Notional",
  concentration: "Concentration",
  dv01: "DV01",
  "stop-loss": "Stop-loss",
};

type Submitted = {
  id: string;
  limitType: FormState["limitType"];
  book: string;
  excessLabel: string;
  ccy: FormState["ccy"];
  stage: "open" | "escalated" | "cleared";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "BRCH-00097",
    limitType: "var",
    book: "RATES-EUR-GOVT",
    excessLabel: "+12.4%",
    ccy: "EUR",
    stage: "open",
    submittedAt: "2026-05-27T08:14:00Z",
  },
  {
    id: "BRCH-00096",
    limitType: "concentration",
    book: "CREDIT-IG-FIN",
    excessLabel: "+6.8%",
    ccy: "USD",
    stage: "escalated",
    submittedAt: "2026-05-25T15:02:00Z",
  },
  {
    id: "BRCH-00095",
    limitType: "notional",
    book: "FX-G10-SPOT",
    excessLabel: "+3.1%",
    ccy: "GBP",
    stage: "cleared",
    submittedAt: "2026-05-22T11:39:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  open: "bg-red-100 text-red-700",
  escalated: "bg-amber-100 text-amber-800",
  cleared: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 110px 100px 120px 130px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  open: "Open",
  escalated: "Escalated",
  cleared: "Cleared",
};

function fmtMoney(amount: string, ccy: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${ccy} ${(n / 1_000_000_000).toFixed(2)}b`;
  if (n >= 1_000_000) return `${ccy} ${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${ccy} ${(n / 1_000).toFixed(0)}k`;
  return `${ccy} ${n}`;
}

function breachPct(limitValue: string, observedValue: string): number | null {
  const limit = Number(limitValue);
  const observed = Number(observedValue);
  if (!Number.isFinite(limit) || !Number.isFinite(observed) || limit <= 0) {
    return null;
  }
  return ((observed - limit) / limit) * 100;
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function validate(step: Step, f: FormState): string | null {
  if (step === "breach") {
    if (!f.book.trim()) return "Book is required.";
  }
  if (step === "measure") {
    if (!f.limitValue || Number(f.limitValue) <= 0)
      return "Enter a positive limit value.";
    if (!f.observedValue || Number(f.observedValue) <= 0)
      return "Enter a positive observed value.";
    if (Number(f.observedValue) <= Number(f.limitValue))
      return "Observed must exceed the limit to be a breach.";
  }
  if (step === "cause") {
    if (!f.cause.trim()) return "A cause description is required.";
  }
  if (step === "action") {
    if (!f.remediation.trim()) return "A remediation plan is required.";
    if (!f.approver.trim()) return "An approver is required.";
  }
  return null;
}

export default function LimitBreachPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("breach");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("breach");
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
    const err = validate("action", form);
    if (err) {
      setError(err);
      setStep("action");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `BRCH-${String(95 + pipeline.length + 2).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          limitType: form.limitType,
          book: form.book,
          excessLabel: fmtPct(breachPct(form.limitValue, form.observedValue)),
          ccy: form.ccy,
          stage: "open",
          submittedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSubmitting(false);
      setOpen(false);
    }, 600);
  }

  const counts = useMemo(() => {
    return {
      open: pipeline.filter((p) => p.stage === "open").length,
      escalated: pipeline.filter((p) => p.stage === "escalated").length,
      cleared: pipeline.filter((p) => p.stage === "cleared").length,
      total: pipeline.length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Risk
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Trading Limit Breach Escalation
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The capture wizard lives in a focus-trapped modal — one breach, no
            distraction. Submit drops back here with the breach raised and
            routed for escalation.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add breach
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Open" value={counts.open} tone="red" />
          <SummaryTile label="Escalated" value={counts.escalated} tone="amber" />
          <SummaryTile label="Cleared" value={counts.cleared} tone="emerald" />
          <SummaryTile label="Total" value={counts.total} />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Breach</div>
            <div>Book</div>
            <div>Limit type</div>
            <div className="text-right">Excess</div>
            <div>Raised</div>
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
                  {p.book}
                </div>
                <div className="text-xs text-neutral-500">{p.ccy}</div>
              </div>
              <div className="text-xs text-neutral-700">
                {LIMIT_TYPE_LABEL[p.limitType]}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-red-700">
                {p.excessLabel}
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
              No breaches on record. Raise one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Raise limit breach"
        description="Submit raises the breach and routes it for escalation. You can save and resume anytime."
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
                  {submitting ? "Raising…" : "Raise breach"}
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
            {step === "breach" && <StepBreach form={form} setForm={setForm} />}
            {step === "measure" && <StepMeasure form={form} setForm={setForm} />}
            {step === "cause" && <StepCause form={form} setForm={setForm} />}
            {step === "action" && <StepAction form={form} setForm={setForm} />}
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
  tone?: "neutral" | "red" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "red"
      ? "text-red-700"
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

function StepBreach({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">What limit was breached</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Identify the limit, the desk, and the book that carried the breach.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Limit type">
          <select
            className={inputCls}
            value={form.limitType}
            onChange={(e) =>
              setForm({ ...form, limitType: e.target.value as FormState["limitType"] })
            }
          >
            <option value="var">VaR</option>
            <option value="notional">Notional</option>
            <option value="concentration">Concentration</option>
            <option value="dv01">DV01</option>
            <option value="stop-loss">Stop-loss</option>
          </select>
        </Field>
        <Field label="Desk">
          <select
            className={inputCls}
            value={form.desk}
            onChange={(e) =>
              setForm({ ...form, desk: e.target.value as FormState["desk"] })
            }
          >
            <option value="rates">Rates</option>
            <option value="fx">FX</option>
            <option value="credit">Credit</option>
            <option value="equities">Equities</option>
            <option value="commodities">Commodities</option>
          </select>
        </Field>
        <Field label="Book" hint="Trading book identifier as it appears in the risk system.">
          <input
            className={`${inputCls} font-mono`}
            value={form.book}
            onChange={(e) => setForm({ ...form, book: e.target.value.toUpperCase() })}
            placeholder="e.g. RATES-EUR-GOVT"
            maxLength={24}
          />
        </Field>
      </div>
    </div>
  );
}

function StepMeasure({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const pct = breachPct(form.limitValue, form.observedValue);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Observed vs limit</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Capture the prevailing limit and the observed value at the time of the
        breach. The observed value must exceed the limit.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <Field label="Limit value">
            <input
              type="number"
              className={`${inputCls} font-mono`}
              value={form.limitValue}
              onChange={(e) => setForm({ ...form, limitValue: e.target.value })}
              placeholder="e.g. 25000000"
              min={0}
            />
          </Field>
          <Field label="Observed value">
            <input
              type="number"
              className={`${inputCls} font-mono`}
              value={form.observedValue}
              onChange={(e) => setForm({ ...form, observedValue: e.target.value })}
              placeholder="e.g. 28100000"
              min={0}
            />
          </Field>
        </div>
        <Field label="Currency">
          <select
            className={inputCls}
            value={form.ccy}
            onChange={(e) => setForm({ ...form, ccy: e.target.value as FormState["ccy"] })}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Breach time">
          <input
            type="datetime-local"
            className={inputCls}
            value={form.breachTime}
            onChange={(e) => setForm({ ...form, breachTime: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm">
        <span className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Excess over limit
        </span>
        <span
          className={`ml-2 font-mono tabular-nums ${
            pct !== null && pct > 0 ? "text-red-700" : "text-neutral-500"
          }`}
        >
          {fmtPct(pct)}
        </span>
      </div>
    </div>
  );
}

function StepCause({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Why it breached</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Describe what drove the breach and flag whether it stems from a
        deliberate position or a system / data issue.
      </p>
      <div className="mt-4">
        <Field label="Cause">
          <textarea
            className={`${inputCls} min-h-[96px] resize-y`}
            value={form.cause}
            onChange={(e) => setForm({ ...form, cause: e.target.value })}
            placeholder="e.g. Curve steepening widened DV01 beyond the overnight buffer following the ECB statement."
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 text-sm">
        <div>
          <div className="font-medium text-neutral-900">Intentional position</div>
          <div className="text-[11px] text-neutral-500">
            On if a deliberate trade caused it; off for a system or data issue.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, intentional: !form.intentional })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            form.intentional ? "bg-amber-500" : "bg-neutral-300"
          }`}
          aria-pressed={form.intentional}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.intentional ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function StepAction({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Remediation and escalation</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Set the plan to bring the book back within limit and route the breach to
        the right escalation owner.
      </p>
      <div className="mt-4">
        <Field label="Remediation plan">
          <textarea
            className={`${inputCls} min-h-[96px] resize-y`}
            value={form.remediation}
            onChange={(e) => setForm({ ...form, remediation: e.target.value })}
            placeholder="e.g. Reduce DV01 by hedging 10y futures at the open; targeting within-limit by EOD."
          />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Escalate to">
          <select
            className={inputCls}
            value={form.escalateTo}
            onChange={(e) =>
              setForm({ ...form, escalateTo: e.target.value as FormState["escalateTo"] })
            }
          >
            <option value="desk-head">Desk head</option>
            <option value="cro">CRO</option>
            <option value="risk-committee">Risk committee</option>
          </select>
        </Field>
        <Field label="Approver" hint="Risk officer signing off on the remediation.">
          <input
            className={inputCls}
            value={form.approver}
            onChange={(e) => setForm({ ...form, approver: e.target.value })}
            placeholder="e.g. Priya Nair"
          />
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const pct = breachPct(form.limitValue, form.observedValue);
  const escalateLabel: Record<FormState["escalateTo"], string> = {
    "desk-head": "Desk head",
    cro: "CRO",
    "risk-committee": "Risk committee",
  };
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and raise</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Raising routes this breach to the selected escalation owner and opens it
        on the pipeline until cleared.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow
          label="Limit · desk"
          value={`${LIMIT_TYPE_LABEL[form.limitType]} · ${form.desk}`}
        />
        <ReviewRow label="Book" value={form.book || "—"} mono />
        <ReviewRow
          label="Limit value"
          value={fmtMoney(form.limitValue, form.ccy)}
          mono
        />
        <ReviewRow
          label="Observed value"
          value={fmtMoney(form.observedValue, form.ccy)}
          mono
        />
        <ReviewRow label="Excess over limit" value={fmtPct(pct)} mono />
        <ReviewRow label="Breach time" value={form.breachTime || "—"} />
        <ReviewRow
          label="Cause"
          value={`${form.cause || "—"}${
            form.intentional ? " (intentional)" : " (system / data)"
          }`}
        />
        <ReviewRow label="Remediation" value={form.remediation || "—"} />
        <ReviewRow
          label="Escalation · approver"
          value={`${escalateLabel[form.escalateTo]} · ${form.approver || "—"}`}
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
