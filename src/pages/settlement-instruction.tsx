import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Settlement Instruction";
export const fullWidth = true;

/* Settlement Instruction Capture/Repair — page-level demo of a multi-step
 * Modal wizard. Page shows in-flight settlement instructions as a workflow
 * list; primary action opens the wizard. Inside the modal: a stepper rail on
 * the left, the form on the right, a footer with Back / Next / Release. The
 * modal owns the entire decision — focus is trapped, Esc abandons, Submit
 * closes back to the list with a new "drafted" instruction. */

type Step = "trade" | "instruction" | "routing" | "checks" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "trade", label: "Trade", help: "Settlement details." },
  { id: "instruction", label: "Instruction", help: "Where it settles." },
  { id: "routing", label: "Routing", help: "Network and priority." },
  { id: "checks", label: "Checks", help: "Controls before release." },
  { id: "review", label: "Review", help: "Confirm before releasing." },
];

type CheckKey = "sanctions" | "ssiMatched" | "dualAuth";

const CHECK_LABELS: Record<CheckKey, string> = {
  sanctions: "Sanctions screening clear",
  ssiMatched: "SSI matched to SDM",
  dualAuth: "Dual authorisation",
};

type FormState = {
  tradeRef: string;
  ccy: "USD" | "EUR" | "GBP" | "JPY";
  amount: string;
  valueDate: string;
  direction: "pay" | "receive";
  custodian: string;
  account: string;
  bic: string;
  network: "swift" | "target2" | "chaps" | "fedwire";
  priority: "normal" | "urgent";
  checks: Record<CheckKey, boolean>;
};

const EMPTY: FormState = {
  tradeRef: "",
  ccy: "USD",
  amount: "",
  valueDate: "",
  direction: "pay",
  custodian: "",
  account: "",
  bic: "",
  network: "swift",
  priority: "normal",
  checks: { sanctions: false, ssiMatched: false, dualAuth: false },
};

type Submitted = {
  id: string;
  tradeRef: string;
  ccy: FormState["ccy"];
  amount: string;
  direction: FormState["direction"];
  network: FormState["network"];
  stage: "drafted" | "validated" | "released";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "SSI-00862",
    tradeRef: "TRD-2026-04417",
    ccy: "EUR",
    amount: "18500000",
    direction: "pay",
    network: "target2",
    stage: "drafted",
    submittedAt: "2026-05-27T10:14:00Z",
  },
  {
    id: "SSI-00861",
    tradeRef: "TRD-2026-04402",
    ccy: "USD",
    amount: "42000000",
    direction: "receive",
    network: "fedwire",
    stage: "validated",
    submittedAt: "2026-05-26T15:33:00Z",
  },
  {
    id: "SSI-00860",
    tradeRef: "TRD-2026-04388",
    ccy: "GBP",
    amount: "9750000",
    direction: "pay",
    network: "chaps",
    stage: "released",
    submittedAt: "2026-05-25T08:52:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  drafted: "bg-blue-100 text-blue-700",
  validated: "bg-amber-100 text-amber-800",
  released: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 100px 130px 120px 120px";
const PIPELINE_MIN = 800;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  drafted: "Drafted",
  validated: "Validated",
  released: "Released",
};

const NETWORK_LABEL: Record<FormState["network"], string> = {
  swift: "SWIFT",
  target2: "TARGET2",
  chaps: "CHAPS",
  fedwire: "Fedwire",
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
  if (step === "trade") {
    if (!f.tradeRef.trim()) return "Trade reference is required.";
    if (!f.amount || Number(f.amount) <= 0) return "Enter a positive amount.";
    if (!f.valueDate) return "Value date is required.";
  }
  if (step === "instruction") {
    if (!f.custodian.trim()) return "Custodian is required.";
    if (!f.account.trim()) return "Account is required.";
    if (!f.bic.trim()) return "BIC is required.";
    if (f.bic.length !== 8 && f.bic.length !== 11)
      return "BIC must be 8 or 11 characters.";
  }
  if (step === "routing") {
    return null;
  }
  if (step === "checks") {
    const allPass = Object.values(f.checks).every(Boolean);
    if (!allPass) return "All controls must pass before release.";
  }
  return null;
}

