import { CLIENTS, fmtMoney } from "../../lib/pitch/data";
import type { Client } from "../../lib/pitch/types";

const SEGMENT_TONE: Record<Client["segment"], string> = {
  Retail: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  Affluent: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  HNW: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Institutional: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
};

export function ClientPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {CLIENTS.map((c) => {
        const selected = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={selected}
            className={`flex flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 ${
              selected
                ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-900">{c.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEGMENT_TONE[c.segment]}`}>
                {c.segment}
              </span>
            </div>
            <p className="text-xs text-neutral-500">{c.primaryGoal}</p>
            <div className="mt-1 flex w-full items-center justify-between text-[11px] text-neutral-400">
              <span>
                AUM <span className="font-mono font-medium text-neutral-600">{fmtMoney(c.aum)}</span>
              </span>
              <span>
                Risk <span className="font-medium text-neutral-600">{c.riskProfile}</span>
              </span>
              <span>Advisor {c.advisor}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
