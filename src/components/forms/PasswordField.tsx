import { useId, useState } from "react";
import { Field } from "./Field";
import { controlBase, controlTone } from "./styles";
import { scorePassword } from "../../lib/password-strength";

const BAR_TONE =["bg-neutral-200", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];
const LABEL_TONE = ["text-neutral-400", "text-red-600", "text-amber-600", "text-lime-600", "text-emerald-600"];

export function PasswordField({
  label = "Password",
  value,
  onChange,
  error,
  required,
  showStrength = true,
  placeholder = "Create a password",
  autoComplete = "new-password",
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  required?: boolean;
  showStrength?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const strength = scorePassword(value);

  return (
    <Field label={label} error={error} required={required} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={`${controlBase} pr-10 ${
            error ? controlTone.error : controlTone.default
          }`}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          {reveal ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.03 10.03 0 0 0 3.3-4.38 1.65 1.65 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.512 1.074L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" />
              <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path
                fillRule="evenodd"
                d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {showStrength && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 gap-1">
              {[1, 2, 3, 4].map((seg) => (
                <span
                  key={seg}
                  className={`h-full flex-1 rounded-full transition-colors ${
                    strength.score >= seg ? BAR_TONE[strength.score] : "bg-neutral-200"
                  }`}
                />
              ))}
            </div>
            <span
              className={`w-12 text-right text-[11px] font-semibold ${LABEL_TONE[strength.score]}`}
            >
              {strength.label || "—"}
            </span>
          </div>
          {value.length > 0 && strength.score < 4 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {strength.checks
                .filter((c) => !c.met)
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-1 text-[11px] text-neutral-500"
                  >
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-300" />
                    {c.label}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}
