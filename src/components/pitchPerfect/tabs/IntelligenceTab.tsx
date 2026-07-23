import { useState } from "react";
import { ReadEditSection } from "../ReadEditSection";
import { SectionNav, type SectionNavItem } from "../SectionNav";
import { GapChecklist } from "../GapChecklist";
import { TextareaField, SelectField, controlClass } from "../../forms";
import { checkIntelligenceGaps } from "../../../lib/pitchPerfect/intelligenceGaps";
import type { CompetitiveSituation, Intelligence, Opportunity, PainPoint, Stakeholder } from "../../../lib/pitchPerfect/types";

type SectionId = "objectives" | "stakeholders" | "context";

const SEVERITIES: PainPoint["severity"][] = ["Low", "Medium", "High"];
const INFLUENCES: Stakeholder["influence"][] = ["Champion", "Decision maker", "Influencer", "Blocker", "Unknown"];
const STANCES: Stakeholder["stance"][] = ["Supportive", "Neutral", "Skeptical", "Unknown"];
const THREAT_LEVELS: CompetitiveSituation["threatLevel"][] = ["Low", "Medium", "High", "Unknown"];

const SEVERITY_TONE: Record<PainPoint["severity"], string> = {
  Low: "bg-neutral-100 text-neutral-600",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-rose-50 text-rose-700",
};

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* Editable list of plain strings (objectives, decision criteria, market
 * context, incumbents) — one line per entry, add/remove. */
function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  function update(i: number, value: string) {
    onChange(items.map((v, idx) => (idx === i ? value : v)));
  }
  function add() {
    onChange([...items, ""]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={v} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className={controlClass(false, "flex-1")} />
          <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-neutral-400 hover:text-rose-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
        + Add
      </button>
    </div>
  );
}

// ---- Section: objectives & pain points ----
type ObjectivesFields = { clientObjectives: string[]; painPoints: PainPoint[] };

