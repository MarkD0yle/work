import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Search } from "lucide-react";

export function Field({ label, helper, error, id, children, hideLabel }: {
  label: string; helper?: string; error?: string; id: string; children: ReactNode; hideLabel?: boolean;
}) {
  return (
    <div className="ea-field">
      <label htmlFor={id} className={hideLabel ? "ea-sr" : "ea-label"}>{label}</label>
      {children}
      {error ? <span id={`${id}-err`} className="ea-error-text" role="alert">{error}</span> : helper ? <span className="ea-help">{helper}</span> : null}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { label: string; helper?: string; error?: string; size?: "default" | "compact"; hideLabel?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, helper, error, size = "default", hideLabel, id, ...rest }, ref) {
  const gen = useId(); const fid = id ?? gen;
  return (
    <Field label={label} helper={helper} error={error} id={fid} hideLabel={hideLabel}>
      <input ref={ref} id={fid} className="ea-input" data-size={size} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : undefined} {...rest} />
    </Field>
  );
});

export function SearchInput({ label = "Search", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { label?: string }) {
  const id = useId();
  return (
    <div className="ea-field">
      <label htmlFor={id} className="ea-sr">{label}</label>
      <div className="ea-input-wrap"><Search size={16} aria-hidden /><input id={id} type="search" className="ea-input" data-size="compact" placeholder={label} {...rest} /></div>
    </div>
  );
}

export type Option = { value: string; label: string };
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { label: string; options: (Option | string)[]; helper?: string; error?: string; size?: "default" | "compact"; hideLabel?: boolean };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, options, helper, error, size = "default", hideLabel, id, ...rest }, ref) {
  const gen = useId(); const fid = id ?? gen;
  return (
    <Field label={label} helper={helper} error={error} id={fid} hideLabel={hideLabel}>
      <select ref={ref} id={fid} className="ea-select" data-size={size} aria-invalid={error ? true : undefined} {...rest}>
        {options.map((o) => { const v = typeof o === "string" ? { value: o, label: o } : o; return <option key={v.value} value={v.value}>{v.label}</option>; })}
      </select>
    </Field>
  );
});

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ea-toggle" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, indeterminate, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; indeterminate?: boolean; disabled?: boolean }) {
  return (
    <input
      type="checkbox" className="ea-check" aria-label={label} checked={checked} disabled={disabled}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked; }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
