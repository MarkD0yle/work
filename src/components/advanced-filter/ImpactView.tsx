import { useMemo } from "react";
import { cx } from "../patterns/tokens";
import { ICON } from "./icons";
import { TRANSACTIONS, activeConditions, isComplete, nodeLabel, testNode, type Condition, type FilterNode, type Group } from "./model";
import { Icon } from "./ui";

/* Impact: what each part of the filter does to the rows.
 *
 * The top-level parts are applied one after another. With ALL (AND) each
 * step narrows the rows; with ANY (OR) each step adds to them. Order never
 * changes the result, but walking it this way shows which part is doing the
 * work, which does nothing, and which empties the grid. */

interface Step {
  node: FilterNode;
  label: string;
  alone: number;
  after: number;
  delta: number;
}

interface Flag {
  tone: "rose" | "amber" | "neutral";
  text: string;
}

function allConditions(n: FilterNode): Condition[] {
  return n.kind === "condition" ? [n] : n.children.flatMap(allConditions);
}

export function ImpactView({ root }: { root: Group }) {
  const total = TRANSACTIONS.length;

  const { steps, final, flags } = useMemo(() => {
    const live = root.children.filter((c) => activeConditions(c).length > 0);
    const steps: Step[] = [];
    let running = root.join === "AND" ? TRANSACTIONS : [];
    for (const node of live) {
      const pass = TRANSACTIONS.filter((r) => testNode(node, r));
      const before = running.length;
      if (root.join === "AND") {
        const keep = new Set(pass);
        running = running.filter((r) => keep.has(r));
      } else {
        const have = new Set(running);
        running = [...running, ...pass.filter((r) => !have.has(r))];
      }
      steps.push({ node, label: nodeLabel(node), alone: pass.length, after: running.length, delta: running.length - before });
    }
    const final = TRANSACTIONS.filter((r) => testNode(root, r)).length;

    const flags: Flag[] = [];
    steps.forEach((s, i) => {
      if (s.alone === 0) flags.push({ tone: "rose", text: `“${s.label}” matches nothing on its own.` });
      else if (i > 0 && s.delta === 0)
        flags.push({
          tone: "amber",
          text: root.join === "AND" ? `“${s.label}” removes nothing: the steps above already cover it.` : `“${s.label}” adds nothing: its rows are already included.`,
        });
    });
    if (root.join === "AND" && steps.length > 1 && final === 0 && !root.not) {
      const killer = steps.find((s) => s.after === 0);
      if (killer && killer.alone > 0) flags.push({ tone: "rose", text: `No rows survive. “${killer.label}” rules out everything left by the steps before it.` });
    }
    const all = allConditions(root);
    const off = all.filter((c) => !c.enabled).length;
    const incomplete = all.filter((c) => c.enabled && !isComplete(c)).length;
    if (off) flags.push({ tone: "neutral", text: `${off} condition${off === 1 ? " is" : "s are"} switched off and ignored.` });
    if (incomplete) flags.push({ tone: "amber", text: `${incomplete} condition${incomplete === 1 ? " needs" : "s need"} a value and ${incomplete === 1 ? "is" : "are"} ignored until it has one.` });
    return { steps, final, flags };
  }, [root]);

  if (steps.length === 0) return <p className="text-xs text-neutral-500">No active conditions, so all {total} transactions show.</p>;

  const bar = (n: number, tone: string) => (
    <div className="h-1.5 w-full bg-neutral-100">
      <div className={cx("h-full", tone)} style={{ width: `${(n / total) * 100}%` }} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-neutral-500">
        {root.join === "AND" ? "Each step narrows the rows (ALL)." : "Each step adds rows (ANY)."} Order doesn’t change the result; it shows what each part does.
      </p>

      <ol className="flex flex-col">
        <li className="flex items-center gap-3 py-1.5">
          <span className="w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-neutral-500">{root.join === "AND" ? "All transactions" : "Start with none"}</div>
            {bar(root.join === "AND" ? total : 0, "bg-neutral-300")}
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-neutral-900 tabular-nums">{root.join === "AND" ? total : 0}</span>
        </li>
        {steps.map((s, i) => (
          <li key={s.node.id} className="flex items-center gap-3 border-t border-neutral-100 py-1.5">
            <span className="w-4 shrink-0 text-center font-mono text-[10px] text-neutral-400">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                {i > 0 && <span className={cx("text-[9px] font-bold tracking-wider", root.join === "AND" ? "text-sky-700" : "text-violet-700")}>{root.join}</span>}
                <span className="truncate text-xs text-neutral-800" title={s.label}>
                  {s.label}
                </span>
              </div>
              {bar(s.after, s.after === 0 ? "bg-rose-400" : "bg-neutral-700")}
              <div className="mt-0.5 text-[10px] text-neutral-500 tabular-nums">{s.alone} on its own</div>
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums">
              <span className="block font-mono text-xs text-neutral-900">{s.after}</span>
              <span className={cx("block font-mono text-[10px]", s.delta === 0 ? "text-amber-700" : s.delta < 0 ? "text-neutral-500" : "text-emerald-700")}>
                {s.delta > 0 ? `+${s.delta}` : s.delta === 0 ? "±0" : s.delta}
              </span>
            </span>
          </li>
        ))}
        {root.not && (
          <li className="flex items-center gap-3 border-t border-neutral-100 py-1.5">
            <span className="w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-rose-700">NOT: keep everything else</div>
              {bar(final, "bg-rose-400")}
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-xs text-neutral-900 tabular-nums">{final}</span>
          </li>
        )}
      </ol>

      <div className="flex items-center justify-between border-t border-neutral-900 pt-2 text-xs">
        <span className="font-semibold text-neutral-900">Showing in the grid</span>
        <span className="font-mono font-semibold text-neutral-900 tabular-nums">
          {final} <span className="font-normal text-neutral-400">/ {total}</span>
        </span>
      </div>

      {flags.length > 0 && (
        <section aria-label="Checks">
          <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Checks</div>
          <ul className="flex flex-col gap-1.5">
            {flags.map((f, i) => (
              <li
                key={i}
                className={cx(
                  "flex gap-2 border px-2.5 py-1.5 text-[11px]",
                  f.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-900" : f.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-neutral-200 bg-neutral-50 text-neutral-700",
                )}
              >
                <span className="mt-px shrink-0">
                  <Icon d={ICON.warn} label="" size={12} />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
