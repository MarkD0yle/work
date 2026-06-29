import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Control Attestation";
export const fullWidth = true;

/* Control Attestation — page-level demo of a multi-step Modal wizard.
 * Page shows periodic RCSA sign-offs as a workflow list; primary action opens
 * the wizard. Inside the modal: a stepper rail on the left, the form on the
 * right, a footer with Back / Next / Submit. The modal owns the entire
 * decision — focus is trapped, Esc abandons, Submit closes back to the list
 * with a new "submitted" entry awaiting review. */

type Step = "scope" | "controls" | "findings" | "signoff" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "scope", label: "Scope", help: "Process and attestation period." },
  { id: "controls", label: "Controls tested", help: "Confirm each control operated." },
  { id: "findings", label: "Findings", help: "Record any exceptions." },
  { id: "signoff", label: "Sign-off", help: "Attester and declaration." },
  { id: "review", label: "Review", help: "Confirm before attesting." },
];

type ControlKey =
  | "segregation"
  | "reconciliation"
  | "access"
  | "fourEyes"
  | "limitMonitoring";

const CONTROL_LABELS: Record<ControlKey, string> = {
  segregation: "Segregation of duties",
  reconciliation: "Daily reconciliation",
  access: "Access reviews",
  fourEyes: "Four-eyes authorisation",
  limitMonitoring: "Limit monitoring",
};

type FormState = {
  process: string;
  period: "2026-Q1" | "2026-Q2" | "2026-H1";
  owner: string;
  controls: Record<ControlKey, boolean>;
  hasExceptions: boolean;
  exceptionSeverity: "low" | "medium" | "high";
  exceptionNote: string;
  attester: string;
  attesterRole: string;
  declarationAccepted: boolean;
};

const EMPTY: FormState = {
  process: "",
  period: "2026-Q1",
  owner: "",
  controls: {
    segregation: true,
    reconciliation: true,
    access: true,
    fourEyes: true,
    limitMonitoring: true,
  },
  hasExceptions: false,
  exceptionSeverity: "low",
  exceptionNote: "",
  attester: "",
  attesterRole: "",
  declarationAccepted: false,
};

type Submitted = {
  id: string;
  process: string;
  period: FormState["period"];
  controlsPassed: string;
  status: "submitted" | "under-review" | "attested";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "ATT-2026-0142",
    process: "Cash & FX settlement",
    period: "2026-Q1",
    controlsPassed: "5/5",
    status: "submitted",
    submittedAt: "2026-05-27T15:10:00Z",
  },
  {
    id: "ATT-2026-0141",
    process: "Corporate actions",
    period: "2026-Q1",
    controlsPassed: "4/5",
    status: "under-review",
    submittedAt: "2026-05-23T10:42:00Z",
  },
  {
    id: "ATT-2026-0140",
    process: "Trade confirmations",
    period: "2026-H1",
    controlsPassed: "5/5",
    status: "attested",
    submittedAt: "2026-05-19T08:55:00Z",
  },
];

const STAGE_TONE: Record<Submitted["status"], string> = {
  submitted: "bg-blue-100 text-blue-700",
  "under-review": "bg-amber-100 text-amber-800",
  attested: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "130px minmax(220px, 1fr) 100px 100px 110px 130px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["status"], string> = {
  submitted: "Submitted",
  "under-review": "Under review",
  attested: "Attested",
};

function countPassed(controls: Record<ControlKey, boolean>) {
  const keys = Object.keys(controls) as ControlKey[];
  const passed = keys.filter((k) => controls[k]).length;
  return { passed, total: keys.length, label: `${passed}/${keys.length}` };
}

function validate(step: Step, f: FormState): string | null {
  if (step === "scope") {
    if (!f.process.trim()) return "Process is required.";
    if (!f.owner.trim()) return "Process owner is required.";
  }
  if (step === "controls") {
    // No hard requirement — controls left OFF are permitted, but they must be
    // explained as an exception in the Findings step.
    return null;
  }
  if (step === "findings") {
    if (f.hasExceptions && !f.exceptionNote.trim())
      return "Describe the exception.";
  }
  if (step === "signoff") {
    if (!f.attester.trim()) return "Attester is required.";
    if (!f.attesterRole.trim()) return "Attester role is required.";
    if (!f.declarationAccepted)
      return "You must accept the declaration to attest.";
  }
  return null;
}

