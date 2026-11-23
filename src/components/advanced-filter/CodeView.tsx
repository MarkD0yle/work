import { useMemo, useState, type ReactNode } from "react";
import { button, cx, focus } from "../patterns/tokens";
import { ICON } from "./icons";
import { activeConditions, agExpression, describeCondition, toAgModel, type FilterNode, type Group } from "./model";
import type { Engine } from "./ResultsGrid";
import { Icon } from "./ui";

/* Code: the filter as a developer would hand it over — plain English, AG
 * Grid's Advanced Filter expression, and the AdvancedFilterModel — plus a
 * switch that runs the grid on AG Grid's own engine to prove they agree. */

type Tab = "english" | "expression" | "model";

function Sentence({ node, root = true }: { node: FilterNode; root?: boolean }): ReactNode {
  if (node.kind === "condition") return <span className="font-medium text-neutral-900">{describeCondition(node)}</span>;
  const live = node.children.filter((c) => activeConditions(c).length > 0);
  if (live.length === 0) return null;
  const body = live.map((c, i) => (
    <span key={c.id}>
      {i > 0 && <span className={cx("mx-1.5 text-[10px] font-bold tracking-wider", node.join === "AND" ? "text-sky-700" : "text-violet-700")}>{node.join}</span>}
      <Sentence node={c} root={false} />
    </span>
  ));
  return (
    <span>
      {node.not && <span className="mr-1 text-[10px] font-bold tracking-wider text-rose-700">NOT</span>}
      {!root || node.not ? (
        <>
          <span className="text-neutral-400">(</span>
          {body}
          <span className="text-neutral-400">)</span>
        </>
      ) : (
        body
      )}
    </span>
  );
}

export function CodeView({
  root,
  engine,
  onEngine,
  gridCount,
  evaluatorCount,
}: {
  root: Group;
  engine: Engine;
  onEngine: (e: Engine) => void;
  gridCount: number | null;
  evaluatorCount: number;
}) {
  const [tab, setTab] = useState<Tab>("english");
  const [copied, setCopied] = useState(false);
  const t = useMemo(() => toAgModel(root), [root]);
  const expression = agExpression(t.model);
  const modelJson = JSON.stringify(t.model, null, 2) ?? "null";
  const blocked = t.unsupported.length > 0;
  const agree = gridCount === evaluatorCount;

  const copy = async () => {
    const text = tab === "model" ? modelJson : tab === "expression" ? expression : (document.getElementById("filter-english")?.innerText ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard can be blocked in previews */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Engine">
        <div className="mb-1.5 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Run the grid on</div>
        <div role="radiogroup" aria-label="Filter engine" className="flex border border-neutral-300">
          {(
            [
              ["builder", "Builder evaluator"],
              ["ag-grid", "AG Grid Advanced Filter"],
            ] as [Engine, string][]
          ).map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={engine === id}
              onClick={() => onEngine(id)}
              className={cx("flex-1 px-2 py-1.5 text-[11px] font-medium", engine === id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100", focus)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px]">
          {engine === "builder" ? (
            <span className="text-neutral-500">Switch to AG Grid to check its engine returns the same rows.</span>
          ) : blocked ? (
            <span className="text-amber-800">AG Grid can’t express this filter, so the grid is showing the builder’s result.</span>
          ) : (
            <span className={agree ? "text-emerald-800" : "text-rose-800"}>
              {agree ? `AG Grid agrees: ${gridCount} rows.` : `Mismatch: AG Grid ${gridCount ?? "…"} rows, builder ${evaluatorCount}.`}
            </span>
          )}
        </p>
      </section>

      <section aria-label="Filter output" className="border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 pr-1">
          <div role="tablist" className="flex">
            {(
              [
                ["english", "English"],
                ["expression", "Expression"],
                ["model", "Model"],
              ] as [Tab, string][]
            ).map(([id, name]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx("border-b-2 px-3 py-1.5 text-[11px] font-medium", tab === id ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900", focus)}
              >
                {name}
              </button>
            ))}
          </div>
          <button type="button" className={button.ghost} onClick={copy}>
            <Icon d={ICON.copy} label="" size={12} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="px-3 py-2">
          {tab === "english" && (
            <p id="filter-english" className="text-xs leading-6 text-neutral-700">
              {activeConditions(root).length === 0 ? (
                <span className="text-neutral-400">No active conditions.</span>
              ) : (
                <>
                  Show transactions where <Sentence node={root} />.
                </>
              )}
            </p>
          )}
          {tab !== "english" && blocked && (
            <div className="mb-2 border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
              AG Grid has no negated “starts with” or “ends with”: <span className="font-medium">{t.unsupported.join("; ")}</span>. Use “does not contain” instead.
            </div>
          )}
          {tab === "expression" && <pre className="font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-neutral-800">{expression || "—"}</pre>}
          {tab === "model" && (
            <>
              <p className="mb-1.5 text-[11px] text-neutral-500">
                For <code className="font-mono text-neutral-800">api.setAdvancedFilterModel()</code>. NOT, between, any-of and relative dates are rewritten as AND / OR joins.
              </p>
              <pre className="overflow-x-auto font-mono text-[11px] leading-5 text-neutral-800">{modelJson}</pre>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
