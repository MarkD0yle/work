import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Block Allocation";
export const fullWidth = true;

/* Block Trade Allocation — page-level demo of a multi-step Modal wizard.
 * Page shows recently filled block orders as a workflow list; primary action
 * opens the wizard. Inside the modal: a stepper rail on the left, the form on
 * the right, a footer with Back / Next / Submit. The modal owns the entire
 * decision — focus is trapped, Esc abandons, Submit closes back to the list
 * with a new "pending" allocation. */

type Step = "block" | "method" | "allocate" | "checks" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "block", label: "Block", help: "The filled order." },
  { id: "method", label: "Method", help: "How to split." },
  { id: "allocate", label: "Allocate", help: "Per-fund quantities." },
  { id: "checks", label: "Checks", help: "Fairness and limits." },
  { id: "review", label: "Review", help: "Confirm before booking." },
];

type FundKey = "globalMacro" | "emDebt" | "creditOpps" | "multiAsset";

const FUND_LABELS: Record<FundKey, string> = {
  globalMacro: "Global Macro Fund",
  emDebt: "EM Debt Fund",
  creditOpps: "Credit Opportunities",
  multiAsset: "Multi-Asset Fund",
};

const FUND_KEYS: FundKey[] = ["globalMacro", "emDebt", "creditOpps", "multiAsset"];

type FormState = {
  instrument: string;
  side: "buy" | "sell";
  totalQty: string;
  avgPrice: string;
  ccy: "USD" | "EUR" | "GBP";
  method: "pro-rata" | "manual";
  allocations: Record<FundKey, string>;
  samePriceConfirmed: boolean;
  withinMandate: boolean;
};

const EMPTY: FormState = {
  instrument: "",
  side: "buy",
  totalQty: "",
  avgPrice: "",
  ccy: "USD",
  method: "pro-rata",
  allocations: { globalMacro: "", emDebt: "", creditOpps: "", multiAsset: "" },
  samePriceConfirmed: false,
  withinMandate: false,
};

type Submitted = {
  id: string;
  instrument: string;
  side: FormState["side"];
  totalQty: string;
  notional: string;
  ccy: FormState["ccy"];
  stage: "pending" | "allocated" | "booked";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "ALLOC-00153",
    instrument: "UST 4.25% 15-May-2036",
    side: "buy",
    totalQty: "5000000",
    notional: "USD 4.9m",
    ccy: "USD",
    stage: "pending",
    submittedAt: "2026-05-27T13:42:00Z",
  },
  {
    id: "ALLOC-00152",
    instrument: "Siemens AG (SIE GY)",
    side: "sell",
    totalQty: "250000",
    notional: "EUR 47.6m",
    ccy: "EUR",
    stage: "allocated",
    submittedAt: "2026-05-25T10:15:00Z",
  },
  {
    id: "ALLOC-00151",
    instrument: "GBP/USD spot block",
    side: "buy",
    totalQty: "40000000",
    notional: "GBP 40.0m",
    ccy: "GBP",
    stage: "booked",
    submittedAt: "2026-05-22T08:53:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  pending: "bg-blue-100 text-blue-700",
  allocated: "bg-amber-100 text-amber-800",
  booked: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "120px minmax(220px, 1fr) 80px 120px 120px 120px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  pending: "Pending",
  allocated: "Allocated",
  booked: "Booked",
};

