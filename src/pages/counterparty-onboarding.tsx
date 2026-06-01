import { useMemo, useState } from "react";
import Modal from "../components/patterns/Modal";

export const title = "Onboarding";
export const fullWidth = true;

/* Counterparty Onboarding — page-level demo of a multi-step Modal wizard.
 * Page shows in-flight onboardings as a workflow list; primary action opens
 * the wizard. Inside the modal: a stepper rail on the left, the form on the
 * right, a footer with Back / Next / Submit. The modal owns the entire
 * decision — focus is trapped, Esc abandons, Submit closes back to the list
 * with a new "submitted" entry. */

type Step = "entity" | "docs" | "limits" | "ssi" | "review";

const STEPS: { id: Step; label: string; help: string }[] = [
  { id: "entity", label: "Legal entity", help: "Identify the legal counterparty." },
  { id: "docs", label: "Documents", help: "Required onboarding paperwork." },
  { id: "limits", label: "Limits", help: "Initial credit and product limits." },
  { id: "ssi", label: "Settlement", help: "Standing settlement instructions." },
  { id: "review", label: "Review", help: "Final check before submission." },
];

type DocKey = "isda" | "kyc" | "wolfsberg" | "w8";

const DOC_LABELS: Record<DocKey, string> = {
  isda: "ISDA Master Agreement",
  kyc: "KYC pack",
  wolfsberg: "Wolfsberg CBDDQ",
  w8: "Form W-8BEN-E / W-9",
};

type FormState = {
  legalName: string;
  shortName: string;
  lei: string;
  domicile: string;
  category: "bank" | "broker" | "fund" | "corporate";
  docs: Record<DocKey, boolean>;
  totalLimit: string;
  ccy: "USD" | "EUR" | "GBP";
  products: { equities: boolean; fx: boolean; rates: boolean; repo: boolean };
  ssiCustodian: string;
  ssiAccount: string;
  ssiBic: string;
};

const EMPTY: FormState = {
  legalName: "",
  shortName: "",
  lei: "",
  domicile: "",
  category: "bank",
  docs: { isda: false, kyc: false, wolfsberg: false, w8: false },
  totalLimit: "",
  ccy: "USD",
  products: { equities: false, fx: false, rates: false, repo: false },
  ssiCustodian: "",
  ssiAccount: "",
  ssiBic: "",
};

type Submitted = {
  id: string;
  legalName: string;
  shortName: string;
  category: FormState["category"];
  totalLimit: string;
  ccy: FormState["ccy"];
  submittedAt: string;
  stage: "credit-review" | "legal-review" | "approved";
};

const INITIAL_PIPELINE: Submitted[] = [
  {
    id: "ONB-00041",
    legalName: "Northwind Capital Partners LP",
    shortName: "NWCP",
    category: "fund",
    totalLimit: "50000000",
    ccy: "USD",
    submittedAt: "2026-05-26T14:21:00Z",
    stage: "credit-review",
  },
  {
    id: "ONB-00040",
    legalName: "Aurora Trading Société",
    shortName: "AURO-PAR",
    category: "broker",
    totalLimit: "120000000",
    ccy: "EUR",
    submittedAt: "2026-05-24T09:08:00Z",
    stage: "legal-review",
  },
  {
    id: "ONB-00039",
    legalName: "Helix Logistics Holdings plc",
    shortName: "HLX",
    category: "corporate",
    totalLimit: "25000000",
    ccy: "GBP",
    submittedAt: "2026-05-22T11:45:00Z",
    stage: "approved",
  },
];

const STAGE_TONE: Record<Submitted["stage"], string> = {
  "credit-review": "bg-blue-100 text-blue-700",
  "legal-review": "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
};

const PIPELINE_COLS = "110px minmax(220px, 1fr) 100px 110px 120px 130px";
const PIPELINE_MIN = 790;

