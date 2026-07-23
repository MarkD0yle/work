import { useState } from "react";
import { ClientPicker } from "../../pitch/ClientPicker";
import { SelectField, TextField, TextareaField } from "../../forms";
import { newOpportunity } from "../../../lib/pitchPerfect/opportunity";
import type { Opportunity, PitchType } from "../../../lib/pitchPerfect/types";

const PITCH_TYPES: PitchType[] = ["New business", "Upsell", "Renewal", "Win-back", "RFP response"];

/* The create-opportunity form, inline on the page as its own tab rather than
 * a modal — same fields/behavior as the old NewOpportunityForm dialog. */
export function NewOpportunityTab({ onCreate, onCancel }: { onCreate: (opportunity: Opportunity) => void; onCancel: () => void }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [pitchType, setPitchType] = useState<PitchType>("New business");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [scope, setScope] = useState("");

  function reset() {
    setClientId(null);
    setPitchType("New business");
    setName("");
    setObjective("");
    setScope("");
  }

  function submit() {
    if (!clientId) return;
    const opportunity = newOpportunity(clientId, {
      name: name.trim(),
      pitchType,
      objective: objective.trim(),
      scope: scope.trim(),
    });
    reset();
    onCreate(opportunity);
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">New opportunity</h1>
        <p className="mt-0.5 text-xs text-neutral-500">Define the opportunity to start the prepare-deliver-learn loop.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-neutral-600 uppercase">Client</div>
            <div className="mt-1.5">
              <ClientPicker selectedId={clientId} onSelect={setClientId} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harrington Trust — Q3 review" />
            <SelectField label="Pitch type" value={pitchType} onChange={(e) => setPitchType(e.target.value as PitchType)}>
              {PITCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectField>
          </div>

          <TextareaField
            label="Objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="What is this pitch trying to achieve?"
          />
          <TextareaField
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="What's covered in this opportunity?"
          />

          <div className="flex items-center gap-2 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={submit}
              disabled={!clientId}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create opportunity
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                onCancel();
              }}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
