/* eslint-disable react-refresh/only-export-components -- hooks/contexts live beside their components; HMR granularity is not a concern here */
import { Button } from "../ui";

export type FilterDef = { id: string; label: string; options: string[] };

/** Labelled dropdowns, label above value. Default "All". Active = bold value + accent dot. */
export function FilterBar({ filters, values, onChange, onClear }: {
  filters: FilterDef[]; values: Record<string, string>; onChange: (id: string, v: string) => void; onClear: () => void;
}) {
  const active = filters.filter((f) => (values[f.id] ?? "All") !== "All").length;
  return (
    <div className="ea-filterbar" role="group" aria-label="Filters">
      {filters.map((f) => {
        const on = (values[f.id] ?? "All") !== "All";
        return (
          <div key={f.id} className="ea-filter" data-active={on || undefined}>
            <label className="ea-label" htmlFor={`ea-f-${f.id}`}>{on && <span aria-hidden style={{ display: "inline-block", width: 6, height: 6, background: "var(--color-accent)", marginRight: 4 }} />}{f.label}</label>
            <select id={`ea-f-${f.id}`} className="ea-select" data-size="compact" value={values[f.id] ?? "All"} onChange={(e) => onChange(f.id, e.target.value)}>
              {["All", ...f.options].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        );
      })}
      {active > 0 && <Button variant="tertiary" size="compact" onClick={onClear}>Clear all</Button>}
    </div>
  );
}
export const activeFilterCount = (values: Record<string, string>) => Object.values(values).filter((v) => v && v !== "All").length;