function fmtMoney(amount: string, ccy: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${ccy} ${(n / 1_000_000_000).toFixed(2)}b`;
  if (n >= 1_000_000) return `${ccy} ${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${ccy} ${(n / 1_000).toFixed(0)}k`;
  return `${ccy} ${n}`;
}

function fmtQty(amount: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

function proRataSplit(total: number): Record<FundKey, number> {
  if (!Number.isFinite(total) || total <= 0) {
    return { globalMacro: 0, emDebt: 0, creditOpps: 0, multiAsset: 0 };
  }
  const base = Math.floor(total / FUND_KEYS.length);
  const remainder = total - base * FUND_KEYS.length;
  return {
    globalMacro: base + remainder,
    emDebt: base,
    creditOpps: base,
    multiAsset: base,
  };
}

function allocationSum(f: FormState): number {
  return FUND_KEYS.reduce((acc, k) => acc + (Number(f.allocations[k]) || 0), 0);
}

function validate(step: Step, f: FormState): string | null {
  if (step === "block") {
    if (!f.instrument.trim()) return "Instrument is required.";
    if (!f.totalQty || Number(f.totalQty) <= 0)
      return "Enter a positive total quantity.";
    if (!f.avgPrice || Number(f.avgPrice) <= 0)
      return "Enter a positive average price.";
  }
  if (step === "method") {
    // No hard requirement — pro-rata or manual both proceed.
  }
  if (step === "allocate") {
    const total = Number(f.totalQty) || 0;
    const sum = allocationSum(f);
    if (sum !== total)
      return `Allocations must sum to the total quantity (currently ${fmtQty(
        String(sum),
      )} of ${fmtQty(String(total))}).`;
  }
  if (step === "checks") {
    if (!f.samePriceConfirmed)
      return "Confirm all accounts receive the same average price.";
    if (!f.withinMandate)
      return "Confirm the allocation is within each fund's mandate.";
  }
  return null;
}

export default function BlockAllocationPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("block");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("block");
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
      const id = `ALLOC-${String(150 + pipeline.length + 1).padStart(5, "0")}`;
      const notional = fmtMoney(
        String((Number(form.totalQty) || 0) * (Number(form.avgPrice) || 0)),
        form.ccy,
      );
      setPipeline((prev) => [
        {
          id,
          instrument: form.instrument,
          side: form.side,
          totalQty: form.totalQty,
          notional,
          ccy: form.ccy,
          stage: "pending",
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
      pending: pipeline.filter((p) => p.stage === "pending").length,
      allocated: pipeline.filter((p) => p.stage === "allocated").length,
      booked: pipeline.filter((p) => p.stage === "booked").length,
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
            Block Trade Allocation
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — one decision, no
            distraction. Submit drops back here with the new allocation queued
            for booking.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add allocation
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Pending" value={counts.pending} tone="blue" />
          <SummaryTile label="Allocated" value={counts.allocated} tone="amber" />
          <SummaryTile label="Booked" value={counts.booked} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Allocation</div>
            <div>Instrument</div>
            <div>Side</div>
            <div className="text-right">Notional</div>
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
                  {p.instrument}
                </div>
                <div className="text-xs text-neutral-500">
                  {fmtQty(p.totalQty)} units
                </div>
              </div>
              <div className="text-xs text-neutral-700 capitalize">{p.side}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {p.notional}
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
              No block allocations yet. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add allocation"
        description="Submit queues this allocation for booking. You can save and resume anytime."
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
                  {submitting ? "Submitting…" : "Submit for booking"}
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
            {step === "block" && <StepBlock form={form} setForm={setForm} />}
            {step === "method" && <StepMethod form={form} setForm={setForm} />}
            {step === "allocate" && (
              <StepAllocate form={form} setForm={setForm} />
            )}
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

function StepBlock({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">The filled block</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Enter the details of the parent order as filled. These drive the
        notional and the per-fund split.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Instrument">
            <input
              className={inputCls}
              value={form.instrument}
              onChange={(e) => setForm({ ...form, instrument: e.target.value })}
              placeholder="e.g. UST 4.25% 15-May-2036"
            />
          </Field>
        </div>
        <Field label="Side">
          <select
            className={inputCls}
            value={form.side}
            onChange={(e) =>
              setForm({ ...form, side: e.target.value as FormState["side"] })
            }
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
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
        <Field label="Total quantity" hint="Units filled on the parent order.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.totalQty}
            onChange={(e) => setForm({ ...form, totalQty: e.target.value })}
            placeholder="e.g. 5000000"
            min={0}
          />
        </Field>
        <Field label="Average price" hint="Volume-weighted fill price.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.avgPrice}
            onChange={(e) => setForm({ ...form, avgPrice: e.target.value })}
            placeholder="e.g. 98.45"
            min={0}
            step="0.0001"
          />
        </Field>
      </div>
    </div>
  );
}

function StepMethod({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const options: { id: FormState["method"]; label: string; desc: string }[] = [
    {
      id: "pro-rata",
      label: "Pro-rata",
      desc: "Split the fill evenly across all four funds. Quantities are computed for you.",
    },
    {
      id: "manual",
      label: "Manual",
      desc: "Enter each fund's quantity by hand. They must still sum to the total.",
    },
  ];
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Allocation method</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Choose how the filled block is divided across the funds. You can refine
        the figures on the next step.
      </p>
      <div className="mt-4 grid gap-2">
        {options.map((o) => {
          const on = form.method === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setForm({ ...form, method: o.id })}
              className={`flex items-start gap-3 rounded-md border px-3 py-3 text-left ${
                on
                  ? "border-blue-300 bg-blue-50"
                  : "border-neutral-200 bg-white hover:bg-neutral-50"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-blue-500" : "border-neutral-300"
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              </span>
              <span>
                <span
                  className={`block text-sm font-medium ${
                    on ? "text-blue-800" : "text-neutral-900"
                  }`}
                >
                  {o.label}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  {o.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepAllocate({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const total = Number(form.totalQty) || 0;
  const proRata = proRataSplit(total);
  const isProRata = form.method === "pro-rata";
  const sum = isProRata
    ? FUND_KEYS.reduce((acc, k) => acc + proRata[k], 0)
    : allocationSum(form);
  const balanced = sum === total;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Per-fund quantities</h3>
      <p className="mt-1 text-xs text-neutral-500">
        {isProRata
          ? "Pro-rata splits the fill evenly; any remainder lands on the first fund."
          : "Enter each fund's quantity. They must sum exactly to the total."}
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {FUND_KEYS.map((k) => {
          const value = isProRata ? String(proRata[k]) : form.allocations[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-neutral-900">
                  {FUND_LABELS[k]}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {total > 0
                    ? `${(((Number(value) || 0) / total) * 100).toFixed(1)}% of block`
                    : "—"}
                </div>
              </div>
              <input
                type="number"
                className={`${inputCls} mt-0 w-40 text-right font-mono ${
                  isProRata ? "bg-neutral-50 text-neutral-500" : ""
                }`}
                value={value}
                disabled={isProRata}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allocations: { ...form.allocations, [k]: e.target.value },
                  })
                }
                placeholder="0"
                min={0}
              />
            </li>
          );
        })}
      </ul>
      <div
        className={`mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
          balanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <span className="font-semibold tracking-widest uppercase">Allocated</span>
        <span className="font-mono tabular-nums">
          {fmtQty(String(sum))} / {fmtQty(String(total))}
        </span>
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
  const checks: {
    key: "samePriceConfirmed" | "withinMandate";
    label: string;
    desc: string;
  }[] = [
    {
      key: "samePriceConfirmed",
      label: "Same average price for all accounts",
      desc: "Every fund receives the block's volume-weighted average fill price.",
    },
    {
      key: "withinMandate",
      label: "Allocation within each fund's mandate",
      desc: "Each fund's resulting position respects its instrument and concentration limits.",
    },
  ];
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Fairness and limits</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Confirm the allocation is fair across accounts and compliant with each
        fund's mandate before booking.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {checks.map((c) => {
          const on = form[c.key];
          return (
            <li
              key={c.key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-neutral-900">{c.label}</div>
                <div className="text-[11px] text-neutral-500">{c.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, [c.key]: !on })}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
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
  const total = Number(form.totalQty) || 0;
  const proRata = proRataSplit(total);
  const isProRata = form.method === "pro-rata";
  const notional = fmtMoney(
    String(total * (Number(form.avgPrice) || 0)),
    form.ccy,
  );
  const allocLines = FUND_KEYS.map((k) => {
    const v = isProRata ? proRata[k] : Number(form.allocations[k]) || 0;
    return `${FUND_LABELS[k]} ${fmtQty(String(v))}`;
  });
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and submit</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting queues this allocation for booking. Operations confirm the
        average price to each fund before settlement.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Instrument" value={form.instrument || "—"} />
        <ReviewRow
          label="Side · quantity"
          value={`${form.side} · ${fmtQty(form.totalQty)}`}
        />
        <ReviewRow label="Average price" value={form.avgPrice || "—"} mono />
        <ReviewRow label="Notional" value={notional} mono />
        <ReviewRow label="Method" value={form.method} />
        <ReviewRow label="Allocation" value={allocLines.join(", ")} />
        <ReviewRow
          label="Same average price"
          value={form.samePriceConfirmed ? "Confirmed" : "Not confirmed"}
        />
        <ReviewRow
          label="Within mandate"
          value={form.withinMandate ? "Confirmed" : "Not confirmed"}
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