const STAGE_LABEL: Record<Submitted["stage"], string> = {
  "credit-review": "Credit review",
  "legal-review": "Legal review",
  approved: "Approved",
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
  if (step === "entity") {
    if (!f.legalName.trim()) return "Legal name is required.";
    if (!f.shortName.trim()) return "Short code is required.";
    if (f.lei && f.lei.length !== 20) return "LEI must be exactly 20 characters.";
    if (!f.domicile.trim()) return "Domicile is required.";
  }
  if (step === "docs") {
    if (!f.docs.isda || !f.docs.kyc) return "ISDA and KYC are required to proceed.";
  }
  if (step === "limits") {
    if (!f.totalLimit || Number(f.totalLimit) <= 0)
      return "Enter a positive total limit.";
    const anyProduct = Object.values(f.products).some(Boolean);
    if (!anyProduct) return "Select at least one product.";
  }
  if (step === "ssi") {
    if (!f.ssiCustodian.trim()) return "Custodian is required.";
    if (!f.ssiAccount.trim()) return "Account is required.";
    if (f.ssiBic && f.ssiBic.length < 8) return "BIC must be 8 or 11 characters.";
  }
  return null;
}

export default function CounterpartyOnboardingPage() {
  const [pipeline, setPipeline] = useState<Submitted[]>(INITIAL_PIPELINE);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("entity");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  function startWizard() {
    setForm(EMPTY);
    setStep("entity");
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
    const err = validate("ssi", form);
    if (err) {
      setError(err);
      setStep("ssi");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const id = `ONB-${String(40 + pipeline.length + 2).padStart(5, "0")}`;
      setPipeline((prev) => [
        {
          id,
          legalName: form.legalName,
          shortName: form.shortName,
          category: form.category,
          totalLimit: form.totalLimit,
          ccy: form.ccy,
          submittedAt: new Date().toISOString(),
          stage: "credit-review",
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
      credit: pipeline.filter((p) => p.stage === "credit-review").length,
      legal: pipeline.filter((p) => p.stage === "legal-review").length,
      approved: pipeline.filter((p) => p.stage === "approved").length,
    };
  }, [pipeline]);

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="flex items-end justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
            Onboarding
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
            Counterparty Onboarding
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            The wizard lives in a focus-trapped modal — one decision, no
            distraction. Submit drops back here with the new entry on the
            pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={startWizard}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add counterparty
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Summary tiles */}
        <div className="mb-6 grid max-w-[1100px] grid-cols-4 gap-3">
          <SummaryTile label="In pipeline" value={counts.total} />
          <SummaryTile label="Credit review" value={counts.credit} tone="blue" />
          <SummaryTile label="Legal review" value={counts.legal} tone="amber" />
          <SummaryTile label="Approved" value={counts.approved} tone="emerald" />
        </div>

        {/* Pipeline list */}
        <div className="max-w-[1100px] overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div
            className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase"
            style={{ gridTemplateColumns: PIPELINE_COLS, minWidth: PIPELINE_MIN }}
          >
            <div>Onboarding</div>
            <div>Legal name</div>
            <div>Category</div>
            <div className="text-right">Limit</div>
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
                  {p.legalName}
                </div>
                <div className="text-xs text-neutral-500">{p.shortName}</div>
              </div>
              <div className="text-xs text-neutral-700 capitalize">{p.category}</div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-700">
                {fmtMoney(p.totalLimit, p.ccy)}
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
              No counterparties in onboarding. Start one above.
            </div>
          )}
        </div>
      </div>

      {/* Wizard modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add counterparty"
        description="Submit kicks off credit and legal review. You can save and resume anytime."
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
            {step === "entity" && (
              <StepEntity form={form} setForm={setForm} />
            )}
            {step === "docs" && <StepDocs form={form} setForm={setForm} />}
            {step === "limits" && <StepLimits form={form} setForm={setForm} />}
            {step === "ssi" && <StepSsi form={form} setForm={setForm} />}
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

function StepEntity({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Identify the legal entity</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Use the full registered name as it appears on incorporation documents.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Legal name">
          <input
            className={inputCls}
            value={form.legalName}
            onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            placeholder="e.g. Northwind Capital Partners LP"
          />
        </Field>
        <Field label="Short code" hint="Used across blotter, ops, comms.">
          <input
            className={inputCls}
            value={form.shortName}
            onChange={(e) =>
              setForm({ ...form, shortName: e.target.value.toUpperCase() })
            }
            placeholder="e.g. NWCP"
            maxLength={12}
          />
        </Field>
        <Field label="LEI" hint="20-character Legal Entity Identifier. Optional at draft.">
          <input
            className={`${inputCls} font-mono`}
            value={form.lei}
            onChange={(e) => setForm({ ...form, lei: e.target.value.toUpperCase() })}
            placeholder="20-character LEI"
            maxLength={20}
          />
        </Field>
        <Field label="Domicile">
          <input
            className={inputCls}
            value={form.domicile}
            onChange={(e) => setForm({ ...form, domicile: e.target.value })}
            placeholder="e.g. United Kingdom"
          />
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as FormState["category"] })
            }
          >
            <option value="bank">Bank</option>
            <option value="broker">Broker</option>
            <option value="fund">Fund</option>
            <option value="corporate">Corporate</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepDocs({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const required: DocKey[] = ["isda", "kyc"];
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Documents on file</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Toggle each document you've already received. ISDA and KYC are required
        before the entity can move to credit review.
      </p>
      <ul className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        {(Object.keys(DOC_LABELS) as DocKey[]).map((k) => {
          const isReq = required.includes(k);
          const on = form.docs[k];
          return (
            <li
              key={k}
              className="flex items-center justify-between px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-neutral-900">{DOC_LABELS[k]}</div>
                <div className="text-[11px] text-neutral-500">
                  {isReq ? "Required" : "Optional"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, docs: { ...form.docs, [k]: !on } })
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

function StepLimits({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Initial limits</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Set the day-one total credit limit and select tradable products. Limits
        can be revised by Credit after onboarding.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Total credit limit">
            <input
              type="number"
              className={`${inputCls} font-mono`}
              value={form.totalLimit}
              onChange={(e) => setForm({ ...form, totalLimit: e.target.value })}
              placeholder="e.g. 50000000"
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
      <div className="mt-5">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
          Permitted products
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["equities", "Cash equities"],
              ["fx", "FX spot & forwards"],
              ["rates", "Rates"],
              ["repo", "Repo & SBL"],
            ] as const
          ).map(([k, label]) => {
            const on = form.products[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setForm({ ...form, products: { ...form.products, [k]: !on } })
                }
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                  on
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span>{label}</span>
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
    </div>
  );
}

function StepSsi({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Standing settlement instructions</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Default SSI for {form.ccy}. Additional currencies can be added after the
        entity is approved.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Custodian">
          <input
            className={inputCls}
            value={form.ssiCustodian}
            onChange={(e) => setForm({ ...form, ssiCustodian: e.target.value })}
            placeholder="e.g. State Street"
          />
        </Field>
        <Field label="Account">
          <input
            className={`${inputCls} font-mono`}
            value={form.ssiAccount}
            onChange={(e) => setForm({ ...form, ssiAccount: e.target.value })}
            placeholder="Account number / IBAN"
          />
        </Field>
        <Field label="BIC" hint="8 or 11 characters.">
          <input
            className={`${inputCls} font-mono`}
            value={form.ssiBic}
            onChange={(e) => setForm({ ...form, ssiBic: e.target.value.toUpperCase() })}
            placeholder="e.g. SBOSGB2X"
            maxLength={11}
          />
        </Field>
      </div>
    </div>
  );
}

function StepReview({ form }: { form: FormState }) {
  const docs = Object.entries(form.docs)
    .filter(([, v]) => v)
    .map(([k]) => DOC_LABELS[k as DocKey]);
  const products = Object.entries(form.products)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Review and submit</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Submitting routes this entity to Credit. Legal review starts in parallel
        once KYC is verified.
      </p>
      <dl className="mt-4 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
        <ReviewRow label="Legal name" value={form.legalName || "—"} />
        <ReviewRow
          label="Short code · category"
          value={`${form.shortName || "—"} · ${form.category}`}
        />
        <ReviewRow label="LEI" value={form.lei || "—"} mono />
        <ReviewRow label="Domicile" value={form.domicile || "—"} />
        <ReviewRow
          label="Documents"
          value={docs.length ? docs.join(", ") : "None"}
        />
        <ReviewRow
          label="Initial limit"
          value={fmtMoney(form.totalLimit, form.ccy)}
          mono
        />
        <ReviewRow
          label="Products"
          value={products.length ? products.join(", ") : "None"}
        />
        <ReviewRow
          label="SSI"
          value={
            form.ssiCustodian
              ? `${form.ssiCustodian} · ${form.ssiAccount} · ${form.ssiBic || "no BIC"}`
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
