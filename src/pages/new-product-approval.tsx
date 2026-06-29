import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "New Product Approval";
export const fullWidth = true;

/* New Product Approval (NPA) — page-level demo of a multi-step Modal wizard.
 * Operational-risk workflow that gathers risk and systems sign-offs before a
 * desk may trade a new product. The page lists in-flight proposals as a
 * pipeline; the primary action opens the wizard. Inside the modal: a stepper
 * rail on the left, the form on the right, a footer with Back / Next / Submit.
 * The modal owns the entire decision — focus is trapped, Esc abandons, Submit
 * closes back to the list with a new "in-review" entry. */

type Step = "product" | "risks" | "systems" | "signoffs" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "product", label: "Product", help: "What is being proposed." },
  { id: "risks", label: "Risk review", help: "Identify and assess risks." },
  { id: "systems", label: "Systems & ops", help: "Booking and operational readiness." },
  { id: "signoffs", label: "Sign-offs", help: "Required committee approvals." },
  { id: "review", label: "Review", help: "Confirm before submitting." },
];

type RiskKey = "market" | "credit" | "liquidity" | "operational";

const RISK_LABELS: Record<RiskKey, string> = {
  market: "Market risk",
  credit: "Credit risk",
  liquidity: "Liquidity risk",
  operational: "Operational risk",
};

type SysKey = "booking" | "valuation" | "settlement" | "reporting";

const SYS_LABELS: Record<SysKey, string> = {
  booking: "Booking system ready",
  valuation: "Valuation model approved",
  settlement: "Settlement path tested",
  reporting: "Regulatory reporting mapped",
};

type SignKey = "marketRisk" | "operations" | "compliance";

const SIGN_LABELS: Record<SignKey, string> = {
  marketRisk: "Market Risk",
  operations: "Operations",
  compliance: "Compliance",
};

type FormState = {
  name: string;
  assetClass: "rates" | "fx" | "credit" | "equities" | "commodities" | "structured";
  desk: string;
  sponsor: string;
  risks: Record<RiskKey, boolean>;
  riskCommentary: string;
  systems: Record<SysKey, boolean>;
  signoffs: Record<SignKey, boolean>;
  complexity: "vanilla" | "moderate" | "complex";
};

const EMPTY: FormState = {
  name: "",
  assetClass: "rates",
  desk: "",
  sponsor: "",
  risks: { market: false, credit: false, liquidity: false, operational: false },
  riskCommentary: "",
  systems: { booking: false, valuation: false, settlement: false, reporting: false },
  signoffs: { marketRisk: false, operations: false, compliance: false },
  complexity: "vanilla",
};

type Submitted = {
  id: string;
  name: string;
  assetClass: FormState["assetClass"];
  desk: string;
  complexity: FormState["complexity"];
  stage: "in-review" | "conditional" | "approved";
  submittedAt: string;
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "NPA-2026-0057",
    name: "30Y SOFR swaption",
    assetClass: "rates",
    desk: "Rates Exotics",
    complexity: "complex",
    stage: "in-review",
    submittedAt: "2026-05-27T13:14:00Z",
  },
  {
    id: "NPA-2026-0056",
    name: "EUR inflation-linked bond",
    assetClass: "credit",
    desk: "Linear Credit",
    complexity: "moderate",
    stage: "conditional",
    submittedAt: "2026-05-23T10:02:00Z",
  },
  {
    id: "NPA-2026-0055",
    name: "Single-name CDS — EM sovereign",
    assetClass: "credit",
    desk: "Credit Flow",
    complexity: "moderate",
    stage: "approved",
    submittedAt: "2026-05-19T15:48:00Z",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  "in-review": "bg-blue-100 text-blue-700",
  conditional: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "130px minmax(220px, 1fr) 110px 120px 110px 120px";
const PIPELINE_MIN = 810;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  "in-review": "In review",
  conditional: "Conditional",
  approved: "Approved",
};

function validate(step: Step, f: FormState): string | null {
  if (step === "product") {
    if (!f.name.trim()) return "Product name is required.";
    if (!f.desk.trim()) return "Owning desk is required.";
    if (!f.sponsor.trim()) return "Sponsor is required.";
  }
  if (step === "risks") {
    const allAssessed = Object.values(f.risks).every(Boolean);
    if (!allAssessed) return "Assess all four risk areas before continuing.";
    if (!f.riskCommentary.trim()) return "Risk commentary is required.";
  }
  if (step === "systems") {
    const allReady = Object.values(f.systems).every(Boolean);
    if (!allReady) return "All operational readiness items must be confirmed.";
  }
  if (step === "signoffs") {
    const allSigned = Object.values(f.signoffs).every(Boolean);
    if (!allSigned) return "All three sign-offs are required.";
  }
  return null;
}

