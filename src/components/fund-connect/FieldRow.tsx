import { useState } from "react";
import LookupInput from "./LookupInput";
import SourceBadge from "./SourceBadge";
import { lookupMaster } from "../../lib/fundConnect/reference";
import type { Derived, FieldDef, Issue } from "../../lib/fundConnect/schema";
import { toneFor } from "../../lib/fundConnect/tone";
import type { FieldFlag, FieldSource } from "../../lib/fundConnect/types";

/* One field. Pure presentation, driven entirely by props — the state
 * machine, the audit log and the reference lookups all live behind this
 * boundary (design-system handoff note in the spec).
 *
 * Everything a person needs to judge the value sits on the field itself:
 * where it came from, what it resolved to, what it implies (the derived
 * notional), and any note a reviewer attached to it. */

export type FieldRowProps = {
  field: FieldDef;
  value: string;
  source: FieldSource | null;
  issue: Issue | null;
  missing: boolean;
  flag: FieldFlag | null;
  derived: Derived | null;
  readOnly: boolean;
  /** Reviewer is in review mode and may reject this field. Spec §5. */
  canFlag: boolean;
  flagAuthor?: string;
  onChange: (value: string) => void;
  onFlag: (note: string) => void;
  onClearFlag: () => void;
};

export default function FieldRow({
  field,
  value,
  source,
  issue,
  missing,
  flag,
  derived,
  readOnly,
  canFlag,
  flagAuthor,
  onChange,
  onFlag,
  onClearFlag,
}: FieldRowProps) {
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState("");

  const invalid = issue?.level === "error";
  const resolved =
    field.kind === "lookup" && field.master && value
      ? lookupMaster(field.master, value)
      : null;

  const control = `w-full rounded-md border px-2.5 py-1.5 text-sm text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-500 ${
    invalid ? "border-red-400 bg-red-50/40" : "border-neutral-300 bg-white"
  }`;

  return (
    <div
      className={`grid grid-cols-1 gap-x-6 gap-y-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)] ${
        flag ? "bg-amber-50/40" : ""
      }`}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-neutral-800" htmlFor={field.id}>
          {field.label}
          {field.requirement !== "optional" && (
            <span className="ml-1 text-neutral-400" aria-hidden>
              *
            </span>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={value.trim() === "" ? null : source} />
          {missing && (
            <span className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
              Required to submit
            </span>
          )}
        </div>
        {field.help && (
          <p className="text-[11px] leading-snug text-neutral-400">{field.help}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {field.kind === "lookup" && field.master ? (
              <LookupInput
                master={field.master}
                value={value}
                disabled={readOnly}
                invalid={invalid}
                onChange={onChange}
              />
            ) : field.kind === "select" ? (
              <select
                id={field.id}
                value={value}
                disabled={readOnly}
                onChange={(e) => onChange(e.target.value)}
                className={control}
              >
                <option value="">— select —</option>
                {(field.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.kind === "toggle" ? (
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  id={field.id}
                  type="checkbox"
                  disabled={readOnly}
                  checked={value === "Confirmed"}
                  onChange={(e) => onChange(e.target.checked ? "Confirmed" : "Not confirmed")}
                  className="h-4 w-4 accent-neutral-900"
                />
                {value === "Confirmed" ? "Confirmed" : "Not confirmed"}
              </label>
            ) : (
              <input
                id={field.id}
                type={field.kind === "date" ? "date" : "text"}
                inputMode={field.kind === "number" ? "decimal" : undefined}
                value={value}
                disabled={readOnly}
                onChange={(e) => onChange(e.target.value)}
                className={`${control} ${field.kind === "number" ? "font-mono tabular-nums" : ""}`}
              />
            )}
          </div>
          {field.unit && (
            <span className="shrink-0 text-xs text-neutral-400">{field.unit}</span>
          )}
          {canFlag && !flag && (
            <button
              type="button"
              onClick={() => setDrafting((d) => !d)}
              className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-amber-400 hover:text-amber-800"
            >
              Reject field
            </button>
          )}
        </div>

        {resolved && (
          <p className="text-xs text-neutral-600">
            <span className="font-medium text-neutral-800">{resolved.name}</span>
            {resolved.detail && <span className="text-neutral-400"> · {resolved.detail}</span>}
          </p>
        )}

        {derived && (
          <p
            className={`rounded-md border px-2 py-1 text-xs ${
              derived.level === "warning"
                ? `${toneFor("warning").bg} ${toneFor("warning").border} ${toneFor("warning").text}`
                : "border-neutral-200 bg-neutral-50 text-neutral-600"
            }`}
          >
            <span className="font-medium">{derived.label}:</span> {derived.value}
          </p>
        )}

        {issue && (
          <p
            className={`text-xs ${issue.level === "error" ? "text-red-700" : "text-amber-800"}`}
            role={issue.level === "error" ? "alert" : undefined}
          >
            {issue.message}
          </p>
        )}

        {drafting && !flag && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What is wrong with this value, and what would make it right?"
              className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs text-neutral-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={note.trim() === ""}
                onClick={() => {
                  onFlag(note.trim());
                  setNote("");
                  setDrafting(false);
                }}
                className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:bg-neutral-300"
              >
                Attach to field
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrafting(false);
                  setNote("");
                }}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {flag && (
          <div className="flex items-start justify-between gap-3 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-2">
            <p className="text-xs leading-snug text-amber-900">
              <span className="font-semibold">Rejected by {flagAuthor ?? flag.by}:</span>{" "}
              {flag.note}
              {!readOnly && (
                <span className="mt-1 block text-[11px] text-amber-700">
                  Changing the value clears this flag.
                </span>
              )}
            </p>
            {canFlag && (
              <button
                type="button"
                onClick={onClearFlag}
                className="shrink-0 rounded-md border border-amber-400 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
              >
                Withdraw
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
