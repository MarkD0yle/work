import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "FX Hedge Order";
export const fullWidth = true;

/* FX Hedge Order — page-level demo of a multi-step Modal wizard.
 * Page shows staged hedges as a workflow list; primary action opens the
 * wizard. Inside the modal: a stepper rail on the left, the form on the
 * right, a footer with Back / Next / Submit. The modal owns the entire
 * decision — focus is trapped, Esc abandons, Submit closes back to the list
 * with a new "staged" entry routed for execution. */

type Step = "exposure" | "hedge" | "execution" | "limits" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "exposure", label: "Exposure", help: "What we're hedging." },
  { id: "hedge", label: "Hedge", help: "Instrument and tenor." },
  { id: "execution", label: "Execution", help: "Routing and urgency." },
  { id: "limits", label: "Checks", help: "Pre-trade controls." },
  { id: "review", label: "Review", help: "Confirm before staging." },
];

type CheckKey = "creditLine" | "settlementLimit" | "bestExecution";

const CHECK_LABELS: Record<CheckKey, string> = {
  creditLine: "Counterparty credit line available",
  settlementLimit: "Settlement limit available",
  bestExecution: "Best-execution policy applied",
};

type FormState = {
  fund: string;
  baseCcy: "USD" | "EUR" | "GBP";
  exposureCcy: "USD" | "EUR" | "GBP" | "JPY" | "CHF" | "AUD";
  exposureNotional: string;
  instrument: "spot" | "forward" | "swap" | "ndf";
  tenor: "spot" | "1w" | "1m" | "3m" | "6m";
  hedgeRatio: string;
  channel: "algo" | "rfq" | "voice";
  urgency: "low" | "normal" | "high";
  preTradeChecks: Record<CheckKey, boolean>;
};

const EMPTY: FormState = {
  fund: "",
  baseCcy: "USD",
  exposureCcy: "EUR",
  exposureNotional: "",
  instrument: "forward",
  tenor: "3m",
  hedgeRatio: "",
  channel: "algo",
  urgency: "normal",
  preTradeChecks: {
    creditLine: false,
    settlementLimit: false,
    bestExecution: false,
  },
};

type Submitted = {
  id: string;
  fund: string;
  pair: string;
  instrument: FormState["instrument"];
  hedgeNotional: string;
  stage: "staged" | "working" | "executed";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "FXH-00472",
    fund: "Meridian Global Equity Fund",
    pair: "EUR/USD",
    instrument: "forward",
    hedgeNotional: "EUR 42.5m",
    stage: "staged",
    submittedAt: "2026-05-27T13:40:00Z",
  },
  {
    id: "FXH-00471",
    fund: "Sable Asia Opportunities",
    pair: "JPY/USD",
    instrument: "ndf",
    hedgeNotional: "JPY 6.2b",
    stage: "working",
    submittedAt: "2026-05-25T08:15:00Z",
  },
  {
    id: "FXH-00470",
    fund: "Brightwater UK Income",
    pair: "GBP/USD",
    instrument: "spot",
    hedgeNotional: "GBP 18.0m",
    stage: "executed",
    submittedAt: "2026-05-22T16:02:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  staged: "bg-blue-100 text-blue-700",
  working: "bg-amber-100 text-amber-800",
  executed: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 100px 110px 130px 120px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  staged: "Staged",
  working: "Working",
  executed: "Executed",
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
  if (step === "exposure") {
    if (!f.fund.trim()) return "Fund is required.";
    if (!f.exposureNotional || Number(f.exposureNotional) <= 0)
      return "Enter a positive exposure notional.";
    if (f.baseCcy === (f.exposureCcy as string))
      return "Base and exposure currency must differ.";
  }
  if (step === "hedge") {
    const r = Number(f.hedgeRatio);
    if (!f.hedgeRatio || !Number.isFinite(r) || r < 1 || r > 100)
      return "Hedge ratio must be between 1 and 100%.";
  }
  if (step === "limits") {
    const allPass = Object.values(f.preTradeChecks).every(Boolean);
    if (!allPass) return "All pre-trade checks must pass.";
  }
  return null;
}

