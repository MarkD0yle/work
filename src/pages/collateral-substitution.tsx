import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Collateral Substitution";
export const fullWidth = true;

/* Collateral Substitution — page-level demo of a multi-step Modal wizard.
 * Page shows in-flight substitution requests as a workflow list; primary
 * action opens the wizard. Inside the modal: a stepper rail on the left, the
 * form on the right, a footer with Back / Next / Submit. The modal owns the
 * entire decision — focus is trapped, Esc abandons, Submit closes back to the
 * list with a new "requested" entry. The wizard swaps pledged collateral for
 * an alternative asset and checks post-haircut sufficiency before raising. */

type Step = "position" | "substitute" | "valuation" | "approval" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "position", label: "Position", help: "The pledged collateral." },
  { id: "substitute", label: "Substitute", help: "Proposed replacement." },
  { id: "valuation", label: "Valuation", help: "Post-haircut sufficiency." },
  { id: "approval", label: "Approval", help: "Authoriser." },
  { id: "review", label: "Review", help: "Confirm before raising." },
];

type AssetClass = "govt" | "supra" | "corporate" | "equity" | "cash";

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  govt: "Government bond",
  supra: "Supranational / agency",
  corporate: "Corporate bond",
  equity: "Equity",
  cash: "Cash",
};

type Reason =
  | "upcoming-maturity"
  | "operational"
  | "cheapest-to-deliver"
  | "recall";

const REASON_LABELS: Record<Reason, string> = {
  "upcoming-maturity": "Upcoming maturity",
  operational: "Operational",
  "cheapest-to-deliver": "Cheapest-to-deliver",
  recall: "Recall",
};

type FormState = {
  agreement: string;
  counterparty: string;
  currentAsset: string;
  currentValue: string;
  ccy: "USD" | "EUR" | "GBP";
  newAsset: string;
  newAssetClass: AssetClass;
  newMarketValue: string;
  haircut: string;
  eligible: boolean;
  reason: Reason;
  authoriser: string;
};

const EMPTY: FormState = {
  agreement: "",
  counterparty: "",
  currentAsset: "",
  currentValue: "",
  ccy: "USD",
  newAsset: "",
  newAssetClass: "govt",
  newMarketValue: "",
  haircut: "",
  eligible: false,
  reason: "upcoming-maturity",
  authoriser: "",
};

