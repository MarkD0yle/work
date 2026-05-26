import type { OperationalState } from "../../lib/qlik";

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PageHeader({
  now,
  fixtureKey,
  onFixtureChange,
}: {
  now: number;
  fixtureKey: OperationalState;
  onFixtureChange: (s: OperationalState) => void;
}) {
  const dateStr = new Date(now).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          Ops Overview
        </span>
        <span className="text-sm text-neutral-400">·</span>
        <span className="text-sm text-neutral-500">{dateStr}</span>
        <span className="font-mono text-sm text-neutral-500">
          · {formatClock(now)} EST
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] font-medium tracking-widest text-neutral-400 uppercase">
          Mock Qlik feed
        </span>
        <div className="flex items-center gap-1 rounded-full border border-neutral-300 p-0.5">
          {(["clean", "at-risk", "broken"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onFixtureChange(s)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize transition ${
                fixtureKey === s
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
