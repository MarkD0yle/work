/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import { useId, useState } from "react";
import { PRESETS, daysBetween, rangeFor, type DateRangeValue, type RangePreset } from "../lib/dates";
import { formatDate } from "../lib/format";
import { usePersisted } from "../lib/persist";
import { Button } from "../ui";

/** The only date-range control in the codebase. Format: MMM DD, YYYY. */
export function DateRange({ value, onChange, heavy, maxDays = 366, label = "Date range" }: {
  value: DateRangeValue; onChange: (v: DateRangeValue) => void; heavy?: boolean; maxDays?: number; label?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setDraft(value); }
  const custom = draft.preset === "Custom";

  const error = draft.end < draft.start ? "End date must be on or after the start date" : daysBetween(draft.start, draft.end) > maxDays ? `Range cannot exceed ${maxDays} days` : "";
  const push = (v: DateRangeValue) => {
    setDraft(v);
    const bad = v.end < v.start || daysBetween(v.start, v.end) > maxDays;
    if (!heavy && !bad) onChange(v);
  };
  const setPreset = (p: RangePreset) => push(p === "Custom" ? { ...draft, preset: "Custom" } : rangeFor(p));
  const dirty = draft.start !== value.start || draft.end !== value.end;

  return (
    <div className="ea-daterange" role="group" aria-label={label} style={{ position: "relative" }}>
      <select className="ea-select" data-size="compact" aria-label={`${label} preset`} value={draft.preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
        {PRESETS.map((p) => <option key={p}>{p}</option>)}
      </select>
      {(["start", "end"] as const).map((k) =>
        custom ? (
          <input key={k} id={`${id}-${k}`} type="date" className="ea-input" data-size="compact" aria-label={k === "start" ? "Start date" : "End date"} aria-invalid={error ? true : undefined}
            value={draft[k]} onChange={(e) => e.target.value && push({ ...draft, [k]: e.target.value })} />
        ) : (
          <input key={k} className="ea-input" data-size="compact" readOnly tabIndex={-1} aria-label={k === "start" ? "Start date" : "End date"} value={formatDate(draft[k])} style={{ background: "var(--color-bg)" }} />
        ),
      )}
      {heavy && <Button variant="primary" size="compact" disabled={!dirty || !!error} onClick={() => onChange(draft)}>Apply</Button>}
      {error && <span className="ea-error-text" role="alert" style={{ position: "absolute", top: "100%", left: 0, whiteSpace: "nowrap", background: "var(--color-surface)", zIndex: 5 }}>{error}</span>}
    </div>
  );
}

/** Persisted last-used range (one key per page). */
export function useDateRange(pageKey: string, defaultPreset: RangePreset = "Last 3 Months") {
  return usePersisted<DateRangeValue>(`range.${pageKey}`, rangeFor(defaultPreset));
}
