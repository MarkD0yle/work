import { useMemo, useState } from "react";
import {
  OptionCard,
  PasswordField,
  scorePassword,
  SelectField,
  Stepper,
  TextField,
  type Step,
} from "../components/forms";

export const title = "Sign Up";
export const fullWidth = true;

/* Sign Up — a split-screen account-creation flow. A brand/value panel on the
 * left grounds the form; a three-step wizard on the right collects account →
 * profile → workspace, then lands on a confirmation. Each step validates only
 * its own fields on "Continue", and the horizontal stepper lets users step
 * back to edit. It's a self-contained demo: "Create account" just advances to
 * the done state. */

const STEPS: Step[] = [
  { id: "account", label: "Account" },
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
];

type Plan = "starter" | "team" | "scale";

type Form = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  workspace: string;
  plan: Plan;
  agree: boolean;
};

const EMPTY: Form = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  company: "",
  role: "ops",
  workspace: "",
  plan: "team",
  agree: false,
};

const PLANS: { id: Plan; title: string; price: string; blurb: string }[] = [
  { id: "starter", title: "Starter", price: "Free", blurb: "1 seat · core dashboards" },
  { id: "team", title: "Team", price: "£24/seat", blurb: "Up to 10 seats · alerts & queues" },
  { id: "scale", title: "Scale", price: "Custom", blurb: "SSO, audit log, priority support" },
];

