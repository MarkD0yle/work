import { useCallback, useMemo, useState, type ReactNode } from "react";
import { button, cx, focus } from "../components/patterns/tokens";
import { FieldList, GroupBox, Icon, type BuilderActions } from "../components/advanced-filter/Builder";
import { ICON } from "../components/advanced-filter/icons";
import { ResultsGrid, type Engine } from "../components/advanced-filter/ResultsGrid";
import {
  BUSINESS_DATE,
  MAX_DEPTH,
  PRESETS,
  STATUS_LABEL,
  TRANSACTIONS,
  activeConditions,
  agExpression,
  cloneNode,
  depthOf,
  describeCondition,
  findNode,
  mapNode,
  newCondition,
  newGroup,
  testNode,
  toAgModel,
  type FieldKey,
  type FilterNode,
  type Group,
} from "../components/advanced-filter/model";

export const title = "Advanced Filter";
export const section = "patterns";
export const fullWidth = true;

/* Advanced Filter — a condition builder for AG Grid over Ledgerline's
 * transactions.
 *
 * Criteria come from a catalogue of 24 fields in five categories; each kind
 * of field (text, number, date, list, yes/no) brings its own operators and
 * value editor. Conditions sit in groups joined by AND or OR, groups nest
 * three deep and can be negated or switched off. Every row and group shows
 * its own match count as you build.
 *
 * The same filter is shown three ways: plain English, AG Grid's Advanced
 * Filter expression, and the AdvancedFilterModel JSON a developer would pass
 * to api.setAdvancedFilterModel(). The grid can run it on either engine, and
 * the page checks the two agree. */

type OutputTab = "english" | "expression" | "model";

/* ---- readable sentence ------------------------------------------ */