export default function FxHedgeOrderPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("exposure");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("exposure");
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
    const err = validate("limits", form);
    if (err) {
      setError(err);
      setStep("limits");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `FXH-${String(472 + pipeline.length - 2).padStart(5, "0")}`;
      const hedgeNotional =
        (Number(form.exposureNotional) * Number(form.hedgeRatio)) / 100;
      setPipeline((prev) => [
        {
          id,
          fund: form.fund,
          pair: `${form.exposureCcy}/${form.baseCcy}`,
          instrument: form.instrument,
          hedgeNotional: fmtMoney(String(hedgeNotional), form.exposureCcy),
          stage: "staged",
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
      staged: pipeline.filter((p) => p.stage === "staged").length,
      working: pipeline.filter((p) => p.stage === "working").length,
      executed: pipeline.filter((p) => p.stage === "executed").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Trading
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            FX Hedge Order
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — size the hedge, route
            it, clear the checks. Submit drops back here with the order staged
            for execution.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add hedge
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Staged" value={counts.staged} tone="blue" />
          <SummaryTile label="Working" value={counts.working} tone="amber" />
          <SummaryTile label="Executed" value={counts.executed} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Order</div>
            <div>Fund</div>
            <div>Pair</div>
            <div>Instrument</div>
            <div className="text-right">Hedge notional</div>
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
                  {p.fund}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(p.submittedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="font-mono text-xs text-neutral-700">{p.pair}</div>
              <div className="text-xs text-neutral-700 capitalize">
                {p.instrument}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {p.hedgeNotional}
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
              No hedges staged. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add hedge"
        description="Submit stages the order and routes it for execution. You can save and resume anytime."
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
                  {submitting ? "Staging…" : "Stage hedge"}
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
            {step === "exposure" && (
              <StepExposure form={form} setForm={setForm} />
            )}
            {step === "hedge" && <StepHedge form={form} setForm={setForm} />}
            {step === "execution" && (
              <StepExecution form={form} setForm={setForm} />
            )}
            {step === "limits" && <StepLimits form={form} setForm={setForm} />}
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

function StepExposure({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        What we&apos;re hedging
      </h3>
      <p className="mt-1 text-xs text-neutral-500">
        Identify the fund and the foreign-currency exposure to reduce. Base is
        the fund&apos;s reporting currency.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Fund">
          <input
            className={inputCls}
            value={form.fund}
            onChange={(e) => setForm({ ...form, fund: e.target.value })}
            placeholder="e.g. Meridian Global Equity Fund"
          />
        </Field>
        <Field label="Base currency" hint="Fund reporting currency.">
          <select
            className={inputCls}
            value={form.baseCcy}
            onChange={(e) =>
              setForm({ ...form, baseCcy: e.target.value as FormState["baseCcy"] })
            }
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </Field>
        <Field label="Exposure currency" hint="Must differ from base.">
          <select
            className={inputCls}
            value={form.exposureCcy}
            onChange={(e) =>
              setForm({
                ...form,
                exposureCcy: e.target.value as FormState["exposureCcy"],
              })
            }
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CHF">CHF</option>
            <option value="AUD">AUD</option>
          </select>
        </Field>
        <Field label="Exposure notional">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.exposureNotional}
            onChange={(e) =>
              setForm({ ...form, exposureNotional: e.target.value })
            }
            placeholder="e.g. 50000000"
            min={0}
          />
        </Field>
      </div>
    </div>
  );
}

function StepHedge({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Instrument and tenor</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose how to express the hedge and what share of the exposure to cover.
        Non-deliverable forwards apply where the currency is restricted.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Instrument">
          <select
            className={inputCls}
            value={form.instrument}
            onChange={(e) =>
              setForm({
                ...form,
                instrument: e.target.value as FormState["instrument"],
              })
            }
          >
            <option value="spot">Spot</option>
            <option value="forward">Forward</option>
            <option value="swap">Swap</option>
            <option value="ndf">NDF</option>
          </select>
        </Field>
        <Field label="Tenor">
          <select
            className={inputCls}
            value={form.tenor}
            onChange={(e) =>
              setForm({ ...form, tenor: e.target.value as FormState["tenor"] })
            }
          >
            <option value="spot">Spot</option>
            <option value="1w">1 week</option>
            <option value="1m">1 month</option>
            <option value="3m">3 months</option>
            <option value="6m">6 months</option>
          </select>
        </Field>
        <Field label="Hedge ratio %" hint="1–100% of exposure.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.hedgeRatio}
            onChange={(e) => setForm({ ...form, hedgeRatio: e.target.value })}
            placeholder="e.g. 85"
            min={1}
            max={100}
          />
        </Field>
      </div>
    </div>
  );
}

function StepExecution({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Routing and urgency</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Pick the execution channel and how aggressively the desk should work the
        order. Defaults route to the execution algo at normal urgency.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Channel">
          <select
            className={inputCls}
            value={form.channel}
            onChange={(e) =>
              setForm({ ...form, channel: e.target.value as FormState["channel"] })
            }
          >
            <option value="algo">Execution algo</option>
            <option value="rfq">RFQ to dealers</option>
            <option value="voice">Voice / manual</option>
          </select>
        </Field>
        <Field label="Urgency">
          <select
            className={inputCls}
            value={form.urgency}
            onChange={(e) =>
              setForm({ ...form, urgency: e.target.value as FormState["urgency"] })
            }
          >
            <option value="low">Low — patient</option>
            <option value="normal">Normal</option>
            <option value="high">High — immediate</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepLimits({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Pre-trade checks</h3>
      <p className="mt-1 text-xs text-neutral-500">
        All three controls must clear before the order can be staged. These
        mirror the desk&apos;s pre-trade compliance gate.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(CHECK_LABELS) as CheckKey[]).map((k) => {
          const on = form.preTradeChecks[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">
                  {CHECK_LABELS[k]}
                </div>
                <div className="text-[11px] text-neutral-500">Required</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    preTradeChecks: { ...form.preTradeChecks, [k]: !on },
                  })
                }
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
  const checks = Object.entries(form.preTradeChecks)
    .filter(([, v]) => v)
    .map(([k]) => CHECK_LABELS[k as CheckKey]);
  const hedgeNotional =
    (Number(form.exposureNotional) * Number(form.hedgeRatio)) / 100;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and stage</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Staging routes this order to execution on the selected channel. Fills
        update the stage from staged to working to executed.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Fund" value={form.fund || "—"} />
        <ReviewRow
          label="Pair"
          value={`${form.exposureCcy}/${form.baseCcy}`}
          mono
        />
        <ReviewRow
          label="Exposure"
          value={fmtMoney(form.exposureNotional, form.exposureCcy)}
          mono
        />
        <ReviewRow
          label="Instrument · tenor"
          value={`${form.instrument} · ${form.tenor}`}
        />
        <ReviewRow label="Hedge ratio" value={`${form.hedgeRatio || "—"}%`} mono />
        <ReviewRow
          label="Hedge notional"
          value={fmtMoney(String(hedgeNotional), form.exposureCcy)}
          mono
        />
        <ReviewRow
          label="Routing"
          value={`${form.channel} · ${form.urgency} urgency`}
        />
        <ReviewRow
          label="Pre-trade checks"
          value={checks.length ? checks.join(", ") : "None"}
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
