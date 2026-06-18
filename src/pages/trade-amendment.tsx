import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Trade Amendment";
export const fullWidth = true;

/* Trade Amendment / Cancel-Correct — page-level demo of a multi-step Modal
 * wizard. Page shows in-flight amendment requests as a workflow list; primary
 * action opens the wizard. Inside the modal: a stepper rail on the left, the
 * form on the right, a footer with Back / Next / Submit. The modal owns the
 * entire decision — focus is trapped, Esc abandons, Submit closes back to the
 * list with a new "requested" entry. */

type Step = "trade" | "change" | "reason" | "approval" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "trade", label: "Trade", help: "Identify the booked trade." },
  { id: "change", label: "Change", help: "Amend or cancel." },
  { id: "reason", label: "Reason", help: "Why the change is needed." },
  { id: "approval", label: "Approval", help: "Authoriser and controls." },
  { id: "review", label: "Review", help: "Confirm before raising." },
];

type Product = "fx-spot" | "fx-forward" | "irs" | "bond" | "repo" | "equity";

const PRODUCT_LABELS: Record<Product, string> = {
  "fx-spot": "FX Spot",
  "fx-forward": "FX Forward",
  irs: "Interest Rate Swap",
  bond: "Bond",
  repo: "Repo",
  equity: "Equity",
};

type AmendField =
  | "notional"
  | "rate"
  | "value-date"
  | "counterparty"
  | "direction";

const FIELD_LABELS: Record<AmendField, string> = {
  notional: "Notional",
  rate: "Rate / price",
  "value-date": "Value date",
  counterparty: "Counterparty",
  direction: "Direction (buy/sell)",
};

type ReasonCode =
  | "booking-error"
  | "client-instruction"
  | "market-data"
  | "system-issue";

const REASON_LABELS: Record<ReasonCode, string> = {
  "booking-error": "Booking error",
  "client-instruction": "Client instruction",
  "market-data": "Market data correction",
  "system-issue": "System / feed issue",
};

type FormState = {
  tradeId: string;
  product: Product;
  counterparty: string;
  action: "amend" | "cancel";
  field: AmendField;
  oldValue: string;
  newValue: string;
  reasonCode: ReasonCode;
  reasonNote: string;
  authoriser: string;
  dualControl: boolean;
  materialPnl: boolean;
};

const EMPTY: FormState = {
  tradeId: "",
  product: "fx-spot",
  counterparty: "",
  action: "amend",
  field: "notional",
  oldValue: "",
  newValue: "",
  reasonCode: "booking-error",
  reasonNote: "",
  authoriser: "",
  dualControl: false,
  materialPnl: false,
};

type Submitted = {
  id: string;
  tradeId: string;
  product: Product;
  action: FormState["action"];
  status: "requested" | "authorised" | "applied";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "AMD-00231",
    tradeId: "IRS-2026-118842",
    product: "irs",
    action: "amend",
    status: "requested",
    submittedAt: "2026-05-27T13:42:00Z",
  },
  {
    id: "AMD-00230",
    tradeId: "FXF-2026-009571",
    product: "fx-forward",
    action: "cancel",
    status: "authorised",
    submittedAt: "2026-05-25T10:15:00Z",
  },
  {
    id: "AMD-00229",
    tradeId: "BND-2026-044120",
    product: "bond",
    action: "amend",
    status: "applied",
    submittedAt: "2026-05-22T16:03:00Z",
  },
];