export default function SettlementInstructionPage() {
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
    const err = validate("checks", form);
    if (err) {
      setError(err);
      setStep("checks");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `SSI-${String(860 + pipeline.length + 1).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          tradeRef: form.tradeRef,
          ccy: form.ccy,
          amount: form.amount,
          direction: form.direction,
          network: form.network,
          stage: "drafted",
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
      drafted: pipeline.filter((p) => p.stage === "drafted").length,
      validated: pipeline.filter((p) => p.stage === "validated").length,
      released: pipeline.filter((p) => p.stage === "released").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Settlements
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Settlement Instruction
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — draft the instruction,
            clear the controls, release. Submit drops back here with the new
            instruction on the queue.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add instruction
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Drafted" value={counts.drafted} tone="blue" />
          <SummaryTile label="Validated" value={counts.validated} tone="amber" />
          <SummaryTile label="Released" value={counts.released} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Instruction</div>
            <div>Trade ref</div>
            <div>Direction</div>
            <div className="text-right">Amount</div>
            <div>Network</div>
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
                  {p.tradeRef}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(p.submittedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div className="text-xs text-neutral-700 capitalize">{p.direction}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {fmtMoney(p.amount, p.ccy)}
              </div>
              <div className="text-xs text-neutral-600">{NETWORK_LABEL[p.network]}</div>
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
              No settlement instructions in the queue. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add settlement instruction"
        description="Submit drafts the instruction for release. You can save and resume anytime."
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
                  {submitting ? "Releasing…" : "Release instruction"}
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
            {step === "instruction" && (
              <StepInstruction form={form} setForm={setForm} />
            )}
            {step === "routing" && <StepRouting form={form} setForm={setForm} />}
            {step === "checks" && <StepChecks form={form} setForm={setForm} />}
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
      <h3 className="text-sm font-semibold text-neutral-900">Trade and amount</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Capture the trade this instruction settles and the cash leg to move.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Trade reference">
          <input
            className={`${inputCls} font-mono`}
            value={form.tradeRef}
            onChange={(e) => setForm({ ...form, tradeRef: e.target.value.toUpperCase() })}
            placeholder="e.g. TRD-2026-04417"
          />
        </Field>
        <Field label="Direction">
          <select
            className={inputCls}
            value={form.direction}
            onChange={(e) =>
              setForm({ ...form, direction: e.target.value as FormState["direction"] })
            }
          >
            <option value="pay">Pay</option>
            <option value="receive">Receive</option>
          </select>
        </Field>
        <Field label="Amount">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="e.g. 18500000"
            min={0}
          />
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
            <option value="JPY">JPY</option>
          </select>
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

function StepInstruction({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Settlement instruction</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Where the {form.ccy} leg settles. Account and BIC are matched against the
        standing data master before release.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Custodian">
          <input
            className={inputCls}
            value={form.custodian}
            onChange={(e) => setForm({ ...form, custodian: e.target.value })}
            placeholder="e.g. BNP Paribas Securities Services"
          />
        </Field>
        <Field label="Account">
          <input
            className={`${inputCls} font-mono`}
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
            placeholder="Account number / IBAN"
          />
        </Field>
        <Field label="BIC" hint="8 or 11 characters.">
          <input
            className={`${inputCls} font-mono`}
            value={form.bic}
            onChange={(e) => setForm({ ...form, bic: e.target.value.toUpperCase() })}
            placeholder="e.g. PARBFRPP"
            maxLength={11}
          />
        </Field>
      </div>
    </div>
  );
}

function StepRouting({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Network and priority</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose the clearing network and whether the message should be queued
        urgent. Defaults are inferred from the currency.
      </p>
      <div className="mt-4">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
          Network
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["swift", "SWIFT MT202"],
              ["target2", "TARGET2"],
              ["chaps", "CHAPS"],
              ["fedwire", "Fedwire"],
            ] as const
          ).map(([k, label]) => {
            const on = form.network === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, network: k })}
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
      </div>
      <div className="mt-5 max-w-[260px]">
        <Field label="Priority">
          <select
            className={inputCls}
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value as FormState["priority"] })
            }
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepChecks({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Pre-release controls</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Every control must pass before the instruction can be released to the
        network. Toggle each as it clears.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(CHECK_LABELS) as CheckKey[]).map((k) => {
          const on = form.checks[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">{CHECK_LABELS[k]}</div>
                <div className="text-[11px] text-neutral-500">Required</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, checks: { ...form.checks, [k]: !on } })
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
  const checks = Object.entries(form.checks)
    .filter(([, v]) => v)
    .map(([k]) => CHECK_LABELS[k as CheckKey]);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and release</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Releasing queues the instruction to the network. It can be recalled
        until the cut-off for the value date.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Trade reference" value={form.tradeRef || "—"} mono />
        <ReviewRow
          label="Direction · amount"
          value={`${form.direction} · ${fmtMoney(form.amount, form.ccy)}`}
        />
        <ReviewRow label="Value date" value={form.valueDate || "—"} mono />
        <ReviewRow
          label="Custodian"
          value={form.custodian || "—"}
        />
        <ReviewRow
          label="Account · BIC"
          value={`${form.account || "—"} · ${form.bic || "no BIC"}`}
          mono
        />
        <ReviewRow
          label="Routing"
          value={`${NETWORK_LABEL[form.network]} · ${form.priority}`}
        />
        <ReviewRow
          label="Controls"
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
