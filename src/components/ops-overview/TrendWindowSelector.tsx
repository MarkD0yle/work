import type { WindowDays } from "../../lib/trend-data";

/* Spec §3.3 — 7d / 14d / 30d / 90d selector. URL param syncs in parent. */

const OPTIONS: WindowDays[] = [7, 14, 30, 90];

export default function TrendWindowSelector({
  value,
  onChange,
}: {
  value: WindowDays;
  onChange: (v: WindowDays) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-300 bg-white p-0.5">
      {OPTIONS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            value === w
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {w}d
        </button>
      ))}
    </div>
  );
}