const STAGE_TONE: Record<Submitted["status"], string> = {
  requested: "bg-blue-100 text-blue-700",
  authorised: "bg-amber-100 text-amber-800",
  applied: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 140px 100px 120px 130px";
const PIPELINE_MIN = 830;

const STAGE_LABEL: Record<Submitted["status"], string> = {
  requested: "Requested",
  authorised: "Authorised",
  applied: "Applied",
};

function validate(step: Step, f: FormState): string | null {
  if (step === "trade") {
    if (!f.tradeId.trim()) return "Trade reference is required.";
    if (!/^[A-Z]{2,4}-\d{4}-\d{4,}$/.test(f.tradeId.trim()))
      return "Use a trade ref like IRS-2026-118842.";
    if (!f.counterparty.trim()) return "Counterparty is required.";
  }
  if (step === "change") {
    if (f.action === "amend") {
      if (!f.oldValue.trim()) return "Current value is required.";
      if (!f.newValue.trim()) return "Amended value is required.";
      if (f.oldValue.trim() === f.newValue.trim())
        return "Old and new values must differ.";
    }
  }
  if (step === "reason") {
    if (!f.reasonNote.trim()) return "A reason note is required.";
  }
  if (step === "approval") {
    if (!f.authoriser.trim()) return "Authoriser is required.";
    if (!f.dualControl) return "Dual control is required to authorise.";
  }
  return null;
}

export default function TradeAmendmentPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("trade");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("trade");
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
    const err = validate("approval", form);
    if (err) {
      setError(err);
      setStep("approval");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `AMD-${String(229 + pipeline.length + 1).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          tradeId: form.tradeId,
          product: form.product,
          action: form.action,
          status: "requested",
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
      requested: pipeline.filter((p) => p.status === "requested").length,
      authorised: pipeline.filter((p) => p.status === "authorised").length,
      applied: pipeline.filter((p) => p.status === "applied").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Trading Ops
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Trade Amendment
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Raise an amendment or cancellation against a booked trade. The
            wizard lives in a focus-trapped modal — dual control is enforced
            before anything is submitted for authorisation.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add request
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Requested" value={counts.requested} tone="blue" />
          <SummaryTile
            label="Authorised"
            value={counts.authorised}
            tone="amber"
          />
          <SummaryTile label="Applied" value={counts.applied} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Request</div>
            <div>Trade</div>
            <div>Product</div>
            <div>Action</div>
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
                <div className="truncate font-mono text-xs font-medium text-neutral-900">
                  {p.tradeId}
                </div>
                <div className="text-xs text-neutral-500">
                  {PRODUCT_LABELS[p.product]}
                </div>
              </div>
              <div className="text-xs text-neutral-700">
                {PRODUCT_LABELS[p.product]}
              </div>
              <div className="text-xs text-neutral-700 capitalize">
                {p.action}
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
              No amendment requests in flight. Raise one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Raise amendment"
        description="Submit routes this request for authorisation. Dual control must be satisfied before it can be applied."
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
                  {submitting ? "Submitting…" : "Submit for authorisation"}
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
            {step === "trade" && <StepTrade form={form} setForm={setForm} />}
            {step === "change" && <StepChange form={form} setForm={setForm} />}
            {step === "reason" && <StepReason form={form} setForm={setForm} />}
            {step === "approval" && (
              <StepApproval form={form} setForm={setForm} />
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

function StepTrade({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Identify the booked trade
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Enter the trade reference exactly as it appears on the blotter. The
        product and counterparty pin down the booking being changed.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Trade reference" hint="e.g. IRS-2026-118842">
          <input
            className={`${inputCls} font-mono`}
            value={form.tradeId}
            onChange={(e) =>
              setForm({ ...form, tradeId: e.target.value.toUpperCase() })
            }
            placeholder="e.g. IRS-2026-118842"
          />
        </Field>
        <Field label="Product">
          <select
            className={inputCls}
            value={form.product}
            onChange={(e) =>
              setForm({ ...form, product: e.target.value as Product })
            }
          >
            {(Object.keys(PRODUCT_LABELS) as Product[]).map((k) => (
              <option key={k} value={k}>
                {PRODUCT_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Counterparty">
          <input
            className={inputCls}
            value={form.counterparty}
            onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            placeholder="e.g. Northwind Capital Partners LP"
          />
        </Field>
      </div>
    </div>
  );
}

function StepChange({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const isCancel = form.action === "cancel";
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Amend or cancel
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose whether to correct a field on the trade or cancel the booking
        outright. A cancellation reverses the trade in full.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["amend", "Amend a field"],
            ["cancel", "Cancel the trade"],
          ] as const
        ).map(([k, label]) => {
          const on = form.action === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() =>
                setForm({ ...form, action: k as FormState["action"] })
              }
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                on
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span>{label}</span>
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold ${
                  on
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-neutral-300 text-transparent"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {isCancel ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          The booking will be cancelled in full. No field-level values are
          required — capture the rationale on the next step.
        </div>
      ) : (
        <div className="mt-5">
          <Field label="Field to amend">
            <select
              className={inputCls}
              value={form.field}
              onChange={(e) =>
                setForm({ ...form, field: e.target.value as AmendField })
              }
            >
              {(Object.keys(FIELD_LABELS) as AmendField[]).map((k) => (
                <option key={k} value={k}>
                  {FIELD_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Current value">
              <input
                className={inputCls}
                value={form.oldValue}
                onChange={(e) =>
                  setForm({ ...form, oldValue: e.target.value })
                }
                placeholder="As currently booked"
              />
            </Field>
            <Field label="Amended value" hint="Must differ from the current value.">
              <input
                className={inputCls}
                value={form.newValue}
                onChange={(e) =>
                  setForm({ ...form, newValue: e.target.value })
                }
                placeholder="Corrected value"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function StepReason({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Why the change is needed
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Classify the change and add a note. This is retained for audit and
        surfaced to the authoriser.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Field label="Reason code">
          <select
            className={inputCls}
            value={form.reasonCode}
            onChange={(e) =>
              setForm({ ...form, reasonCode: e.target.value as ReasonCode })
            }
          >
            {(Object.keys(REASON_LABELS) as ReasonCode[]).map((k) => (
              <option key={k} value={k}>
                {REASON_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason note">
          <textarea
            className={`${inputCls} min-h-[96px] resize-y`}
            value={form.reasonNote}
            onChange={(e) => setForm({ ...form, reasonNote: e.target.value })}
            placeholder="Describe what went wrong and why the change is correct."
          />
        </Field>
      </div>
    </div>
  );
}

function StepApproval({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Authoriser and controls
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Name the authoriser and confirm the controls. Dual control is mandatory
        — the request cannot be raised without it.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Authoriser">
          <input
            className={inputCls}
            value={form.authoriser}
            onChange={(e) => setForm({ ...form, authoriser: e.target.value })}
            placeholder="e.g. Priya Nair (Desk Head)"
          />
        </Field>
      </div>
      <ul className="mt-5 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(
          [
            [
              "dualControl",
              "Dual control",
              "A second authoriser has independently reviewed this change.",
            ],
            [
              "materialPnl",
              "Material P&L impact",
              "This change moves the desk's P&L materially.",
            ],
          ] as const
        ).map(([k, label, desc]) => {
          const on = form[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">{label}</div>
                <div className="text-[11px] text-neutral-500">{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, [k]: !on })}
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

function StepReview({ form }: { form: FormState }) {
  const isCancel = form.action === "cancel";
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        Review and submit
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting routes this request to the authoriser. It is applied to the
        trade only once authorisation completes.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Trade reference" value={form.tradeId || "—"} mono />
        <ReviewRow
          label="Product · counterparty"
          value={`${PRODUCT_LABELS[form.product]} · ${form.counterparty || "—"}`}
        />
        <ReviewRow label="Action" value={form.action} />
        {!isCancel && (
          <ReviewRow
            label="Field change"
            value={`${FIELD_LABELS[form.field]}: ${form.oldValue || "—"} → ${
              form.newValue || "—"
            }`}
          />
        )}
        <ReviewRow
          label="Reason"
          value={`${REASON_LABELS[form.reasonCode]}${
            form.reasonNote ? ` · ${form.reasonNote}` : ""
          }`}
        />
        <ReviewRow label="Authoriser" value={form.authoriser || "—"} />
        <ReviewRow
          label="Controls"
          value={`${form.dualControl ? "Dual control ✓" : "Dual control ✗"} · ${
            form.materialPnl ? "Material P&L" : "No material P&L"
          }`}
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
