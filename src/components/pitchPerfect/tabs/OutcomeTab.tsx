import { ReadEditSection } from "../ReadEditSection";
import { SelectField, TextareaField, controlClass } from "../../forms";
import type { Opportunity, Outcome, OutcomeResult } from "../../../lib/pitchPerfect/types";

const RESULTS: OutcomeResult[] = ["Won", "Lost", "Pending", "No decision"];

const RESULT_TONE: Record<OutcomeResult, string> = {
  Won: "bg-emerald-50 text-emerald-700",
  Lost: "bg-rose-50 text-rose-700",
  Pending: "bg-amber-50 text-amber-700",
  "No decision": "bg-neutral-100 text-neutral-600",
};

const EMPTY_OUTCOME: Outcome = {
  result: "Pending",
  clientReactions: "",
  objectionsEncountered: [],
  lessonsLearned: "",
  nextSteps: "",
  capturedAt: "",
};

function ObjectionsEncounteredEditor({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
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
    <div>
      <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Objections encountered</div>
      <div className="mt-1.5 space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={v} onChange={(e) => update(i, e.target.value)} placeholder="Objection raised during the pitch" className={controlClass(false, "flex-1")} />
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-xs text-neutral-400 hover:text-rose-600">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={add} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
          + Add
        </button>
      </div>
    </div>
  );
}

export function OutcomeTab({ opportunity, onSaveOutcome }: { opportunity: Opportunity; onSaveOutcome: (outcome: Outcome) => void }) {
  const value = opportunity.outcome ?? EMPTY_OUTCOME;

  function handleSave(next: Outcome) {
    onSaveOutcome({ ...next, capturedAt: new Date().toISOString() });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <ReadEditSection<Outcome>
        title="Pitch outcome"
        description="What happened after the pitch — easy to capture, tied directly to this opportunity."
        value={value}
        isEmpty={() => opportunity.outcome === null}
        emptyLabel="Not captured yet."
        onSave={handleSave}
        renderRead={(v) => (
          <dl className="space-y-4">
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Result</dt>
              <dd className="mt-1">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_TONE[v.result]}`}>{v.result}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Client reactions</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.clientReactions || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Objections encountered</dt>
              {v.objectionsEncountered.length === 0 ? (
                <dd className="mt-0.5 text-sm text-neutral-400 italic">None recorded.</dd>
              ) : (
                <dd className="mt-1">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-900">
                    {v.objectionsEncountered.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </dd>
              )}
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Lessons learned</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.lessonsLearned || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-neutral-500">Next steps</dt>
              <dd className="mt-0.5 text-sm text-neutral-900">{v.nextSteps || "—"}</dd>
            </div>
            {v.capturedAt && <p className="text-[11px] text-neutral-400">Captured {new Date(v.capturedAt).toLocaleString()}</p>}
          </dl>
        )}
        renderEdit={(draft, setDraft) => (
          <div className="space-y-4">
            <SelectField label="Result" value={draft.result} onChange={(e) => setDraft({ ...draft, result: e.target.value as OutcomeResult })}>
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
            <TextareaField
              label="Client reactions"
              value={draft.clientReactions}
              onChange={(e) => setDraft({ ...draft, clientReactions: e.target.value })}
            />
            <ObjectionsEncounteredEditor
              items={draft.objectionsEncountered}
              onChange={(objectionsEncountered) => setDraft({ ...draft, objectionsEncountered })}
            />
            <TextareaField label="Lessons learned" value={draft.lessonsLearned} onChange={(e) => setDraft({ ...draft, lessonsLearned: e.target.value })} />
            <TextareaField label="Next steps" value={draft.nextSteps} onChange={(e) => setDraft({ ...draft, nextSteps: e.target.value })} />
          </div>
        )}
      />
    </div>
  );
}
