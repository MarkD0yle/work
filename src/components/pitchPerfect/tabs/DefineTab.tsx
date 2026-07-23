import { ReadEditSection } from "../ReadEditSection";
import { AIInsightPanel } from "../AIInsightPanel";
import { SelectField, TextField, TextareaField, controlClass } from "../../forms";
import { suggestNextSteps } from "../../../lib/pitchPerfect/pitchSuggestions";
import type { Attendee, AudienceProfile, Opportunity, PitchType } from "../../../lib/pitchPerfect/types";

type DefineFields = {
  name: string;
  pitchType: PitchType;
  objective: string;
  scope: string;
  attendees: Attendee[];
  audience: AudienceProfile;
};

const PITCH_TYPES: PitchType[] = ["New business", "Upsell", "Renewal", "Win-back", "RFP response"];
const SENIORITIES: AudienceProfile["seniority"][] = ["Individual contributor", "Manager", "Director", "Executive", "Board"];
const FORMATS: AudienceProfile["format"][] = ["In-person", "Video call", "Written proposal only"];

function AttendeeEditor({ attendees, onChange }: { attendees: Attendee[]; onChange: (a: Attendee[]) => void }) {
  function update(i: number, patch: Partial<Attendee>) {
    onChange(attendees.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function add() {
    onChange([...attendees, { name: "", role: "", isDecisionMaker: false }]);
  }
  function remove(i: number) {
    onChange(attendees.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Attendees</div>
        <button type="button" onClick={add} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
          + Add attendee
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {attendees.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={a.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Name"
              className={controlClass(false, "min-w-[140px] flex-1")}
            />
            <input
              value={a.role}
              onChange={(e) => update(i, { role: e.target.value })}
              placeholder="Role"
              className={controlClass(false, "min-w-[140px] flex-1")}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-600">
              <input type="checkbox" checked={a.isDecisionMaker} onChange={(e) => update(i, { isDecisionMaker: e.target.checked })} />
              Decision maker
            </label>
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-neutral-400 hover:text-rose-600">
              Remove
            </button>
          </div>
        ))}
        {attendees.length === 0 && <p className="text-xs text-neutral-400">No attendees added yet.</p>}
      </div>
    </div>
  );
}

export function DefineTab({ opportunity, onSave }: { opportunity: Opportunity; onSave: (fields: DefineFields) => void }) {
  const value: DefineFields = {
    name: opportunity.name,
    pitchType: opportunity.pitchType,
    objective: opportunity.objective,
    scope: opportunity.scope,
    attendees: opportunity.attendees,
    audience: opportunity.audience,
  };

  const suggestions = suggestNextSteps(opportunity).filter((s) => s.targetTab === "define");

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <AIInsightPanel suggestions={suggestions} emptyLabel="The brief looks complete — nothing to flag here." />
      <ReadEditSection<DefineFields>
        title="Opportunity brief"
        description="The context that drives everything else — who this is for and what you're trying to achieve."
        value={value}
        isEmpty={(v) => !v.name && !v.objective && !v.scope && v.attendees.length === 0}
        emptyLabel="Not defined yet."
        onSave={onSave}
        renderRead={(v) => (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Name</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Pitch type</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.pitchType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium text-neutral-500">Objective</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.objective || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium text-neutral-500">Scope</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.scope || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Audience</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">
                {v.audience.seniority} · {v.audience.size} attendee{v.audience.size === 1 ? "" : "s"} · {v.audience.format}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium text-neutral-500">Attendees</dt>
              {v.attendees.length === 0 ? (
                <dd className="mt-0.5 text-sm text-neutral-400 italic">None listed.</dd>
              ) : (
                <dd className="mt-1 space-y-1">
                  {v.attendees.map((a, i) => (
                    <div key={i} className="text-sm text-neutral-900">
                      {a.name} <span className="text-neutral-500">— {a.role}</span>
                      {a.isDecisionMaker && (
                        <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Decision maker
                        </span>
                      )}
                    </div>
                  ))}
                </dd>
              )}
            </div>
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <SelectField
                label="Pitch type"
                value={draft.pitchType}
                onChange={(e) => setDraft({ ...draft, pitchType: e.target.value as PitchType })}
              >
                {PITCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextareaField label="Objective" value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: e.target.value })} />
            <TextareaField label="Scope" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SelectField
                label="Audience seniority"
                value={draft.audience.seniority}
                onChange={(e) => setDraft({ ...draft, audience: { ...draft.audience, seniority: e.target.value as AudienceProfile["seniority"] } })}
              >
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Audience size"
                type="number"
                min={1}
                value={draft.audience.size}
                onChange={(e) => setDraft({ ...draft, audience: { ...draft.audience, size: Number(e.target.value) || 1 } })}
              />
              <SelectField
                label="Format"
                value={draft.audience.format}
                onChange={(e) => setDraft({ ...draft, audience: { ...draft.audience, format: e.target.value as AudienceProfile["format"] } })}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectField>
            </div>
            <AttendeeEditor attendees={draft.attendees} onChange={(attendees) => setDraft({ ...draft, attendees })} />
          </div>
        )}
      />
    </div>
  );
}