export default function ControlAttestationPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("scope");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("scope");
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
    const err = validate("signoff", form);
    if (err) {
      setError(err);
      setStep("signoff");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `ATT-2026-${String(143 + pipeline.length - 3).padStart(4, "0")}`;
      setPipeline((prev) => [
        {
          id,
          process: form.process,
          period: form.period,
          controlsPassed: countPassed(form.controls).label,
          status: "submitted",
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
      total: pipeline.length,
      submitted: pipeline.filter((p) => p.status === "submitted").length,
      review: pipeline.filter((p) => p.status === "under-review").length,
      attested: pipeline.filter((p) => p.status === "attested").length,
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
            Control Attestation
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The RCSA sign-off lives in a focus-trapped modal — one decision, no
            distraction. Submit drops back here with the new attestation queued
            for second-line review.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add attestation
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Submitted" value={counts.submitted} tone="blue" />
          <SummaryTile label="Under review" value={counts.review} tone="amber" />
          <SummaryTile label="Attested" value={counts.attested} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Attestation</div>
            <div>Process</div>
            <div>Period</div>
            <div className="text-right">Controls</div>
            <div>Submitted</div>
            <div>Status</div>
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
                  {p.process}
                </div>
                <div className="text-xs text-neutral-500">RCSA self-assessment</div>
              </div>
              <div className="text-xs text-neutral-700">{p.period}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {p.controlsPassed}
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
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_TONE[p.status]}`}
                >
                  {STAGE_LABEL[p.status]}
                </span>
              </div>
            </div>
          ))}
          {pipeline.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-neutral-500">
              No attestations recorded. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add attestation"
        description="Submit routes this RCSA sign-off to second-line review. You can save and resume anytime."
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
                  {submitting ? "Attesting…" : "Submit attestation"}
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
            {step === "scope" && <StepScope form={form} setForm={setForm} />}
            {step === "controls" && (
              <StepControls form={form} setForm={setForm} />
            )}
            {step === "findings" && (
              <StepFindings form={form} setForm={setForm} />
            )}
            {step === "signoff" && (
              <StepSignoff form={form} setForm={setForm} />
            )}
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

function StepScope({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Process and period</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Identify the operational process under self-assessment and the period
        this attestation covers.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Process">
          <input
            className={inputCls}
            value={form.process}
            onChange={(e) => setForm({ ...form, process: e.target.value })}
            placeholder="e.g. Cash & FX settlement"
          />
        </Field>
        <Field label="Period">
          <select
            className={inputCls}
            value={form.period}
            onChange={(e) =>
              setForm({ ...form, period: e.target.value as FormState["period"] })
            }
          >
            <option value="2026-Q1">2026-Q1</option>
            <option value="2026-Q2">2026-Q2</option>
            <option value="2026-H1">2026-H1</option>
          </select>
        </Field>
        <Field label="Process owner" hint="First-line owner accountable for the controls.">
          <input
            className={inputCls}
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            placeholder="e.g. Priya Nair"
          />
        </Field>
      </div>
    </div>
  );
}

function StepControls({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Controls tested</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Confirm each control operated effectively over the period. Switch a
        control off where it did not operate — you'll record the exception on
        the next step.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(CONTROL_LABELS) as ControlKey[]).map((k) => {
          const on = form.controls[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">
                  {CONTROL_LABELS[k]}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {on ? "Operated effectively" : "Did not operate"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextOn = !on;
                  const nextControls = { ...form.controls, [k]: nextOn };
                  // Auto-couple: toggling any control OFF defaults the findings
                  // step to "has exceptions" so the gap is captured.
                  setForm({
                    ...form,
                    controls: nextControls,
                    hasExceptions: nextOn ? form.hasExceptions : true,
                  });
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  on ? "bg-emerald-500" : "bg-neutral-300"
                }`}
                aria-pressed={on}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepFindings({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const offCount = (Object.keys(form.controls) as ControlKey[]).filter(
    (k) => !form.controls[k],
  ).length;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Findings</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Record any exceptions identified during the assessment.
        {offCount > 0 &&
          ` ${offCount} control${offCount === 1 ? "" : "s"} marked as not operating — an exception is required.`}
      </p>
      <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5 text-sm">
        <div>
          <div className="font-medium text-neutral-900">Exceptions identified</div>
          <div className="text-[11px] text-neutral-500">
            Toggle on if any control gap or breach was found.
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setForm({ ...form, hasExceptions: !form.hasExceptions })
          }
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            form.hasExceptions ? "bg-amber-500" : "bg-neutral-300"
          }`}
          aria-pressed={form.hasExceptions}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.hasExceptions ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {form.hasExceptions && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Field label="Severity">
            <select
              className={inputCls}
              value={form.exceptionSeverity}
              onChange={(e) =>
                setForm({
                  ...form,
                  exceptionSeverity: e.target
                    .value as FormState["exceptionSeverity"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <div className="col-span-3">
            <Field label="Exception note" hint="Describe the gap and any remediation in progress.">
              <textarea
                className={`${inputCls} min-h-[88px] resize-y`}
                value={form.exceptionNote}
                onChange={(e) =>
                  setForm({ ...form, exceptionNote: e.target.value })
                }
                placeholder="e.g. Two daily reconciliations were completed a day late during the period; root cause addressed."
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function StepSignoff({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Attester sign-off</h3>
      <p className="mt-1 text-xs text-neutral-500">
        The named attester takes personal accountability for the accuracy of
        this self-assessment.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Attester">
          <input
            className={inputCls}
            value={form.attester}
            onChange={(e) => setForm({ ...form, attester: e.target.value })}
            placeholder="e.g. Daniel Okafor"
          />
        </Field>
        <Field label="Role">
          <input
            className={inputCls}
            value={form.attesterRole}
            onChange={(e) => setForm({ ...form, attesterRole: e.target.value })}
            placeholder="e.g. Head of Settlements"
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={() =>
          setForm({ ...form, declarationAccepted: !form.declarationAccepted })
        }
        className={`mt-5 flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left text-sm ${
          form.declarationAccepted
            ? "border-emerald-300 bg-emerald-50"
            : "border-neutral-200 bg-white hover:bg-neutral-50"
        }`}
        aria-pressed={form.declarationAccepted}
      >
        <span
          className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
            form.declarationAccepted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-neutral-300 text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="text-neutral-700">
          I confirm the controls listed operated as described over the period,
          any exceptions have been recorded, and this attestation is accurate to
          the best of my knowledge.
        </span>
      </button>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const passed = countPassed(form.controls);
  const off = (Object.keys(form.controls) as ControlKey[])
    .filter((k) => !form.controls[k])
    .map((k) => CONTROL_LABELS[k]);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and attest</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting routes this attestation to second-line review. It cannot be
        edited once attested.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Process" value={form.process || "—"} />
        <ReviewRow label="Period" value={form.period} />
        <ReviewRow label="Process owner" value={form.owner || "—"} />
        <ReviewRow label="Controls passed" value={passed.label} mono />
        <ReviewRow
          label="Not operating"
          value={off.length ? off.join(", ") : "None"}
        />
        <ReviewRow
          label="Exceptions"
          value={
            form.hasExceptions
              ? `${form.exceptionSeverity} · ${form.exceptionNote || "no note"}`
              : "None"
          }
        />
        <ReviewRow
          label="Attester"
          value={
            form.attester
              ? `${form.attester} · ${form.attesterRole || "—"}`
              : "—"
          }
        />
        <ReviewRow
          label="Declaration"
          value={form.declarationAccepted ? "Accepted" : "Not accepted"}
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