type Errors = Partial<Record<keyof Form, string>>;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateStep(idx: number): Errors {
    const e: Errors = {};
    if (idx === 0) {
      if (!emailRe.test(form.email)) e.email = "Enter a valid email address.";
      if (scorePassword(form.password).score < 2)
        e.password = "Choose a stronger password.";
    }
    if (idx === 1) {
      if (!form.firstName.trim()) e.firstName = "Required.";
      if (!form.lastName.trim()) e.lastName = "Required.";
      if (!form.company.trim()) e.company = "Required.";
    }
    if (idx === 2) {
      if (!form.workspace.trim()) e.workspace = "Pick a workspace name.";
      if (!form.agree) e.agree = "You must accept the terms to continue.";
    }
    return e;
  }

  function next() {
    const e = validateStep(stepIdx);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        setDone(true);
      }, 700);
    }
  }

  const workspaceSlug = useMemo(
    () =>
      form.workspace
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    [form.workspace],
  );

  return (
    <div className="grid h-full bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand / value panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-900 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.25), transparent 45%)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-neutral-900">
            M
          </span>
          <span className="text-sm font-semibold tracking-tight">Meridian Ops</span>
        </div>
        <div className="relative">
          <h2 className="text-2xl font-semibold tracking-tight">
            One control room for every exception.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-neutral-300">
            Set up your workspace in under two minutes. Invite your team, wire
            up your queues, and never miss a break again.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "Real-time exception monitoring",
              "Shared queues with SLA tracking",
              "Audit-ready sign-off trail",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-neutral-400">
          “We cut our break-resolution time in half.” — Priya N., Head of Ops
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex items-center justify-center overflow-y-auto p-6 sm:p-10">
        <div className="w-full max-w-md">
          {done ? (
            <SuccessState
              workspace={form.workspace}
              slug={workspaceSlug}
              email={form.email}
              onRestart={() => {
                setForm(EMPTY);
                setErrors({});
                setStepIdx(0);
                setDone(false);
              }}
            />
          ) : (
            <>
              <div className="mb-1 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                Step {stepIdx + 1} of {STEPS.length}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                {stepIdx === 0 && "Create your account"}
                {stepIdx === 1 && "Tell us about you"}
                {stepIdx === 2 && "Name your workspace"}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {stepIdx === 0 && "Start with your work email and a password."}
                {stepIdx === 1 && "This personalises your workspace and invites."}
                {stepIdx === 2 && "You can rename it later in settings."}
              </p>

              <div className="mt-6">
                <Stepper
                  steps={STEPS}
                  current={stepIdx}
                  orientation="horizontal"
                  onJump={(i) => setStepIdx(i)}
                />
              </div>

              <form
                className="mt-7 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
              >
                {stepIdx === 0 && (
                  <>
                    <TextField
                      label="Work email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      value={form.email}
                      error={errors.email}
                      onChange={(e) => set("email", e.target.value)}
                      required
                    />
                    <PasswordField
                      value={form.password}
                      onChange={(v) => set("password", v)}
                      error={errors.password}
                      required
                    />
                  </>
                )}

                {stepIdx === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="First name"
                        autoComplete="given-name"
                        value={form.firstName}
                        error={errors.firstName}
                        onChange={(e) => set("firstName", e.target.value)}
                        required
                      />
                      <TextField
                        label="Last name"
                        autoComplete="family-name"
                        value={form.lastName}
                        error={errors.lastName}
                        onChange={(e) => set("lastName", e.target.value)}
                        required
                      />
                    </div>
                    <TextField
                      label="Company"
                      autoComplete="organization"
                      value={form.company}
                      error={errors.company}
                      onChange={(e) => set("company", e.target.value)}
                      required
                    />
                    <SelectField
                      label="Your role"
                      value={form.role}
                      onChange={(e) => set("role", e.target.value)}
                    >
                      <option value="ops">Operations</option>
                      <option value="risk">Risk</option>
                      <option value="trading">Trading</option>
                      <option value="tech">Technology</option>
                      <option value="other">Other</option>
                    </SelectField>
                  </>
                )}

                {stepIdx === 2 && (
                  <>
                    <TextField
                      label="Workspace name"
                      placeholder="e.g. Meridian Ops"
                      value={form.workspace}
                      error={errors.workspace}
                      onChange={(e) => set("workspace", e.target.value)}
                      hint={
                        workspaceSlug
                          ? `meridian.app/${workspaceSlug}`
                          : "Used in your workspace URL."
                      }
                      required
                    />
                    <div role="radiogroup" aria-label="Plan" className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">
                        Choose a plan
                      </span>
                      {PLANS.map((p) => (
                        <OptionCard
                          key={p.id}
                          selected={form.plan === p.id}
                          onSelect={() => set("plan", p.id)}
                          title={p.title}
                          description={p.blurb}
                          badge={
                            <span className="text-xs font-semibold text-neutral-500">
                              {p.price}
                            </span>
                          }
                        />
                      ))}
                    </div>
                    <label className="flex items-start gap-2.5 text-sm text-neutral-600">
                      <input
                        type="checkbox"
                        checked={form.agree}
                        onChange={(e) => set("agree", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
                      />
                      <span>
                        I agree to the{" "}
                        <span className="font-medium text-neutral-900 underline">
                          Terms
                        </span>{" "}
                        and{" "}
                        <span className="font-medium text-neutral-900 underline">
                          Privacy Policy
                        </span>
                        .
                      </span>
                    </label>
                    {errors.agree && (
                      <p className="-mt-2 text-[11px] font-medium text-red-600">
                        {errors.agree}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-2 flex items-center gap-3">
                  {stepIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => setStepIdx((i) => i - 1)}
                      className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {submitting
                      ? "Creating account…"
                      : stepIdx === STEPS.length - 1
                        ? "Create account"
                        : "Continue"}
                  </button>
                </div>
              </form>

              {stepIdx === 0 && (
                <p className="mt-6 text-center text-sm text-neutral-500">
                  Already have an account?{" "}
                  <span className="font-medium text-neutral-900 underline">Sign in</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessState({
  workspace,
  slug,
  email,
  onRestart,
}: {
  workspace: string;
  slug: string;
  email: string;
  onRestart: () => void;
}) {
  return (
    <div className="text-center">
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
        Workspace ready
      </h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        {workspace || "Your workspace"} is set up. We've sent a verification
        link to <span className="font-medium text-neutral-700">{email}</span>.
      </p>
      <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Your workspace URL
        </div>
        <div className="mt-1 font-mono text-sm text-neutral-900">
          meridian.app/{slug || "workspace"}
        </div>
      </div>
      <button
        type="button"
        className="mt-5 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Go to dashboard
      </button>
      <button
        type="button"
        onClick={onRestart}
        className="mt-3 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        Start over
      </button>
    </div>
  );
}
