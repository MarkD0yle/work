import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { controlClass } from "./styles";

/* Field — the shared form-control kit used across the form/flow pages.
 *
 * One <Field> owns the label, optional hint, required marker, and the error
 * slot for a single control. Controls (TextInput, Select, Textarea) read the
 * error/labelling context purely through props so they stay dumb and reusable.
 * Tokens match the rest of the app: uppercase tracking-widest labels, neutral
 * surfaces, a soft focus ring, and a red border + message on error. */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[11px] font-semibold tracking-widest text-neutral-600 uppercase"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V6Zm-1 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

/* A label + control pair that auto-wires `id`/`htmlFor` and `aria-invalid`.
 * Use this for the common case; drop to <Field> + a raw control when you need
 * a non-standard control (toggle, option grid, …). */
export function TextField({
  label,
  hint,
  error,
  required,
  className,
  prefix,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      {prefix ? (
        <div
          className={`flex items-center rounded-md border bg-white transition focus-within:ring-2 ${
            error
              ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15"
              : "border-neutral-300 focus-within:border-neutral-500 focus-within:ring-neutral-900/10"
          }`}
        >
          <span className="pl-2.5 text-sm text-neutral-400 select-none">{prefix}</span>
          <input
            id={id}
            aria-invalid={error ? true : undefined}
            className="block w-full rounded-md bg-transparent py-2 pr-2.5 pl-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            {...input}
          />
        </div>
      ) : (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          {...input}
          className={controlClass(Boolean(error))}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...select
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className={`${controlClass(Boolean(error), "appearance-none pr-9")}`}
          {...select}
        >
          {children}
        </select>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </Field>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  required,
  className,
  ...textarea
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={className}
    >
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={controlClass(Boolean(error), "min-h-[88px] resize-y leading-relaxed")}
        {...textarea}
      />
    </Field>
  );
}