function Sentence({ node, root = true }: { node: FilterNode; root?: boolean }): ReactNode {
  if (node.kind === "condition") return <span className="font-medium text-neutral-900">{describeCondition(node)}</span>;
  const live = node.children.filter((c) => activeConditions(c).length > 0);
  if (live.length === 0) return null;
  const body = live.map((c, i) => (
    <span key={c.id}>
      {i > 0 && (
        <span className={cx("mx-1.5 text-[10px] font-bold tracking-wider", node.join === "AND" ? "text-sky-700" : "text-violet-700")}>{node.join}</span>
      )}
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

/* ---- summary ---------------------------------------------------- */

function Summary({ root }: { root: Group }) {
  const rows = useMemo(() => TRANSACTIONS.filter((r) => testNode(root, r)), [root]);
  const byCcy = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const byStatus = useMemo(() => {
    const m: Record<string, number> = { posted: 0, unposted: 0, reversed: 0 };
    for (const r of rows) m[r.status] += 1;
    return m;
  }, [rows]);
  const warnings = rows.filter((r) => r.hasWarning).length;
  const total = TRANSACTIONS.length;
  const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div className="grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 lg:grid-cols-4">
      <div className="bg-white px-4 py-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Matching</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {rows.length.toLocaleString()} <span className="text-sm font-normal text-neutral-400">/ {total}</span>
        </div>
        <div className="mt-2 h-1 bg-neutral-100">
          <div className="h-full bg-neutral-800" style={{ width: `${(rows.length / total) * 100}%` }} />
        </div>
      </div>
      <div className="bg-white px-4 py-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Amount by currency</div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {byCcy.length === 0 && <span className="text-xs text-neutral-400">—</span>}
          {byCcy.map(([ccy, v]) => (
            <span key={ccy} className="font-mono text-xs text-neutral-900 tabular-nums">
              <span className="text-neutral-500">{ccy}</span> {compact(v)}
            </span>
          ))}
        </div>
      </div>
      <div className="bg-white px-4 py-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">By status</div>
        <div className="mt-1.5 flex h-2 w-full bg-neutral-100">
          {rows.length > 0 &&
            (["posted", "unposted", "reversed"] as const).map((s) => (
              <div
                key={s}
                title={`${STATUS_LABEL[s]}: ${byStatus[s]}`}
                className={s === "posted" ? "bg-emerald-500" : s === "unposted" ? "bg-amber-400" : "bg-neutral-400"}
                style={{ width: `${(byStatus[s] / rows.length) * 100}%` }}
              />
            ))}
        </div>
        <div className="mt-1.5 flex gap-3 text-[11px] text-neutral-600 tabular-nums">
          <span>Posted {byStatus.posted}</span>
          <span>Unposted {byStatus.unposted}</span>
          <span>Reversed {byStatus.reversed}</span>
        </div>
      </div>
      <div className="bg-white px-4 py-3">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">With warnings</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">{warnings}</div>
        <div className="text-[11px] text-neutral-500">need acknowledging before posting</div>
      </div>
    </div>
  );
}

/* ---- page -------------------------------------------------------- */

const EMPTY = () => newGroup("AND", []);

export default function AdvancedFilterPage() {
  const [presetId, setPresetId] = useState<string | null>(PRESETS[3].id);
  const [draft, setDraft] = useState<Group>(() => PRESETS[3].build());
  const [applied, setApplied] = useState<Group>(draft);
  const [autoApply, setAutoApply] = useState(true);
  const [target, setTarget] = useState<string>(draft.id);
  const [libQuery, setLibQuery] = useState("");
  const [tab, setTab] = useState<OutputTab>("english");
  const [engine, setEngine] = useState<Engine>("builder");
  const [gridCount, setGridCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const commit = useCallback(
    (next: Group) => {
      setDraft(next);
      if (autoApply) setApplied(next);
    },
    [autoApply],
  );

  const actions: BuilderActions = useMemo(
    () => ({
      update: (id, fn) => {
        setPresetId(null);
        commit(mapNode(draft, id, fn));
      },
      addCondition: (groupId, field?: FieldKey) => {
        setPresetId(null);
        const c = newCondition(field ?? "status");
        commit(mapNode(draft, groupId, (n) => (n.kind === "group" ? { ...n, children: [...n.children, c] } : n)));
      },
      addGroup: (groupId) => {
        if (depthOf(draft, groupId) + 1 >= MAX_DEPTH) return;
        setPresetId(null);
        const g = newGroup("OR", [newCondition("type")]);
        commit(mapNode(draft, groupId, (n) => (n.kind === "group" ? { ...n, children: [...n.children, g] } : n)));
        setTarget(g.id);
      },
      duplicate: (id) => {
        setPresetId(null);
        const walk = (g: Group): Group => ({
          ...g,
          children: g.children.flatMap((c) => (c.id === id ? [c, cloneNode(c)] : [c.kind === "group" ? walk(c) : c])),
        });
        commit(walk(draft));
      },
      remove: (id) => {
        setPresetId(null);
        commit(mapNode(draft, id, () => null));
        if (target === id || !findNode(draft, target)) setTarget(draft.id);
      },
      setTarget,
    }),
    [commit, draft, target],
  );

  // The library adds to the target group; fall back to the root if it went away.
  const targetId = findNode(draft, target)?.kind === "group" ? target : draft.id;

  const loadPreset = (id: string | null) => {
    const g = id ? PRESETS.find((p) => p.id === id)!.build() : EMPTY();
    setPresetId(id);
    setDraft(g);
    setApplied(g);
    setTarget(g.id);
  };

  const translation = useMemo(() => toAgModel(applied), [applied]);
  const draftTranslation = useMemo(() => toAgModel(draft), [draft]);
  const expression = agExpression(draftTranslation.model);
  const modelJson = JSON.stringify(draftTranslation.model, null, 2) ?? "null";
  const evaluatorCount = useMemo(() => TRANSACTIONS.filter((r) => testNode(applied, r)).length, [applied]);
  const dirty = draft !== applied;
  const activeCount = activeConditions(draft).length;
  const agBlocked = engine === "ag-grid" && translation.unsupported.length > 0;

  const copy = async () => {
    const text = tab === "model" ? modelJson : tab === "expression" ? expression : document.getElementById("filter-english")?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard can be blocked in previews */
    }
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* pl-36 clears the app's fixed "Home" pill. */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-neutral-200 bg-white py-4 pr-6 pl-36">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Ledgerline · Transactions · AG Grid pattern</div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">Advanced Filter</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Build nested AND / OR / NOT conditions from {24} criteria. Business date {BUSINESS_DATE}; relative dates count from it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} className="accent-neutral-900" />
            Apply as I build
          </label>
          <button type="button" className={button.secondary} onClick={() => loadPreset(null)}>
            Clear all
          </button>
          <button type="button" className={button.secondary} disabled={!dirty} onClick={() => setDraft(applied)}>
            Discard changes
          </button>
          <button type="button" className={button.primary} disabled={!dirty} onClick={() => setApplied(draft)}>
            Apply filter{dirty ? " •" : ""}
          </button>
        </div>
      </header>

      {/* Saved filters */}
      <nav aria-label="Saved filters" className="flex shrink-0 gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-6 py-3">
        <span className="shrink-0 self-center pr-1 text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">Saved</span>
        {PRESETS.map((p) => {
          const on = presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => loadPreset(p.id)}
              title={p.note}
              className={cx(
                "flex w-56 shrink-0 flex-col items-start border px-3 py-2 text-left",
                on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400",
                focus,
              )}
            >
              <span className="w-full truncate text-xs font-semibold">{p.name}</span>
              <span className={cx("w-full truncate text-[10px]", on ? "text-neutral-300" : "text-neutral-500")}>{p.owner}</span>
            </button>
          );
        })}
        {presetId === null && (
          <span className="shrink-0 self-center border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500">Custom filter (unsaved)</span>
        )}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 lg:flex-row lg:items-start">
        {/* Criteria library */}
        {/* Sticky inside the scrolling body; 13rem leaves room for the header and saved strip. */}
        <aside
          aria-label="Criteria library"
          style={{ maxHeight: "calc(100vh - 13rem)" }}
          className="flex shrink-0 flex-col border border-neutral-200 bg-white lg:sticky lg:top-0 lg:w-64"
        >
          <div className="border-b border-neutral-200 px-3 py-2.5">
            <div className="text-sm font-semibold text-neutral-900">Criteria</div>
            <div className="text-[11px] text-neutral-500">Click to add to the highlighted group</div>
          </div>
          <div className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-2 text-neutral-400">
            <Icon d={ICON.search} label="" />
            <input
              aria-label="Search criteria"
              value={libQuery}
              onChange={(e) => setLibQuery(e.target.value)}
              placeholder="Search 24 criteria"
              className="w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FieldList query={libQuery} onPick={(k) => actions.addCondition(targetId, k)} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Builder */}
          <section aria-label="Filter builder" className="border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Conditions</h2>
                <p className="text-[11px] text-neutral-500">
                  {activeCount} active · the number on each row is what it matches on its own
                </p>
              </div>
              {dirty && <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">Not applied</span>}
            </div>
            <GroupBox g={draft} depth={0} total={TRANSACTIONS.length} actions={actions} target={targetId} />
          </section>

          {/* Output */}
          <section aria-label="Filter output" className="border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 pr-2">
              <div role="tablist" className="flex">
                {(
                  [
                    ["english", "Plain English"],
                    ["expression", "AG Grid expression"],
                    ["model", "AdvancedFilterModel"],
                  ] as [OutputTab, string][]
                ).map(([id, name]) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cx(
                      "border-b-2 px-4 py-2 text-xs font-medium",
                      tab === id ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900",
                      focus,
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <button type="button" className={button.ghost} onClick={copy}>
                <Icon d={ICON.copy} label="" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="max-h-56 overflow-auto px-4 py-3">
              {tab === "english" && (
                <p id="filter-english" className="text-xs leading-6 text-neutral-700">
                  {activeCount === 0 ? (
                    <span className="text-neutral-400">No active conditions: every transaction shows.</span>
                  ) : (
                    <>
                      Show transactions where <Sentence node={draft} />.
                    </>
                  )}
                </p>
              )}
              {tab !== "english" && draftTranslation.unsupported.length > 0 && (
                <div className="mb-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  AG Grid’s Advanced Filter has no negated “starts with” or “ends with”, so this can’t be expressed:{" "}
                  <span className="font-medium">{draftTranslation.unsupported.join("; ")}</span>. Use “does not contain”, or run it on the builder engine.
                </div>
              )}
              {tab === "expression" && (
                <pre className="font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-neutral-800">{expression || "—"}</pre>
              )}
              {tab === "model" && (
                <>
                  <p className="mb-2 text-[11px] text-neutral-500">
                    Pass to <code className="font-mono text-neutral-800">api.setAdvancedFilterModel()</code>. NOT, between, any-of and relative dates are rewritten into
                    AND / OR joins AG Grid supports.
                  </p>
                  <pre className="font-mono text-[11px] leading-5 text-neutral-800">{modelJson}</pre>
                </>
              )}
            </div>
          </section>

          <Summary root={applied} />

          {/* Grid */}
          <section aria-label="Transactions" className="flex flex-col border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Transactions</h2>
                <p className="text-[11px] text-neutral-500">600-row slice of the Ledgerline seed · 60 portfolios</p>
              </div>
              <div className="flex items-center gap-3">
                <EngineBadge engine={engine} gridCount={gridCount} evaluatorCount={evaluatorCount} blocked={agBlocked} />
                <div role="radiogroup" aria-label="Filter engine" className="inline-flex border border-neutral-300">
                  {(
                    [
                      ["builder", "Builder engine"],
                      ["ag-grid", "AG Grid Advanced Filter"],
                    ] as [Engine, string][]
                  ).map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={engine === id}
                      onClick={() => setEngine(id)}
                      className={cx("px-2.5 py-1 text-[11px] font-medium", engine === id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100", focus)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ height: 520 }}>
              <ResultsGrid applied={applied} agModel={translation.model} engine={agBlocked ? "builder" : engine} onCount={setGridCount} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function EngineBadge({ engine, gridCount, evaluatorCount, blocked }: { engine: Engine; gridCount: number | null; evaluatorCount: number; blocked: boolean }) {
  if (engine === "builder") return <span className="text-[11px] text-neutral-500">Filtered by the builder’s evaluator</span>;
  if (blocked)
    return (
      <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Not expressible in AG Grid · showing builder result</span>
    );
  const agree = gridCount === evaluatorCount;
  return (
    <span
      className={cx(
        "border px-2 py-0.5 text-[11px] tabular-nums",
        agree ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
      )}
      title="Rows AG Grid shows against rows the builder's evaluator matches"
    >
      {agree ? `AG Grid agrees · ${gridCount} rows` : `Mismatch · AG Grid ${gridCount ?? "…"} vs builder ${evaluatorCount}`}
    </span>
  );
}
