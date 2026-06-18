import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Margin Call";
export const fullWidth = true;

/* Margin Call Response — page-level demo of a multi-step Modal wizard.
 * Page shows variation-margin calls under a CSA as a workflow list; primary
 * action opens the wizard. Inside the modal: a stepper rail on the left, the
 * form on the right, a footer with Back / Next / Submit. The modal owns the
 * entire decision — focus is trapped, Esc abandons, Submit closes back to the
 * list with a new "responded" entry. Validate the call, agree or dispute, and
 * settle collateral on the agreed portion. */

type Step = "call" | "validation" | "collateral" | "settlement" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "call", label: "Call", help: "The margin call received." },
  { id: "validation", label: "Validation", help: "Agree or dispute." },
  { id: "collateral", label: "Collateral", help: "What to deliver." },
  { id: "settlement", label: "Settlement", help: "Where and when." },
  { id: "review", label: "Review", help: "Confirm before responding." },
];

type FormState = {
  counterparty: string;
  agreement: string;
  direction: "deliver" | "receive";
  callAmount: string;
  ccy: "USD" | "EUR" | "GBP";
  ourMtm: string;
  response: "agree" | "dispute";
  disputeAmount: string;
  disputeReason: string;
  collateralType: "cash" | "securities";
  asset: string;
  haircut: string;
  account: string;
  valueDate: string;
};

const EMPTY: FormState = {
  counterparty: "",
  agreement: "",
  direction: "deliver",
  callAmount: "",
  ccy: "USD",
  ourMtm: "",
  response: "agree",
  disputeAmount: "",
  disputeReason: "",
  collateralType: "cash",
  asset: "",
  haircut: "",
  account: "",
  valueDate: "",
};

type Submitted = {
  id: string;
  counterparty: string;
  direction: FormState["direction"];
  callAmount: string;
  response: "agree" | "dispute";
  stage: "received" | "agreed" | "disputed" | "settled";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "MGN-00528",
    counterparty: "Goldwave Securities LLC",
    direction: "deliver",
    callAmount: "USD 24.5m",
    response: "agree",
    stage: "settled",
    submittedAt: "2026-05-27T08:14:00Z",
  },
  {
    id: "MGN-00527",
    counterparty: "Banque Lemaire SA",
    direction: "receive",
    callAmount: "EUR 11.2m",
    response: "agree",
    stage: "agreed",
    submittedAt: "2026-05-26T13:42:00Z",
  },
  {
    id: "MGN-00526",
    counterparty: "Castlebridge Markets Ltd",
    direction: "deliver",
    callAmount: "GBP 8.7m",
    response: "dispute",
    stage: "disputed",
    submittedAt: "2026-05-22T10:05:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  received: "bg-blue-100 text-blue-700",
  agreed: "bg-amber-100 text-amber-800",
  disputed: "bg-red-100 text-red-700",
  settled: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 100px 120px 110px 120px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  received: "Received",
  agreed: "Agreed",
  disputed: "Disputed",
  settled: "Settled",
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
  if (step === "call") {
    if (!f.counterparty.trim()) return "Counterparty is required.";
    if (!f.agreement.trim()) return "CSA reference is required.";
    if (!f.callAmount || Number(f.callAmount) <= 0)
      return "Enter a positive call amount.";
  }
  if (step === "validation") {
    if (f.response === "dispute") {
      if (!f.disputeAmount || Number(f.disputeAmount) <= 0 || !f.disputeReason.trim())
        return "Provide a dispute amount and reason.";
    }
  }
  if (step === "collateral") {
    if (!f.asset.trim()) return "Collateral asset is required.";
    if (f.collateralType === "securities") {
      if (f.haircut === "" || Number(f.haircut) < 0 || !Number.isFinite(Number(f.haircut)))
        return "Enter a valid haircut.";
    }
  }
  if (step === "settlement") {
    if (!f.account.trim()) return "Account is required.";
    if (!f.valueDate.trim()) return "Value date is required.";
  }
  return null;
}

