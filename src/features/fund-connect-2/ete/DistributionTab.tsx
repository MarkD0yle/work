import { useState } from "react";
import { useEte } from "./ete-context";
import { issuesAt, path } from "./engine";
import { COUNTRIES, INSTITUTIONS } from "./model";
import { control, cx, eyebrow, focusRing, label, muted } from "./styles";
import { Check, Messages, Switch, TextField } from "./ui";

/* Fund Distribution — where the fund is offered and to whom. */

export function DistributionTab() {
  const { config, editable, issues, update } = useEte();
  const dist = config.distribution;
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = INSTITUTIONS.filter((i) => !q || `${i.name} ${i.country} ${i.kind}`.toLowerCase().includes(q));
  const chosen = INSTITUTIONS.filter((i) => dist.institutions.includes(i.id));

  const toggle = (list: string[], item: string, on: boolean) => (on ? [...list, item] : list.filter((x) => x !== item));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Countries</h2>
          <p className={muted}>Where the fund is distributed. {dist.countries.length} selected.</p>
          <Messages issues={issuesAt(issues, path.countries)} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {COUNTRIES.map((c) => (
              <Check key={c} label={c} checked={dist.countries.includes(c)} disabled={!editable} onChange={(on) => update((d) => void (d.distribution.countries = toggle(d.distribution.countries, c, on)))} />
            ))}
          </div>
        </section>

        <section className="border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Co-brand</h2>
          <p className={muted}>Show a partner's name next to the issuer on order screens and confirmations.</p>
          <div className="mt-3">
            <Switch checked={dist.cobrand} disabled={!editable} label="Co-branding" onText="Co-branded" offText="Not co-branded" onChange={(v) => update((d) => void (d.distribution.cobrand = v))} />
          </div>
          {dist.cobrand && (
            <div className="mt-3 max-w-sm">
              <TextField
                label="Co-brand name"
                value={dist.cobrandName}
                disabled={!editable}
                placeholder="e.g. Meridian x Aldgate"
                issues={issuesAt(issues, path.cobrandName)}
                onChange={(v) => update((d) => void (d.distribution.cobrandName = v))}
              />
            </div>
          )}
        </section>

        <section className="border border-neutral-200 bg-white p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-neutral-900">Institutions</h2>
          <p className={muted}>Who can see and trade the fund.</p>
          <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-2" disabled={!editable}>
            <legend className="sr-only">Available to</legend>
            {(
              [
                ["all", "All institutions", "Every institution in the chosen countries."],
                ["selected", "Selected institutions", "Only the institutions you pick below."],
              ] as const
            ).map(([value, text, hint]) => (
              <label key={value} className="flex items-start gap-2 text-xs text-neutral-800">
                <input type="radio" name="ete-institution-mode" checked={dist.institutionMode === value} onChange={() => update((d) => void (d.distribution.institutionMode = value))} className="mt-0.5 h-3.5 w-3.5" />
                <span>
                  {text}
                  <span className="block text-[11px] text-neutral-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {dist.institutionMode === "selected" && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0">
                <label htmlFor="ete-institution-search" className={label}>
                  Find an institution
                </label>
                <input
                  id="ete-institution-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, country or type"
                  className={cx("mt-1 border-neutral-300", control)}
                />
                <Messages issues={issuesAt(issues, path.institutions)} />
                <ul className="mt-2 max-h-64 overflow-y-auto border border-neutral-200">
                  {matches.map((i) => {
                    const on = dist.institutions.includes(i.id);
                    return (
                      <li key={i.id} className="border-b border-neutral-100 last:border-b-0">
                        <label className={cx("flex items-center gap-2 px-3 py-1.5 text-xs", editable && "hover:bg-neutral-50", on ? "text-neutral-900" : "text-neutral-700")}>
                          <input type="checkbox" checked={on} disabled={!editable} onChange={(e) => update((d) => void (d.distribution.institutions = toggle(d.distribution.institutions, i.id, e.target.checked)))} className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                          <span className="shrink-0 text-[11px] text-neutral-500">
                            {i.kind} · {i.country}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                  {matches.length === 0 && <li className={cx("px-3 py-4 text-center", muted)}>No institution matches "{query}".</li>}
                </ul>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Showing {matches.length} of {INSTITUTIONS.length}.
                </p>
              </div>

              <div className="min-w-0">
                <h3 className={eyebrow}>Selected ({chosen.length})</h3>
                {chosen.length === 0 ? (
                  <p className={cx("mt-2", muted)}>None selected yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {chosen.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 border border-neutral-200 px-2 py-1 text-xs text-neutral-800">
                        <span className="min-w-0 truncate">{i.name}</span>
                        {editable && (
                          <button
                            type="button"
                            aria-label={`Remove ${i.name}`}
                            onClick={() => update((d) => void (d.distribution.institutions = d.distribution.institutions.filter((x) => x !== i.id)))}
                            className={cx("shrink-0 px-1 text-neutral-500 hover:text-neutral-900", focusRing)}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
