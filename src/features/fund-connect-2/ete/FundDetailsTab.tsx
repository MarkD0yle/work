import { useEte } from "./ete-context";
import { activePeriods, countBySeverity, directionLabel, issuesAt, path } from "./engine";
import { DETAIL_FIELDS, DETAIL_SECTIONS, periodLabel } from "./model";
import { btn, cx, eyebrow, muted } from "./styles";
import { Badge, Collapsible, IssueCounts, SelectField, TextField } from "./ui";

/* Fund Details — the fund-level fields, grouped into collapsible sections.
 *
 * These sit behind Order Types on purpose: they are set once and rarely
 * change. The strip at the top opens an Order Type from here; because edits
 * live in the draft, nothing typed on this tab is lost by doing so. */

export function FundDetailsTab() {
  const { fund, view, config, editable, issues, update, openSections, toggleSection, openOrderType } = useEte();
  const active = view === "pending" ? fund.active : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <section className="border border-neutral-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={eyebrow}>Order Types on this fund</h2>
          <span className={muted}>Opening one keeps everything you have changed here.</span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {config.orderTypes.map((o) => {
            const act = activePeriods(o);
            return (
              <li key={o.id}>
                <button type="button" onClick={() => openOrderType(o.id)} className={cx(btn.secondary, "flex-col items-start gap-0.5 text-left")}>
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-neutral-900">{o.name || "Unnamed Order Type"}</span>
                    <Badge tone={o.enabled ? "good" : "neutral"}>{o.enabled ? "Enabled" : "Disabled"}</Badge>
                  </span>
                  <span className="text-[11px] font-normal text-neutral-500">
                    {directionLabel(o)} · {act.length ? act.map((p) => periodLabel(p.day)).join(", ") : "No active periods"}
                  </span>
                </button>
              </li>
            );
          })}
          {config.orderTypes.length === 0 && <li className={muted}>None yet. Add one on the Order Types tab.</li>}
        </ul>
      </section>

      <div className="mt-4 flex flex-col gap-3">
        {DETAIL_SECTIONS.map((s) => {
          const fields = DETAIL_FIELDS.filter((f) => f.section === s.id);
          const sectionIssues = fields.flatMap((f) => issuesAt(issues, path.detail(f.key)));
          const counts = countBySeverity(sectionIssues);
          const changed = active ? fields.filter((f) => active.details[f.key] !== config.details[f.key]).length : 0;
          return (
            <Collapsible
              key={s.id}
              title={s.label}
              blurb={s.blurb}
              open={openSections.includes(s.id)}
              onToggle={() => toggleSection(s.id)}
              trailing={
                <>
                  <IssueCounts {...counts} />
                  {changed > 0 && <Badge tone="warn">{changed} changed</Badge>}
                  <span className="text-[11px] text-neutral-500">{fields.length} fields</span>
                </>
              }
            >
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                {fields.map((f) => {
                  const value = config.details[f.key];
                  const was = active && active.details[f.key] !== value ? active.details[f.key] : undefined;
                  const common = {
                    label: f.label,
                    value,
                    hint: f.hint,
                    was,
                    disabled: !editable,
                    issues: issuesAt(issues, path.detail(f.key)),
                    onChange: (v: string) => update((d) => void (d.details[f.key] = v)),
                  };
                  return f.options ? <SelectField key={f.key} {...common} options={f.options} /> : <TextField key={f.key} {...common} mono={f.mono} inputMode={f.inputMode} />;
                })}
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