function PainPointsEditor({ painPoints, onChange }: { painPoints: PainPoint[]; onChange: (p: PainPoint[]) => void }) {
  function update(i: number, patch: Partial<PainPoint>) {
    onChange(painPoints.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add() {
    onChange([...painPoints, { id: genId("pp"), label: "", detail: "", severity: "Medium" }]);
  }
  function remove(i: number) {
    onChange(painPoints.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-3">
      {painPoints.map((p, i) => (
        <div key={p.id} className="rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <input
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Pain point label"
              className={controlClass(false, "flex-1")}
            />
            <select value={p.severity} onChange={(e) => update(i, { severity: e.target.value as PainPoint["severity"] })} className={controlClass(false, "w-32")}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-neutral-400 hover:text-rose-600">
              Remove
            </button>
          </div>
          <textarea
            value={p.detail}
            onChange={(e) => update(i, { detail: e.target.value })}
            placeholder="Detail — what's the specific challenge?"
            className={`${controlClass(false, "mt-2 min-h-[60px] resize-y")}`}
          />
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
        + Add pain point
      </button>
    </div>
  );
}

function ObjectivesPainPointsSection({ opportunity, onSave }: { opportunity: Opportunity; onSave: (f: ObjectivesFields) => void }) {
  const value: ObjectivesFields = {
    clientObjectives: opportunity.intelligence.clientObjectives,
    painPoints: opportunity.intelligence.painPoints,
  };
  return (
    <ReadEditSection<ObjectivesFields>
      title="Client objectives & pain points"
      description="What the client is trying to achieve, and the specific challenges standing in the way."
      value={value}
      isEmpty={(v) => v.clientObjectives.length === 0 && v.painPoints.length === 0}
      onSave={onSave}
      renderRead={(v) => (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Objectives</div>
            {v.clientObjectives.length === 0 ? (
              <p className="mt-0.5 text-sm text-neutral-400 italic">None captured.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-900">
                {v.clientObjectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Pain points</div>
            {v.painPoints.length === 0 ? (
              <p className="mt-0.5 text-sm text-neutral-400 italic">None captured.</p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {v.painPoints.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_TONE[p.severity]}`}>{p.severity}</span>
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">{p.label}</span>
                      <span className="block text-xs text-neutral-500">{p.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      renderEdit={(draft, setDraft) => (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Objectives</div>
            <div className="mt-1.5">
              <StringListEditor items={draft.clientObjectives} onChange={(clientObjectives) => setDraft({ ...draft, clientObjectives })} placeholder="e.g. Fund a multi-generational transfer" />
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Pain points</div>
            <div className="mt-1.5">
              <PainPointsEditor painPoints={draft.painPoints} onChange={(painPoints) => setDraft({ ...draft, painPoints })} />
            </div>
          </div>
        </div>
      )}
    />
  );
}

// ---- Section: stakeholders ----
type StakeholdersFields = { stakeholders: Stakeholder[] };

function StakeholdersEditor({ stakeholders, onChange }: { stakeholders: Stakeholder[]; onChange: (s: Stakeholder[]) => void }) {
  function update(i: number, patch: Partial<Stakeholder>) {
    onChange(stakeholders.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function add() {
    onChange([...stakeholders, { name: "", role: "", influence: "Unknown", stance: "Unknown", notes: "" }]);
  }
  function remove(i: number) {
    onChange(stakeholders.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-3">
      {stakeholders.map((s, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className={controlClass(false)} />
            <input value={s.role} onChange={(e) => update(i, { role: e.target.value })} placeholder="Role" className={controlClass(false)} />
            <select value={s.influence} onChange={(e) => update(i, { influence: e.target.value as Stakeholder["influence"] })} className={controlClass(false)}>
              {INFLUENCES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={s.stance} onChange={(e) => update(i, { stance: e.target.value as Stakeholder["stance"] })} className={controlClass(false)}>
              {STANCES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={s.notes}
            onChange={(e) => update(i, { notes: e.target.value })}
            placeholder="Notes"
            className={`${controlClass(false, "mt-2 min-h-[52px] resize-y")}`}
          />
          <button type="button" onClick={() => remove(i)} className="mt-1.5 text-xs text-neutral-400 hover:text-rose-600">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
        + Add stakeholder
      </button>
    </div>
  );
}

const INFLUENCE_TONE: Record<Stakeholder["influence"], string> = {
  Champion: "bg-emerald-50 text-emerald-700",
  "Decision maker": "bg-sky-50 text-sky-700",
  Influencer: "bg-violet-50 text-violet-700",
  Blocker: "bg-rose-50 text-rose-700",
  Unknown: "bg-neutral-100 text-neutral-500",
};

function StakeholdersSection({ opportunity, onSave }: { opportunity: Opportunity; onSave: (f: StakeholdersFields) => void }) {
  const value: StakeholdersFields = { stakeholders: opportunity.intelligence.stakeholders };
  return (
    <ReadEditSection<StakeholdersFields>
      title="Stakeholders & buying committee"
      description="Who's in the room, who decides, and where they stand."
      value={value}
      isEmpty={(v) => v.stakeholders.length === 0}
      onSave={onSave}
      renderRead={(v) => (
        <ul className="space-y-2">
          {v.stakeholders.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-neutral-100 p-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-900">
                  {s.name} <span className="font-normal text-neutral-500">— {s.role}</span>
                </div>
                {s.notes && <p className="mt-0.5 text-xs text-neutral-500">{s.notes}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INFLUENCE_TONE[s.influence]}`}>{s.influence}</span>
                <span className="text-[11px] text-neutral-400">{s.stance}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      renderEdit={(draft, setDraft) => <StakeholdersEditor stakeholders={draft.stakeholders} onChange={(stakeholders) => setDraft({ stakeholders })} />}
    />
  );
}

// ---- Section: competitive situation, decision criteria, relationship history, market context ----
type ContextFields = {
  competitive: CompetitiveSituation;
  decisionCriteria: string[];
  relationshipHistory: string;
  marketContext: string[];
};

function ContextSection({ opportunity, onSave }: { opportunity: Opportunity; onSave: (f: ContextFields) => void }) {
  const value: ContextFields = {
    competitive: opportunity.intelligence.competitive,
    decisionCriteria: opportunity.intelligence.decisionCriteria,
    relationshipHistory: opportunity.intelligence.relationshipHistory,
    marketContext: opportunity.intelligence.marketContext,
  };
  return (
    <ReadEditSection<ContextFields>
      title="Competitive situation, decision criteria & history"
      description="The context the pitch has to compete and land within."
      value={value}
      isEmpty={(v) =>
        v.competitive.incumbents.length === 0 &&
        !v.competitive.competitiveNote &&
        v.decisionCriteria.length === 0 &&
        !v.relationshipHistory &&
        v.marketContext.length === 0
      }
      onSave={onSave}
      renderRead={(v) => (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Competitive situation</div>
            <p className="mt-0.5 text-sm text-neutral-900">
              Threat level: <span className="font-medium">{v.competitive.threatLevel}</span>
              {v.competitive.incumbents.length > 0 && <> · Incumbents: {v.competitive.incumbents.join(", ")}</>}
            </p>
            {v.competitive.competitiveNote && <p className="mt-0.5 text-xs text-neutral-500">{v.competitive.competitiveNote}</p>}
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Decision criteria</div>
            {v.decisionCriteria.length === 0 ? (
              <p className="mt-0.5 text-sm text-neutral-400 italic">None captured.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-900">
                {v.decisionCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Relationship history</div>
            <p className="mt-0.5 text-sm text-neutral-900">{v.relationshipHistory || "—"}</p>
          </div>
          <div>
            <div className="text-[11px] font-medium text-neutral-500">Market/industry context</div>
            {v.marketContext.length === 0 ? (
              <p className="mt-0.5 text-sm text-neutral-400 italic">None captured.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-900">
                {v.marketContext.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      renderEdit={(draft, setDraft) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Threat level"
              value={draft.competitive.threatLevel}
              onChange={(e) => setDraft({ ...draft, competitive: { ...draft.competitive, threatLevel: e.target.value as CompetitiveSituation["threatLevel"] } })}
            >
              {THREAT_LEVELS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Incumbents</div>
            <div className="mt-1.5">
              <StringListEditor
                items={draft.competitive.incumbents}
                onChange={(incumbents) => setDraft({ ...draft, competitive: { ...draft.competitive, incumbents } })}
                placeholder="Competitor or incumbent name"
              />
            </div>
          </div>
          <TextareaField
            label="Competitive note"
            value={draft.competitive.competitiveNote}
            onChange={(e) => setDraft({ ...draft, competitive: { ...draft.competitive, competitiveNote: e.target.value } })}
          />
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Decision criteria</div>
            <div className="mt-1.5">
              <StringListEditor items={draft.decisionCriteria} onChange={(decisionCriteria) => setDraft({ ...draft, decisionCriteria })} placeholder="What will they judge this against?" />
            </div>
          </div>
          <TextareaField
            label="Relationship history"
            value={draft.relationshipHistory}
            onChange={(e) => setDraft({ ...draft, relationshipHistory: e.target.value })}
          />
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Market/industry context</div>
            <div className="mt-1.5">
              <StringListEditor items={draft.marketContext} onChange={(marketContext) => setDraft({ ...draft, marketContext })} placeholder="Why now?" />
            </div>
          </div>
        </div>
      )}
    />
  );
}

function sectionStatus(filledCount: number, totalSignals: number): SectionNavItem["status"] {
  if (filledCount === 0) return "empty";
  if (filledCount === totalSignals) return "complete";
  return "partial";
}

export function IntelligenceTab({
  opportunity,
  onSaveIntelligence,
}: {
  opportunity: Opportunity;
  onSaveIntelligence: (intelligence: Intelligence) => void;
}) {
  const [active, setActive] = useState<SectionId>("objectives");
  const gaps = checkIntelligenceGaps(opportunity.intelligence);
  const { intelligence } = opportunity;

  function patch(partial: Partial<Intelligence>) {
    onSaveIntelligence({ ...intelligence, ...partial });
  }

  const navItems: SectionNavItem[] = [
    {
      id: "objectives",
      label: "Objectives & pain points",
      status: sectionStatus(
        (intelligence.clientObjectives.length > 0 ? 1 : 0) + (intelligence.painPoints.length > 0 ? 1 : 0),
        2,
      ),
      summary: `${intelligence.clientObjectives.length} objective${intelligence.clientObjectives.length === 1 ? "" : "s"} · ${intelligence.painPoints.length} pain point${intelligence.painPoints.length === 1 ? "" : "s"}`,
    },
    {
      id: "stakeholders",
      label: "Stakeholders",
      status: intelligence.stakeholders.length === 0 ? "empty" : "complete",
      summary: `${intelligence.stakeholders.length} stakeholder${intelligence.stakeholders.length === 1 ? "" : "s"}`,
    },
    {
      id: "context",
      label: "Competitive & context",
      status: sectionStatus(
        (intelligence.competitive.threatLevel !== "Unknown" ? 1 : 0) +
          (intelligence.decisionCriteria.length > 0 ? 1 : 0) +
          (intelligence.relationshipHistory.trim() ? 1 : 0) +
          (intelligence.marketContext.length > 0 ? 1 : 0),
        4,
      ),
      summary: `Threat: ${intelligence.competitive.threatLevel} · ${intelligence.decisionCriteria.length} criteria`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Intelligence gaps</div>
        <p className="mt-1 text-xs text-neutral-500">
          {gaps.filter((g) => g.pass).length}/{gaps.length} checks passing — what's still missing to confidently pursue this opportunity.
        </p>
        <div className="mt-3">
          <GapChecklist items={gaps} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <SectionNav items={navItems} activeId={active} onSelect={(id) => setActive(id as SectionId)} />
          </div>
        </div>

        <div className="min-w-0">
          {active === "objectives" && <ObjectivesPainPointsSection opportunity={opportunity} onSave={(f) => patch(f)} />}
          {active === "stakeholders" && <StakeholdersSection opportunity={opportunity} onSave={(f) => patch(f)} />}
          {active === "context" && <ContextSection opportunity={opportunity} onSave={(f) => patch(f)} />}
        </div>
      </div>
    </div>
  );
}