type Submitted = {
  id: string;
  counterparty: string;
  newAsset: string;
  postHaircut: string;
  ccy: FormState["ccy"];
  stage: "requested" | "approved" | "settled";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "SUB-00207",
    counterparty: "Northwind Capital Partners LP",
    newAsset: "DBR 2.30% 02/2033 (Bund)",
    postHaircut: "EUR 48.7m",
    ccy: "EUR",
    stage: "requested",
    submittedAt: "2026-05-27T10:14:00Z",
  },
  {
    id: "SUB-00206",
    counterparty: "Aurora Trading Société",
    newAsset: "USD cash",
    postHaircut: "USD 31.0m",
    ccy: "USD",
    stage: "approved",
    submittedAt: "2026-05-25T08:42:00Z",
  },
  {
    id: "SUB-00205",
    counterparty: "Helix Logistics Holdings plc",
    newAsset: "GILT 4.25% 06/2032",
    postHaircut: "GBP 22.4m",
    ccy: "GBP",
    stage: "settled",
    submittedAt: "2026-05-21T15:03:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  requested: "bg-blue-100 text-blue-700",
  approved: "bg-amber-100 text-amber-800",
  settled: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 100px 110px 120px 130px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  requested: "Requested",
  approved: "Approved",
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

function postHaircutValue(f: FormState): number {
  const mv = Number(f.newMarketValue);
  const hc = Number(f.haircut);
  if (!Number.isFinite(mv) || !Number.isFinite(hc)) return NaN;
  return mv * (1 - hc / 100);
}

function validate(step: Step, f: FormState): string | null {
  if (step === "position") {
    if (!f.agreement.trim()) return "Agreement reference is required.";
    if (!f.counterparty.trim()) return "Counterparty is required.";
    if (!f.currentValue || Number(f.currentValue) <= 0)
      return "Enter a positive position value.";
  }
  if (step === "substitute") {
    if (!f.newAsset.trim()) return "Proposed asset is required.";
    if (!f.newMarketValue || Number(f.newMarketValue) <= 0)
      return "Enter a positive market value.";
    const hc = Number(f.haircut);
    if (!Number.isFinite(hc) || hc < 0 || hc > 100)
      return "Haircut must be between 0 and 100%.";
    if (!f.eligible)
      return "Proposed asset must be eligible under the schedule.";
  }
  if (step === "valuation") {
    if (postHaircutValue(f) < Number(f.currentValue))
      return "Post-haircut value is insufficient to cover the position.";
  }
  if (step === "approval") {
    if (!f.authoriser.trim()) return "Authoriser is required.";
  }
  return null;
}

export default function CollateralSubstitutionPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("position");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("position");
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
    for (const s of ["position", "substitute", "valuation", "approval"] as Step[]) {
      const err = validate(s, form);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `SUB-${String(207 + pipeline.length - 2).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          counterparty: form.counterparty,
          newAsset: form.newAsset,
          postHaircut: fmtMoney(String(postHaircutValue(form)), form.ccy),
          ccy: form.ccy,
          stage: "requested",
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
      requested: pipeline.filter((p) => p.stage === "requested").length,
      approved: pipeline.filter((p) => p.stage === "approved").length,
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
            Collateral Substitution
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — swap pledged collateral
            for an alternative and confirm post-haircut sufficiency. Submit drops
            back here with the new request on the pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add substitution
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="Requested" value={counts.requested} tone="blue" />
          <SummaryTile label="Approved" value={counts.approved} tone="amber" />
          <SummaryTile label="Settled" value={counts.settled} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Request</div>
            <div>Counterparty</div>
            <div>Currency</div>
            <div className="text-right">Post-haircut</div>
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
                <div className="truncate text-xs text-neutral-500">
                  {p.newAsset}
                </div>
              </div>
              <div className="text-xs text-neutral-700">{p.ccy}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {p.postHaircut}
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
              No substitutions in flight. Raise one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add substitution"
        description="Submit raises a substitution request for approval and settlement. You can save and resume anytime."
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
                  {submitting ? "Raising…" : "Raise request"}
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
            {step === "position" && (
              <StepPosition form={form} setForm={setForm} />
            )}
            {step === "substitute" && (
              <StepSubstitute form={form} setForm={setForm} />
            )}
            {step === "valuation" && <StepValuation form={form} />}
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

function StepPosition({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Pledged collateral</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Identify the agreement and the exposure the existing collateral covers.
        The substitute must cover at least this value post-haircut.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Agreement" hint="GMRA / CSA reference.">
          <input
            className={`${inputCls} font-mono`}
            value={form.agreement}
            onChange={(e) =>
              setForm({ ...form, agreement: e.target.value.toUpperCase() })
            }
            placeholder="e.g. CSA-2024-0188"
          />
        </Field>
        <Field label="Counterparty">
          <input
            className={inputCls}
            value={form.counterparty}
            onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            placeholder="e.g. Northwind Capital Partners LP"
          />
        </Field>
        <Field label="Current asset" hint="The collateral being recalled.">
          <input
            className={inputCls}
            value={form.currentAsset}
            onChange={(e) => setForm({ ...form, currentAsset: e.target.value })}
            placeholder="e.g. US T-Bill 08/2026"
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Position value" hint="Exposure to cover.">
              <input
                type="number"
                className={`${inputCls} font-mono`}
                value={form.currentValue}
                onChange={(e) =>
                  setForm({ ...form, currentValue: e.target.value })
                }
                placeholder="e.g. 48000000"
                min={0}
              />
            </Field>
          </div>
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
      </div>
    </div>
  );
}

function StepSubstitute({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Proposed replacement</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Describe the asset to pledge in place of the recalled collateral. It must
        be eligible under the schedule and carry a defined haircut.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Proposed asset">
          <input
            className={inputCls}
            value={form.newAsset}
            onChange={(e) => setForm({ ...form, newAsset: e.target.value })}
            placeholder="e.g. DBR 2.30% 02/2033 (Bund)"
          />
        </Field>
        <Field label="Asset class">
          <select
            className={inputCls}
            value={form.newAssetClass}
            onChange={(e) =>
              setForm({
                ...form,
                newAssetClass: e.target.value as AssetClass,
              })
            }
          >
            <option value="govt">Government bond</option>
            <option value="supra">Supranational / agency</option>
            <option value="corporate">Corporate bond</option>
            <option value="equity">Equity</option>
            <option value="cash">Cash</option>
          </select>
        </Field>
        <Field label="Market value">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.newMarketValue}
            onChange={(e) =>
              setForm({ ...form, newMarketValue: e.target.value })
            }
            placeholder="e.g. 52000000"
            min={0}
          />
        </Field>
        <Field label="Haircut %" hint="0–100. Applied to market value.">
          <input
            type="number"
            className={`${inputCls} font-mono`}
            value={form.haircut}
            onChange={(e) => setForm({ ...form, haircut: e.target.value })}
            placeholder="e.g. 2"
            min={0}
            max={100}
          />
        </Field>
      </div>
      <div className="mt-5">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
          Eligibility
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, eligible: !form.eligible })}
          className={`mt-2 flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-sm ${
            form.eligible
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
          aria-pressed={form.eligible}
        >
          <span>Asset is eligible under the schedule</span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              form.eligible ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.eligible ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

function StepValuation({ form }: { form: FormState }) {
  const ph = postHaircutValue(form);
  const required = Number(form.currentValue);
  const covers = Number.isFinite(ph) && ph >= required;
  const surplus = ph - required;
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Post-haircut sufficiency</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Post-haircut value = market value × (1 − haircut). It must cover the
        position before the request can be raised.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow
          label="Market value"
          value={fmtMoney(form.newMarketValue, form.ccy)}
          mono
        />
        <ReviewRow
          label="Haircut"
          value={form.haircut ? `${form.haircut}%` : "—"}
          mono
        />
        <ReviewRow
          label="Post-haircut value"
          value={
            Number.isFinite(ph) ? fmtMoney(String(ph), form.ccy) : "—"
          }
          mono
        />
        <ReviewRow
          label="Position to cover"
          value={fmtMoney(form.currentValue, form.ccy)}
          mono
        />
      </dl>
      <div
        className={`mt-4 flex items-center justify-between rounded-md border px-3 py-2.5 text-sm ${
          covers
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}
      >
        <span className="font-medium">
          {covers ? "Sufficient cover" : "Insufficient cover"}
        </span>
        <span className="font-mono text-xs tabular-nums">
          {Number.isFinite(surplus)
            ? `${surplus >= 0 ? "+" : ""}${fmtMoney(String(surplus), form.ccy)}`
            : "—"}
        </span>
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
      <h3 className="text-sm font-semibold text-neutral-900">Authoriser</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Record who is authorising the substitution and the driver for the swap.
        Approval routes the request to settlement.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Authoriser" hint="Name of the approving signatory.">
          <input
            className={inputCls}
            value={form.authoriser}
            onChange={(e) => setForm({ ...form, authoriser: e.target.value })}
            placeholder="e.g. R. Okafor"
          />
        </Field>
        <Field label="Reason">
          <select
            className={inputCls}
            value={form.reason}
            onChange={(e) =>
              setForm({ ...form, reason: e.target.value as Reason })
            }
          >
            <option value="upcoming-maturity">Upcoming maturity</option>
            <option value="operational">Operational</option>
            <option value="cheapest-to-deliver">Cheapest-to-deliver</option>
            <option value="recall">Recall</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const ph = postHaircutValue(form);
  const covers = Number.isFinite(ph) && ph >= Number(form.currentValue);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and raise</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Raising routes this substitution to approval. Settlement is booked once
        the authoriser signs off.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Agreement" value={form.agreement || "—"} mono />
        <ReviewRow label="Counterparty" value={form.counterparty || "—"} />
        <ReviewRow
          label="Recalling"
          value={form.currentAsset || "—"}
        />
        <ReviewRow
          label="Substituting"
          value={`${form.newAsset || "—"} · ${ASSET_CLASS_LABELS[form.newAssetClass]}`}
        />
        <ReviewRow
          label="Market value · haircut"
          value={`${fmtMoney(form.newMarketValue, form.ccy)} · ${form.haircut || "0"}%`}
          mono
        />
        <ReviewRow
          label="Post-haircut value"
          value={`${
            Number.isFinite(ph) ? fmtMoney(String(ph), form.ccy) : "—"
          } · ${covers ? "covers position" : "short of position"}`}
          mono
        />
        <ReviewRow
          label="Position to cover"
          value={fmtMoney(form.currentValue, form.ccy)}
          mono
        />
        <ReviewRow
          label="Reason"
          value={REASON_LABELS[form.reason]}
        />
        <ReviewRow label="Authoriser" value={form.authoriser || "—"} />
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
