/* Spec §2.2 — Option A / Option B independent checkboxes.
 *
 * Stub semantics — stakeholder to confirm what these represent (spec §10). */

export default function OptionCheckboxes({
  optionA,
  optionB,
  onChange,
}: {
  optionA: boolean;
  optionB: boolean;
  onChange: (next: { optionA: boolean; optionB: boolean }) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 transition ${
          optionA
            ? "border-neutral-400 bg-white font-medium text-neutral-900"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
        }`}
        title="Option A — stub label, stakeholder to confirm semantics"
      >
        <input
          type="checkbox"
          checked={optionA}
          onChange={(e) =>
            onChange({ optionA: e.target.checked, optionB })
          }
          className="h-3.5 w-3.5 rounded border-neutral-300"
        />
        <span>Option A</span>
      </label>
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 transition ${
          optionB
            ? "border-neutral-400 bg-white font-medium text-neutral-900"
            : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
        }`}
        title="Option B — stub label, stakeholder to confirm semantics"
      >
        <input
          type="checkbox"
          checked={optionB}
          onChange={(e) =>
            onChange({ optionA, optionB: e.target.checked })
          }
          className="h-3.5 w-3.5 rounded border-neutral-300"
        />
        <span>Option B</span>
      </label>
    </div>
  );
}
