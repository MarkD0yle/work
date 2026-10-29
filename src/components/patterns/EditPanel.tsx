import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Banner } from "./Banner";
import ContextPanel from "./ContextPanel";
import { button, cx, focus, radius, text } from "./tokens";

/* EditPanel — change a record without leaving the list.
 *
 * ContextPanel with a form inside and a pinned Save / Discard footer. The
 * footer says whether anything changed; Save stays disabled until it has.
 * Closing with unsaved edits asks inline ("Keep editing" / "Discard"), not in
 * a modal, so the user never leaves the panel to decide. A failed save shows
 * the reason at the top and keeps the edits. Mark each changed field with
 * `changed` so the user can see what Save will write.
 *
 * Enter in a field submits. Fields below (PanelInput, PanelSelect) wire their
 * label, hint and error to the control, so screens don't hand-build that. */

export function EditPanel({
  title,
  eyebrow,
  dirty,
  saving = false,
  error,
  onSave,
  onDiscard,
  onClose,
  saveLabel = "Save changes",
  children,
}: {
  title: string;
  eyebrow?: string;
  dirty: boolean;
  saving?: boolean;
  /** Why the last save failed. Edits are kept. */
  error?: string;
  onSave: () => void;
  /** Reset the form to the saved values. */
  onDiscard: () => void;
  onClose: () => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  const formId = useId();
  const [confirmClose, setConfirmClose] = useState(false);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (dirty && !saving) onSave();
  }

  return (
    <ContextPanel
      title={title}
      eyebrow={eyebrow}
      onClose={requestClose}
      footer={
        <div className="flex items-center gap-3">
          <span className={cx("flex flex-1 items-center gap-1.5", text.muted)} aria-live="polite">
            <span aria-hidden className={cx("h-2 w-2", radius.pill, dirty ? "bg-amber-400" : "bg-neutral-300")} />
            {saving ? "Saving…" : dirty ? "Unsaved changes" : "No changes"}
          </span>
          <button type="button" onClick={onDiscard} disabled={!dirty || saving} className={button.secondary}>
            Discard
          </button>
          <button type="submit" form={formId} disabled={!dirty || saving} className={button.primary}>
            {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      }
    >
      {confirmClose && (
        <div className="border-b border-neutral-200 p-3">
          <Banner tone="warning" title="Discard your changes?">
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setConfirmClose(false)} className={button.secondary}>
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  onDiscard();
                  onClose();
                }}
                className={button.primary}
              >
                Discard and close
              </button>
            </div>
          </Banner>
        </div>
      )}
      {error && (
        <div className="border-b border-neutral-200 p-3">
          <Banner tone="negative" title="Not saved">
            {error}
          </Banner>
        </div>
      )}
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-4">
        {children}
      </form>
    </ContextPanel>
  );
}

const CONTROL = cx(
  "w-full border bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500",
  radius.control,
  focus,
);

function FieldShell({
  id,
  label,
  hint,
  error,
  changed,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  changed?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={cx("flex items-center gap-1.5", text.label)}>
        {label}
        {changed && <span className="bg-amber-100 px-1 text-[10px] font-semibold text-amber-900 uppercase">Edited</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <p id={`${id}-note`} className={cx("mt-1", text.muted)}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-note`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PanelInput({
  label,
  value,
  onChange,
  hint,
  error,
  changed,
  mono,
  inputMode,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  changed?: boolean;
  mono?: boolean;
  inputMode?: "text" | "numeric" | "decimal";
  onFocus?: () => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} changed={changed}>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-note` : undefined}
        className={cx(CONTROL, error ? "border-red-400" : "border-neutral-300", mono && "font-mono tabular-nums")}
      />
    </FieldShell>
  );
}

export function PanelSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  changed,
  onFocus,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
  changed?: boolean;
  onFocus?: () => void;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} changed={changed}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        onFocus={onFocus}
        aria-describedby={hint ? `${id}-note` : undefined}
        className={cx(CONTROL, "border-neutral-300")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
