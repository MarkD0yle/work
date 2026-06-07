import { useMemo, useState } from "react";
import {
  FormCard,
  OptionCard,
  SelectField,
  Stepper,
  TextField,
  Toggle,
  type Step,
} from "../components/forms";

export const title = "Client Onboarding";
export const fullWidth = true;

/* Client Onboarding — a full-page guided wizard (the inline counterpart to
 * the modal-based Counterparty Onboarding). The flow lives in the page itself:
 * a vertical stepper rail on the left, the active step's form in the centre,
 * and a live summary aside on the right that fills in as you go. A sticky
 * footer drives Back / Continue / Submit; the final step lands on a success
 * panel. Validation runs per-step on Continue and surfaces inline. */

type StepId = "company" | "contact" | "compliance" | "plan" | "review";

const STEPS: (Step & { id: StepId })[] = [
  { id: "company", label: "Company", help: "Who are we onboarding?" },
  { id: "contact", label: "Primary contact", help: "Day-to-day point of contact." },
  { id: "compliance", label: "Compliance", help: "KYC and risk basics." },
  { id: "plan", label: "Plan", help: "Service tier and billing." },
  { id: "review", label: "Review", help: "Confirm and submit." },
];

type Plan = "essentials" | "professional" | "enterprise";

type Form = {
  legalName: string;
  tradingName: string;
  industry: string;
  size: string;
  website: string;
  contactFirst: string;
  contactLast: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  entityType: string;
  sanctionsScreened: boolean;
  pep: boolean;
  plan: Plan;
  billingCycle: "monthly" | "annual";
  poNumber: string;
};

const EMPTY: Form = {
  legalName: "",
  tradingName: "",
  industry: "financial",
  size: "11-50",
  website: "",
  contactFirst: "",
  contactLast: "",
  contactEmail: "",
  contactPhone: "",
  country: "GB",
  entityType: "ltd",
  sanctionsScreened: false,
  pep: false,
  plan: "professional",
  billingCycle: "annual",
  poNumber: "",
};

const PLANS: { id: Plan; title: string; price: string; blurb: string }[] = [
  { id: "essentials", title: "Essentials", price: "£500/mo", blurb: "Core reporting, 5 users" },
  { id: "professional", title: "Professional", price: "£1,500/mo", blurb: "Alerts, queues, 25 users" },
  { id: "enterprise", title: "Enterprise", price: "Custom", blurb: "SSO, SLA, unlimited users" },
];

type Errors = Partial<Record<keyof Form, string>>;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(step: StepId, f: Form): Errors {
  const e: Errors = {};
  if (step === "company") {
    if (!f.legalName.trim()) e.legalName = "Legal name is required.";
    if (f.website && !/^https?:\/\/|\./.test(f.website))
      e.website = "Enter a valid URL.";
  }
  if (step === "contact") {
    if (!f.contactFirst.trim()) e.contactFirst = "Required.";
    if (!f.contactLast.trim()) e.contactLast = "Required.";
    if (!emailRe.test(f.contactEmail)) e.contactEmail = "Enter a valid email.";
  }
  if (step === "compliance") {
    if (!f.sanctionsScreened)
      e.sanctionsScreened = "Sanctions screening must be confirmed to proceed.";
  }
  return e;
}

