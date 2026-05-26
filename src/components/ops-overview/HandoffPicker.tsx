import { TEAM, ME } from "../../lib/qlik";

/* Spec §2.3 — Hand off: opens user picker. Reassigns ack to another user.
 * The current actor cannot hand off to themselves. */

export default function HandoffPicker({
  currentActor,
  onCancel,
  onConfirm,
}: {
  currentActor: string;
  onCancel: () => void;
  onConfirm: (toUser: string) => void;
}) {
  const targets = TEAM.filter((u) => u.id !== currentActor);
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Hand off · from {currentActor}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-neutral-400 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {targets.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onConfirm(u.id)}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            {u.name}
            {u.id === ME && (
              <span className="ml-1 text-[9px] font-semibold tracking-wider text-blue-700 uppercase">
                me
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