export default function NewProductApprovalPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("product");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("product");
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
    const err = validate("signoffs", form);
    if (err) {
      setError(err);
      setStep("signoffs");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `NPA-2026-${String(57 + pipeline.length + 1).padStart(4, "0")}`;
      setPipeline((prev) => [
        {
          id,
          name: form.name,
          assetClass: form.assetClass,
          desk: form.desk,
          complexity: form.complexity,
          stage: "in-review",
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
      inReview: pipeline.filter((p) => p.stage === "in-review").length,
      conditional: pipeline.filter((p) => p.stage === "conditional").length,
      approved: pipeline.filter((p) => p.stage === "approved").length,
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
            New Product Approval
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — one decision, no
            distraction. Submit routes the proposal to committee and drops back
            here with the new entry on the pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add proposal
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="Total" value={counts.total} />
          <SummaryTile label="In review" value={counts.inReview} tone="blue" />
          <SummaryTile label="Conditional" value={counts.conditional} tone="amber" />
          <SummaryTile label="Approved" value={counts.approved} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Proposal</div>
            <div>Product</div>
            <div>Asset class</div>
            <div>Complexity</div>
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
                  {p.name}
                </div>
                <div className="text-xs text-neutral-500">{p.desk}</div>
              </div>
              <div className="text-xs text-neutral-700 capitalize">{p.assetClass}</div>
              <div className="text-xs text-neutral-700 capitalize">{p.complexity}</div>
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
              No proposals in approval. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add proposal"
        description="Submit routes this product to the New Product Approval committee. You can save and resume anytime."
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
                  {submitting ? "Submitting…" : "Submit for review"}
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
            {step === "product" && (
              <StepProduct form={form} setForm={setForm} />
            )}
            {step === "risks" && <StepRisks form={form} setForm={setForm} />}
            {step === "systems" && <StepSystems form={form} setForm={setForm} />}
            {step === "signoffs" && <StepSignoffs form={form} setForm={setForm} />}
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

function StepProduct({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">What is being proposed</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Describe the new product and the desk that intends to trade it. The
        sponsor owns the proposal through committee.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Product name">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. 30Y SOFR swaption"
          />
        </Field>
        <Field label="Asset class">
          <select
            className={inputCls}
            value={form.assetClass}
            onChange={(e) =>
              setForm({ ...form, assetClass: e.target.value as FormState["assetClass"] })
            }
          >
            <option value="rates">Rates</option>
            <option value="fx">FX</option>
            <option value="credit">Credit</option>
            <option value="equities">Equities</option>
            <option value="commodities">Commodities</option>
            <option value="structured">Structured</option>
          </select>
        </Field>
        <Field label="Owning desk">
          <input
            className={inputCls}
            value={form.desk}
            onChange={(e) => setForm({ ...form, desk: e.target.value })}
            placeholder="e.g. Rates Exotics"
          />
        </Field>
        <Field label="Sponsor" hint="Accountable owner through approval.">
          <input
            className={inputCls}
            value={form.sponsor}
            onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
            placeholder="e.g. J. Okonkwo"
          />
        </Field>
        <Field label="Complexity">
          <select
            className={inputCls}
            value={form.complexity}
            onChange={(e) =>
              setForm({ ...form, complexity: e.target.value as FormState["complexity"] })
            }
          >
            <option value="vanilla">Vanilla</option>
            <option value="moderate">Moderate</option>
            <option value="complex">Complex</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepRisks({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Risk review</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Toggle each risk area once it has been assessed. All four must be
        assessed before the proposal can move to systems readiness.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(RISK_LABELS) as RiskKey[]).map((k) => {
          const on = form.risks[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">{RISK_LABELS[k]}</div>
                <div className="text-[11px] text-neutral-500">
                  {on ? "Assessed" : "Not yet assessed"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, risks: { ...form.risks, [k]: !on } })
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
      <div className="mt-4">
        <Field label="Risk commentary" hint="Summarise key exposures and mitigants.">
          <textarea
            className={`${inputCls} min-h-[90px] resize-y`}
            value={form.riskCommentary}
            onChange={(e) => setForm({ ...form, riskCommentary: e.target.value })}
            placeholder="e.g. Vega and gamma concentrated in the long end; hedged via SOFR options. Counterparty limits sufficient under stressed scenarios."
          />
        </Field>
      </div>
    </div>
  );
}

function StepSystems({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Systems & operational readiness</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Confirm each booking and operational item. All must be ready before the
        product can be cleared for trading.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(SYS_LABELS) as SysKey[]).map((k) => {
          const on = form.systems[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">{SYS_LABELS[k]}</div>
                <div className="text-[11px] text-neutral-500">
                  {on ? "Confirmed" : "Outstanding"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, systems: { ...form.systems, [k]: !on } })
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

function StepSignoffs({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Required sign-offs</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Each control function must sign off before the proposal is submitted to
        committee. All three are mandatory.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(Object.keys(SIGN_LABELS) as SignKey[]).map((k) => {
          const on = form.signoffs[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() =>
                setForm({ ...form, signoffs: { ...form.signoffs, [k]: !on } })
              }
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                on
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span>{SIGN_LABELS[k]}</span>
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
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
  );
}

function StepReview({ form }: { form: FormState }) {
  const risks = Object.entries(form.risks)
    .filter(([, v]) => v)
    .map(([k]) => RISK_LABELS[k as RiskKey]);
  const systems = Object.entries(form.systems)
    .filter(([, v]) => v)
    .map(([k]) => SYS_LABELS[k as SysKey]);
  const signoffs = Object.entries(form.signoffs)
    .filter(([, v]) => v)
    .map(([k]) => SIGN_LABELS[k as SignKey]);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and submit</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting routes this proposal to the New Product Approval committee.
        Conditional approvals may attach remediation actions before go-live.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Product" value={form.name || "—"} />
        <ReviewRow
          label="Asset class · complexity"
          value={`${form.assetClass} · ${form.complexity}`}
        />
        <ReviewRow label="Owning desk" value={form.desk || "—"} />
        <ReviewRow label="Sponsor" value={form.sponsor || "—"} />
        <ReviewRow
          label="Risks assessed"
          value={risks.length ? risks.join(", ") : "None"}
        />
        <ReviewRow label="Risk commentary" value={form.riskCommentary || "—"} />
        <ReviewRow
          label="Systems ready"
          value={systems.length ? systems.join(", ") : "None"}
        />
        <ReviewRow
          label="Sign-offs"
          value={signoffs.length ? signoffs.join(", ") : "None"}
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