export default function MarginCallPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("call");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("call");
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
    const err = validate("settlement", form);
    if (err) {
      setError(err);
      setStep("settlement");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `MGN-${String(526 + pipeline.length + 1).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          counterparty: form.counterparty,
          direction: form.direction,
          callAmount: fmtMoney(form.callAmount, form.ccy),
          response: form.response,
          stage: form.response === "agree" ? "agreed" : "disputed",
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
      agreed: pipeline.filter((p) => p.stage === "agreed").length,
      disputed: pipeline.filter((p) => p.stage === "disputed").length,
      settled: pipeline.filter((p) => p.stage === "settled").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Collateral Ops
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Margin Call Response
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The response lives in a focus-trapped modal — validate the call,
            agree or dispute, settle collateral on the agreed portion. Submit
            drops back here with the new entry on the blotter.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add margin call
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Agreed" value={counts.agreed} tone="amber" />
          <SummaryTile label="Disputed" value={counts.disputed} tone="red" />
          <SummaryTile label="Settled" value={counts.settled} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Call</div>
            <div>Counterparty</div>
            <div>Direction</div>
            <div className="text-right">Amount</div>
            <div>Submitted</div>
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
                  {p.counterparty}
                </div>
                <div className="text-xs text-neutral-500">
                  {p.response === "dispute" ? "Disputed" : "Agreed"}
                </div>
              </div>
              <div className="text-xs text-neutral-700 capitalize">{p.direction}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {p.callAmount}
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
              No margin calls to respond to. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Respond to margin call"
        description="Submit logs your response. Agreed amounts route to settlement; disputed amounts go to the dispute desk."
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
                  {submitting ? "Responding…" : "Submit response"}
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
            {step === "call" && <StepCall form={form} setForm={setForm} />}
            {step === "validation" && (
              <StepValidation form={form} setForm={setForm} />
            )}
            {step === "collateral" && (
              <StepCollateral form={form} setForm={setForm} />
            )}
            {step === "settlement" && (
              <StepSettlement form={form} setForm={setForm} />
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
  tone?: "neutral" | "blue" | "amber" | "red" | "emerald";
}) {
  const toneCls =
    tone === "blue"
      ? "text-blue-700"
      : tone === "amber"
        ? "text-amber-800"
        : tone === "red"
          ? "text-red-700"
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

function StepCall({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">The margin call</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Capture the variation-margin call as received from the counterparty,
        under the governing Credit Support Annex.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Counterparty">
          <input
            className={inputCls}
            value={form.counterparty}
            onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            placeholder="e.g. Goldwave Securities LLC"
          />
        </Field>
        <Field label="CSA reference" hint="Governing Credit Support Annex.">
          <input
            className={`${inputCls} font-mono`}
            value={form.agreement}
            onChange={(e) => setForm({ ...form, agreement: e.target.value })}
            placeholder="e.g. CSA-2021-GWS-USD"
          />
        </Field>
        <Field label="Direction" hint="Deliver = we post; Receive = we collect.">
          <select
            className={inputCls}
            value={form.direction}
            onChange={(e) =>
              setForm({ ...form, direction: e.target.value as FormState["direction"] })
            }
          >
            <option value="deliver">Deliver (we post)</option>
            <option value="receive">Receive (we collect)</option>
          </select>
        </Field>
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
        <Field label="Call amount">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.callAmount}
            onChange={(e) => setForm({ ...form, callAmount: e.target.value })}
            placeholder="e.g. 24500000"
            min={0}
          />
        </Field>
        <Field label="Our MTM exposure" hint="Our independent valuation. Optional.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.ourMtm}
            onChange={(e) => setForm({ ...form, ourMtm: e.target.value })}
            placeholder="e.g. 23800000"
            min={0}
          />
        </Field>
      </div>
    </div>
  );
}

function StepValidation({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Agree or dispute</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Reconcile the call against our exposure. Dispute the difference if our
        MTM diverges materially — the agreed portion still settles on time.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["agree", "Agree in full"],
            ["dispute", "Dispute"],
          ] as const
        ).map(([k, label]) => {
          const on = form.response === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setForm({ ...form, response: k })}
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
      {form.response === "dispute" && (
        <div className="mt-5 grid grid-cols-1 gap-4">
          <Field
            label="Disputed amount"
            hint="The portion you contest. The remainder settles as agreed."
          >
            <input
              type="number"
              className={`${inputCls} font-mono`}
              value={form.disputeAmount}
              onChange={(e) => setForm({ ...form, disputeAmount: e.target.value })}
              placeholder="e.g. 700000"
              min={0}
            />
          </Field>
          <Field label="Dispute reason">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={form.disputeReason}
              onChange={(e) => setForm({ ...form, disputeReason: e.target.value })}
              placeholder="e.g. MTM divergence on the 5y IRS leg; pricing source mismatch."
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function StepCollateral({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Eligible collateral</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose what to deliver against the
        {form.response === "dispute" ? " agreed (undisputed) portion" : " call"}.
        Securities are subject to the CSA haircut schedule.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["cash", "Cash"],
            ["securities", "Securities"],
          ] as const
        ).map(([k, label]) => {
          const on = form.collateralType === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setForm({ ...form, collateralType: k })}
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
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Field
          label="Asset"
          hint={
            form.collateralType === "cash"
              ? "e.g. USD cash"
              : "e.g. US T-Bill 3M"
          }
        >
          <input
            className={inputCls}
            value={form.asset}
            onChange={(e) => setForm({ ...form, asset: e.target.value })}
            placeholder={
              form.collateralType === "cash" ? "e.g. USD cash" : "e.g. US T-Bill 3M"
            }
          />
        </Field>
        {form.collateralType === "securities" && (
          <Field label="Haircut %" hint="Per the CSA haircut schedule.">
            <input
              type="number"
              className={`${inputCls} font-mono`}
              value={form.haircut}
              onChange={(e) => setForm({ ...form, haircut: e.target.value })}
              placeholder="e.g. 0.5"
              min={0}
              step="0.1"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function StepSettlement({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Settlement instructions</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Where and when the collateral moves. Value date should respect the CSA
        notification time and settlement cycle.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Account">
          <input
            className={`${inputCls} font-mono`}
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
            placeholder="Account number / IBAN"
          />
        </Field>
        <Field label="Value date">
          <input
            type="date"
            className={inputCls}
            value={form.valueDate}
            onChange={(e) => setForm({ ...form, valueDate: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and respond</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting logs your response to the counterparty. Agreed collateral
        routes to settlement; any disputed amount goes to the dispute desk.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Counterparty" value={form.counterparty || "—"} />
        <ReviewRow label="CSA reference" value={form.agreement || "—"} mono />
        <ReviewRow
          label="Direction · call"
          value={`${form.direction} · ${fmtMoney(form.callAmount, form.ccy)}`}
        />
        <ReviewRow
          label="Response"
          value={
            form.response === "dispute"
              ? `Dispute · ${fmtMoney(form.disputeAmount, form.ccy)}${
                  form.disputeReason ? ` · ${form.disputeReason}` : ""
                }`
              : "Agree in full"
          }
        />
        <ReviewRow
          label="Collateral"
          value={
            form.asset
              ? `${form.collateralType} · ${form.asset}${
                  form.collateralType === "securities" && form.haircut !== ""
                    ? ` · ${form.haircut}% haircut`
                    : ""
                }`
              : "—"
          }
        />
        <ReviewRow
          label="Settlement"
          value={
            form.account
              ? `${form.account} · ${form.valueDate || "no value date"}`
              : "—"
          }
          mono
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