export default function ClientOnboardingPage() {
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reference, setReference] = useState("");

  const step = STEPS[idx].id;
  const isLast = idx === STEPS.length - 1;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function goNext() {
    const e = validate(step, form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (!isLast) setIdx((i) => i + 1);
    else {
      setSubmitting(true);
      // Generate the client reference here (an event), not during render.
      const ref = `CL-${Math.floor(10000 + Math.random() * 89999)}`;
      setTimeout(() => {
        setSubmitting(false);
        setReference(ref);
        setDone(true);
      }, 700);
    }
  }

  function goBack() {
    setErrors({});
    if (idx > 0) setIdx((i) => i - 1);
  }

  // Coarse completion meter for the header — counts the key required fields.
  const progress = useMemo(() => {
    const filled = [
      form.legalName,
      form.contactFirst && form.contactLast,
      form.contactEmail,
      form.sanctionsScreened ? "y" : "",
      form.plan,
    ].filter(Boolean).length;
    return Math.round((filled / 5) * 100);
  }, [form]);

  if (done) {
    return (
      <Success
        form={form}
        reference={reference}
        onRestart={() => {
          setForm(EMPTY);
          setIdx(0);
          setDone(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Onboarding
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
              Client Onboarding
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Draft saved
            </span>
            <button
              type="button"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Save &amp; exit
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-medium tabular-nums text-neutral-500">
            {progress}%
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-7 lg:grid-cols-[180px_minmax(0,1fr)_240px]">
          {/* Stepper rail */}
          <div className="hidden lg:block">
            <div className="sticky top-7">
              <Stepper steps={STEPS} current={idx} onJump={(i) => setIdx(i)} />
            </div>
          </div>

          {/* Step body */}
          <div className="min-w-0">
            {step === "company" && <CompanyStep form={form} set={set} errors={errors} />}
            {step === "contact" && <ContactStep form={form} set={set} errors={errors} />}
            {step === "compliance" && (
              <ComplianceStep form={form} set={set} errors={errors} />
            )}
            {step === "plan" && <PlanStep form={form} set={set} />}
            {step === "review" && <ReviewStep form={form} onEdit={(i) => setIdx(i)} />}
          </div>

          {/* Summary aside */}
          <aside className="hidden lg:block">
            <div className="sticky top-7 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Summary
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <SummaryItem label="Client" value={form.legalName || form.tradingName} />
                <SummaryItem
                  label="Contact"
                  value={
                    form.contactFirst || form.contactLast
                      ? `${form.contactFirst} ${form.contactLast}`.trim()
                      : ""
                  }
                />
                <SummaryItem label="Country" value={countryLabel(form.country)} />
                <SummaryItem
                  label="Plan"
                  value={PLANS.find((p) => p.id === form.plan)?.title ?? ""}
                />
              </dl>
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky footer nav */}
      <footer className="border-t border-neutral-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="text-xs text-neutral-500">
            Step {idx + 1} of {STEPS.length} ·{" "}
            <span className="text-neutral-700">{STEPS[idx].label}</span>
          </div>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                isLast
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-neutral-900 hover:bg-neutral-800"
              }`}
            >
              {submitting
                ? "Submitting…"
                : isLast
                  ? "Submit onboarding"
                  : "Continue"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

type StepProps = {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  errors: Errors;
};

function CompanyStep({ form, set, errors }: StepProps) {
  return (
    <FormCard title="Company details" description="The organisation you're onboarding.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Legal name"
          className="sm:col-span-2"
          placeholder="e.g. Northwind Capital Partners Ltd"
          value={form.legalName}
          error={errors.legalName}
          onChange={(e) => set("legalName", e.target.value)}
          required
        />
        <TextField
          label="Trading name"
          placeholder="If different from legal name"
          value={form.tradingName}
          onChange={(e) => set("tradingName", e.target.value)}
        />
        <TextField
          label="Website"
          placeholder="https://"
          value={form.website}
          error={errors.website}
          onChange={(e) => set("website", e.target.value)}
        />
        <SelectField
          label="Industry"
          value={form.industry}
          onChange={(e) => set("industry", e.target.value)}
        >
          <option value="financial">Financial services</option>
          <option value="tech">Technology</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="retail">Retail</option>
          <option value="other">Other</option>
        </SelectField>
        <SelectField
          label="Company size"
          value={form.size}
          onChange={(e) => set("size", e.target.value)}
        >
          <option value="1-10">1–10</option>
          <option value="11-50">11–50</option>
          <option value="51-200">51–200</option>
          <option value="201-1000">201–1,000</option>
          <option value="1000+">1,000+</option>
        </SelectField>
      </div>
    </FormCard>
  );
}

function ContactStep({ form, set, errors }: StepProps) {
  return (
    <FormCard
      title="Primary contact"
      description="We'll send onboarding updates and the welcome pack here."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          value={form.contactFirst}
          error={errors.contactFirst}
          onChange={(e) => set("contactFirst", e.target.value)}
          required
        />
        <TextField
          label="Last name"
          value={form.contactLast}
          error={errors.contactLast}
          onChange={(e) => set("contactLast", e.target.value)}
          required
        />
        <TextField
          label="Email"
          type="email"
          placeholder="name@company.com"
          value={form.contactEmail}
          error={errors.contactEmail}
          onChange={(e) => set("contactEmail", e.target.value)}
          required
        />
        <TextField
          label="Phone"
          type="tel"
          placeholder="+44 …"
          value={form.contactPhone}
          onChange={(e) => set("contactPhone", e.target.value)}
        />
      </div>
    </FormCard>
  );
}

function ComplianceStep({ form, set, errors }: StepProps) {
  return (
    <FormCard
      title="Compliance & risk"
      description="Required before the account can be activated."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Country of registration"
          value={form.country}
          onChange={(e) => set("country", e.target.value)}
        >
          <option value="GB">United Kingdom</option>
          <option value="US">United States</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="SG">Singapore</option>
        </SelectField>
        <SelectField
          label="Entity type"
          value={form.entityType}
          onChange={(e) => set("entityType", e.target.value)}
        >
          <option value="ltd">Private limited (Ltd)</option>
          <option value="plc">Public limited (PLC)</option>
          <option value="llp">Limited partnership (LLP)</option>
          <option value="fund">Fund</option>
          <option value="sole">Sole trader</option>
        </SelectField>
      </div>
      <div className="mt-5 rounded-lg border border-neutral-200 px-4">
        <Toggle
          label="Sanctions & adverse-media screening complete"
          description="Confirm the client has cleared screening against current watchlists."
          checked={form.sanctionsScreened}
          onChange={(v) => set("sanctionsScreened", v)}
        />
        <div className="border-t border-neutral-100">
          <Toggle
            label="Contains politically exposed persons (PEP)"
            description="Flag for enhanced due diligence if any beneficial owner is a PEP."
            checked={form.pep}
            onChange={(v) => set("pep", v)}
          />
        </div>
      </div>
      {errors.sanctionsScreened && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V6Zm-1 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {errors.sanctionsScreened}
        </p>
      )}
      {form.pep && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Enhanced due diligence will be required. Compliance will be notified on
          submission.
        </div>
      )}
    </FormCard>
  );
}

function PlanStep({
  form,
  set,
}: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
}) {
  return (
    <FormCard title="Plan & billing" description="Pick the service tier and billing cycle.">
      <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2">
        {PLANS.map((p) => (
          <OptionCard
            key={p.id}
            selected={form.plan === p.id}
            onSelect={() => set("plan", p.id)}
            title={p.title}
            description={p.blurb}
            badge={<span className="text-xs font-semibold text-neutral-500">{p.price}</span>}
          />
        ))}
      </div>

      <div className="mt-5">
        <span className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
          Billing cycle
        </span>
        <div className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("billingCycle", c)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                form.billingCycle === c
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {c}
              {c === "annual" && (
                <span className="ml-1.5 text-[10px] font-semibold text-emerald-600">
                  −15%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 max-w-xs">
        <TextField
          label="PO number"
          placeholder="Optional"
          value={form.poNumber}
          onChange={(e) => set("poNumber", e.target.value)}
          hint="Added to invoices if your finance team requires it."
        />
      </div>
    </FormCard>
  );
}

function ReviewStep({ form, onEdit }: { form: Form; onEdit: (idx: number) => void }) {
  const plan = PLANS.find((p) => p.id === form.plan);
  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="Company"
        action={<EditButton onClick={() => onEdit(0)} />}
      >
        <ReviewGrid
          rows={[
            ["Legal name", form.legalName || "—"],
            ["Trading name", form.tradingName || "—"],
            ["Website", form.website || "—"],
            ["Industry", form.industry],
            ["Size", form.size],
          ]}
        />
      </FormCard>
      <FormCard title="Primary contact" action={<EditButton onClick={() => onEdit(1)} />}>
        <ReviewGrid
          rows={[
            ["Name", `${form.contactFirst} ${form.contactLast}`.trim() || "—"],
            ["Email", form.contactEmail || "—"],
            ["Phone", form.contactPhone || "—"],
          ]}
        />
      </FormCard>
      <FormCard title="Compliance" action={<EditButton onClick={() => onEdit(2)} />}>
        <ReviewGrid
          rows={[
            ["Country", countryLabel(form.country)],
            ["Entity type", form.entityType.toUpperCase()],
            ["Screening", form.sanctionsScreened ? "Complete" : "Outstanding"],
            ["PEP", form.pep ? "Yes — EDD required" : "No"],
          ]}
        />
      </FormCard>
      <FormCard title="Plan" action={<EditButton onClick={() => onEdit(3)} />}>
        <ReviewGrid
          rows={[
            ["Tier", `${plan?.title ?? "—"} (${plan?.price ?? ""})`],
            ["Billing", form.billingCycle],
            ["PO number", form.poNumber || "—"],
          ]}
        />
      </FormCard>
      <p className="px-1 text-xs text-neutral-500">
        Submitting creates the client record and notifies the assigned account
        manager. Compliance review starts automatically.
      </p>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-neutral-500 underline hover:text-neutral-900"
    >
      Edit
    </button>
  );
}

function ReviewGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-semibold tracking-widest text-neutral-400 uppercase">
            {k}
          </dt>
          <dd className="mt-0.5 text-sm text-neutral-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
        {label}
      </dt>
      <dd className={`truncate text-right ${value ? "text-neutral-900" : "text-neutral-300"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

const COUNTRIES: Record<string, string> = {
  GB: "United Kingdom",
  US: "United States",
  DE: "Germany",
  FR: "France",
  SG: "Singapore",
};
function countryLabel(code: string) {
  return COUNTRIES[code] ?? code;
}

function Success({
  form,
  reference,
  onRestart,
}: {
  form: Form;
  reference: string;
  onRestart: () => void;
}) {
  const name = form.legalName || form.tradingName || "The client";
  return (
    <div className="flex h-full items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900">
          Onboarding submitted
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          {name} has been created and routed to compliance review. The account
          manager will be notified within the hour.
        </p>
        <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Reference</span>
            <span className="font-mono font-medium text-neutral-900">
              {reference}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-neutral-500">Status</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Compliance review
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Onboard another client
        </button>
      </div>
    </div>
  );
}
