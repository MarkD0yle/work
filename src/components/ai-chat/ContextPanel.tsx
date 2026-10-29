import { Database, FileText, PanelRightClose, ShieldCheck } from "lucide-react";
import type { Block, ContextSource, Scope, Source } from "./data";
import { ChartBlock, IconButton, TableBlock } from "./blocks";

/* Right-hand context panel.
 *
 * Three tabs, each answering one question the user has while chatting:
 *   Context  — "what is the assistant looking at?" (client, mandate, which
 *              data sources are switched on). Toggling a source here is the
 *              Copilot "grounding" pattern: scope is visible and editable.
 *   Workspace — "let me look at that properly" — a chart or table opened from
 *              the thread, at full size (the Claude artifact pattern).
 *   Sources  — "where did that come from?" — citations for the last answer.
 */

export type PanelTab = "context" | "workspace" | "sources";

export type Artifact = { id: string; kind: "chart" | "table"; title: string; block: Block };

type Props = {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose: () => void;
  scope: Scope;
  context: ContextSource[];
  onToggleSource: (id: string) => void;
  artifacts: Artifact[];
  activeArtifact: string | null;
  onPickArtifact: (id: string) => void;
  sources: Source[];
};

const TABS: { id: PanelTab; label: string }[] = [
  { id: "context", label: "Context" },
  { id: "workspace", label: "Workspace" },
  { id: "sources", label: "Sources" },
];

export function ContextPanel(p: Props) {
  return (
    <aside aria-label="Context panel" className="flex h-full w-full flex-col border-l border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 pr-2">
        <div role="tablist" aria-label="Panel views" className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={p.tab === t.id}
              onClick={() => p.onTab(t.id)}
              className={`border-b-2 px-4 py-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-neutral-900 ${
                p.tab === t.id ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
              {t.id === "workspace" && p.artifacts.length > 0 && (
                <span className="ml-1.5 bg-neutral-100 px-1.5 py-px font-mono text-[10px] text-neutral-600">{p.artifacts.length}</span>
              )}
            </button>
          ))}
        </div>
        <IconButton label="Close panel" onClick={p.onClose}>
          <PanelRightClose size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {p.tab === "context" && <ContextTab {...p} />}
        {p.tab === "workspace" && <WorkspaceTab {...p} />}
        {p.tab === "sources" && <SourcesTab sources={p.sources} />}
      </div>
    </aside>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{children}</div>;
}

function ContextTab({ scope, context, onToggleSource }: Props) {
  const rows = scope.facts;
  return (
    <div className="space-y-6">
      <section>
        <Label>{scope.kind}</Label>
        <div className="border border-neutral-200">
          <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <div className="text-[14px] font-semibold text-neutral-950">{scope.name}</div>
            <div className="text-[11px] text-neutral-500">Data as of {scope.asOf}</div>
          </div>
          <dl className="divide-y divide-neutral-100">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2 px-3 py-2 text-[12px]">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <Label>Data sources</Label>
        <p className="mb-2 text-[12px] text-neutral-500">The assistant only answers from sources that are switched on.</p>
        <ul className="divide-y divide-neutral-100 border border-neutral-200">
          {context.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50">
                <Database size={14} className="shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-neutral-900">{s.label}</span>
                  <span className="block text-[11px] text-neutral-500">
                    {s.system} · {s.asOf}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => onToggleSource(s.id)}
                  className="h-4 w-4 accent-neutral-900"
                  aria-label={`Use ${s.label}`}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex gap-2 border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900">
        <ShieldCheck size={16} className="mt-px shrink-0" />
        <div>
          <div className="font-semibold">Entitlements applied</div>
          <div className="mt-0.5 text-emerald-800">
            Answers respect your data permissions. Every prompt and answer is logged for audit (FCA SYSC 9).
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceTab({ artifacts, activeArtifact, onPickArtifact }: Props) {
  if (!artifacts.length) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="max-w-[240px]">
          <FileText size={22} className="mx-auto text-neutral-300" />
          <div className="mt-2 text-[13px] font-medium text-neutral-700">Nothing open yet</div>
          <p className="mt-1 text-[12px] text-neutral-500">Charts and tables from the chat appear here. Use the expand button on any card.</p>
        </div>
      </div>
    );
  }
  const current = artifacts.find((a) => a.id === activeArtifact) ?? artifacts[artifacts.length - 1];
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Choose item</span>
        <select
          value={current.id}
          onChange={(e) => onPickArtifact(e.target.value)}
          className="w-full border border-neutral-200 bg-white px-2 py-1.5 text-[13px] focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          {artifacts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.kind === "chart" ? "Chart" : "Table"} · {a.title}
            </option>
          ))}
        </select>
      </label>
      {current.block.type === "chart" && <ChartBlock id={current.id} spec={current.block.spec} size="panel" />}
      {current.block.type === "table" && <TableBlock id={current.id} spec={current.block.spec} />}
    </div>
  );
}

function SourcesTab({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return <p className="text-[13px] text-neutral-500">Sources for the latest answer appear here.</p>;
  }
  return (
    <div>
      <Label>Cited in latest answer</Label>
      <ol className="space-y-2">
        {sources.map((s, i) => (
          <li key={s.id} className="flex gap-3 border border-neutral-200 p-3">
            <span className="grid h-5 w-5 shrink-0 place-items-center bg-neutral-900 font-mono text-[10px] text-white">{i + 1}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-neutral-900">{s.label}</div>
              <div className="text-[11px] text-neutral-500">
                {s.system} · as of {s.asOf}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
