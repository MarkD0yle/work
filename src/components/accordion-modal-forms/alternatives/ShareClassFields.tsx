import type { ReactNode } from "react";
import { FieldBlock, RadioPills } from "../kit";
import { inputClass } from "../styles";
import {
  FORM,
  SECTIONS,
  fieldCounts,
  sectionComplete,
  validateInput,
  type Field,
  type SectionKey,
  type ShareClass,
} from "./share-class";

/* Renders one editor section from the FORM config, shared verbatim by every
 * alternative so the comparison is purely about placement. A section is a
 * list of five yes/no question rows — question on the left, Yes / No on the
 * right. Answering Yes reveals four inputs beneath the question, nested
 * under a hairline so the dependency reads at a glance. */

export type FieldsProps = {
  value: ShareClass;
  onChange: (key: string, value: string) => void;
  /** Keeps ids/radio names unique when two editors could coexist. */
  idPrefix: string;
  /** How the revealed inputs lay out: 1 column (narrow panel) or 2 (wide). */
  columns?: 1 | 2;
  /** Per-field footnotes, e.g. what a spreadsheet import found in the cell. */
  notes?: Record<string, ReactNode>;
};

export function SectionFields({ section, value, onChange, idPrefix, columns = 2, notes }: FieldsProps & { section: SectionKey }) {
  return (
    <div className="divide-y divide-neutral-200">
      {FORM[section].map((f) => (
        <div key={f.key} className="py-3 first:pt-0 last:pb-0">
          <FieldView field={f} values={value.values} onChange={onChange} idPrefix={idPrefix} columns={columns} notes={notes} />
        </div>
      ))}
    </div>
  );
}

/* One field (and whatever its chosen answer reveals). Exported so a cell
 * popover can edit a single question with the same rendering as the form. */
export function FieldView({
  field,
  values,
  onChange,
  idPrefix,
  columns,
  nested = false,
  notes,
}: {
  field: Field;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix: string;
  columns: 1 | 2;
  nested?: boolean;
  notes?: Record<string, ReactNode>;
}) {
  const v = values[field.key];
  const id = `${idPrefix}-${field.key}`;
  const note = notes?.[field.key];

  if (field.kind === "input") {
    const error = v ? validateInput(field, v) : undefined;
    return (
      <FieldBlock label={field.label} htmlFor={id} required={field.required} hint={error ? undefined : field.hint}>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type={field.type ?? "text"}
            inputMode={field.numeric ? "decimal" : undefined}
            placeholder={field.placeholder}
            aria-invalid={error ? true : undefined}
            className={`${inputClass} ${field.numeric || field.type ? "tabular-nums" : ""} ${
              error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""
            }`}
            value={v ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
          {field.unit && <span className="shrink-0 text-xs text-neutral-500">{field.unit}</span>}
        </div>
        {error && <p className="mt-1.5 text-[11px] text-red-700">{error}.</p>}
        {note && <p className="mt-1.5 text-[11px] text-red-700">{note}</p>}
      </FieldBlock>
    );
  }

  const revealed = v ? field.reveal?.[v] : undefined;
  return (
    <div className={nested ? "border-l-2 border-neutral-300 pl-3" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1" style={{ minWidth: 160 }}>
          <div className="text-sm text-neutral-800">
            {field.label}
            {field.required && <span className="ml-0.5 text-red-500">*</span>}
          </div>
          {field.hint && <p className="mt-0.5 text-[11px] text-neutral-500">{field.hint}</p>}
        </div>
        <RadioPills
          name={id}
          label={field.label}
          value={v}
          options={field.options}
          onChange={(next) => onChange(field.key, next)}
          size={nested ? "xs" : "sm"}
        />
      </div>
      {note && <p className="mt-1.5 text-[11px] text-red-700">{note}</p>}
      {revealed && (
        <div
          className={`mt-3 grid gap-3 border-l-2 border-neutral-300 pl-3 animate-[drill-in_160ms_ease-out] ${
            columns === 2 ? "sm:grid-cols-2" : ""
          }`}
        >
          {revealed.map((child) => (
            <FieldView key={child.key} field={child} values={values} onChange={onChange} idPrefix={idPrefix} columns={columns} nested notes={notes} />
          ))}
        </div>
      )}
    </div>
  );
}

/* Square completion marker — the kit avoids circles (zero-radius rule). */
export function StatusMark({ complete, label = true }: { complete: boolean; label?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
        complete ? "text-emerald-700" : "text-neutral-500"
      }`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 ${complete ? "bg-emerald-500" : "border border-neutral-400 bg-white"}`}
      />
      {label && (complete ? "Complete" : "Incomplete")}
    </span>
  );
}

/* "5 yes/no · up to 20 inputs" — the honest shape of a section. */
export function FieldTally({ section }: { section: SectionKey }) {
  const c = fieldCounts(FORM[section]);
  return (
    <span className="text-[11px] text-neutral-400 tabular-nums">
      {c.radios} yes/no · up to {c.inputs} inputs
    </span>
  );
}

export function SectionHeading({
  section,
  value,
  size = "sm",
}: {
  section: SectionKey;
  value: ShareClass;
  size?: "sm" | "lg";
}) {
  const meta = SECTIONS.find((s) => s.id === section)!;
  const complete = sectionComplete(value, section);
  if (size === "lg") {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold tracking-tight text-neutral-900">{meta.label}</h4>
          <StatusMark complete={complete} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {meta.blurb} <FieldTally section={section} />
        </p>
      </div>
    );
  }
  return (
    <div className="border-b border-neutral-200 pb-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold tracking-widest text-neutral-800 uppercase">{meta.label}</h4>
        <StatusMark complete={complete} />
      </div>
      <FieldTally section={section} />
    </div>
  );
}
