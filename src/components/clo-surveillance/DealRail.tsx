import { useMemo, useRef, type KeyboardEvent } from "react";
import { DEALS, type CoverageId, type DealId, type DealStatus, type DealView } from "./model";
import { FOCUS, STATUS_META, bps, eurBn, pct } from "./format";
import { MicroLabel, Swatch } from "./ui";

/* The left deal rail: the page's primary filter. One selectable row per
 * deal, ordered by how close its tightest coverage test sits to the
 * trigger, so the deal that needs attention is at the top. Arrow keys move
 * the selection; each row is a plain button with aria-pressed. */

const SHORT_TEST: Record<CoverageId, string> = {
  ocAB: "A/B OC",
  ocC: "C OC",
  ocD: "D OC",
  ocE: "E OC",
  icAB: "A/B IC",
  icC: "C IC",
  icD: "D IC",
};

const ORDER: DealStatus[] = ["fail", "thin", "pass"];

export function DealRail({
  views,
  selected,
  onSelect,
}: {
  views: Record<DealId, DealView>;
  selected: DealId;
  onSelect: (id: DealId) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const ordered = useMemo(
    () => DEALS.map((d) => views[d.id]).sort((a, b) => a.tightest.cushionBps - b.tightest.cushionBps),
    [views],
  );
  const counts = ORDER.map((s) => ({ status: s, n: ordered.filter((v) => v.status === s).length }));
  const collateral = ordered.reduce((s, v) => s + v.par, 0);
  const notes = ordered.reduce((s, v) => s + v.notesOutstanding, 0);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const idx = ordered.findIndex((v) => v.deal.id === selected);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = Math.min(ordered.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ordered.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(ordered[next].deal.id);
    listRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  return (
    <aside
      aria-label="Deals under surveillance"
      className="hidden shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex"
      style={{ width: 260 }}
    >
      <div className="border-b border-neutral-100 px-4 py-3">
        <MicroLabel>Deals under surveillance</MicroLabel>
        <div className="mt-0.5 text-xs text-neutral-700">
          {ordered.length} deals · {eurBn(collateral)} collateral · {eurBn(notes)} notes
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-label="Deals by status">
          {counts.map((c) => (
            <li key={c.status} className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600">
              <Swatch color={STATUS_META[c.status].color} className="h-2 w-2" />
              <span className="font-mono tabular-nums">{c.n}</span> {STATUS_META[c.status].label.toLowerCase()}
            </li>
          ))}
        </ul>
      </div>

      <ul
        ref={listRef}
        role="list"
        aria-label="Select a deal (arrow keys move the selection)"
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto"
      >
        {ordered.map((v) => {
          const on = v.deal.id === selected;
          const meta = STATUS_META[v.status];
          const dim = on ? "text-neutral-400" : "text-neutral-500";
          const strong = on ? "text-white" : "text-neutral-900";
          return (
            <li key={v.deal.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(v.deal.id)}
                className={`block w-full px-4 py-3 text-left transition ${FOCUS} ${
                  on ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Swatch color={meta.color} className="h-2 w-2" />
                  <span className="sr-only">{meta.label}: </span>
                  <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${strong}`}>{v.deal.name}</span>
                  <span className={`font-mono text-[10px] tabular-nums ${dim}`}>{v.deal.vintage}</span>
                </span>
                <span className={`mt-0.5 block truncate text-[10px] ${dim}`}>{v.deal.manager}</span>
                <span className="mt-2 grid grid-cols-2 gap-x-3">
                  <span className="min-w-0">
                    <span className={`block text-[9px] font-semibold tracking-widest uppercase ${dim}`}>
                      Reinvest
                    </span>
                    <span className={`block font-mono text-[11px] tabular-nums ${strong}`}>
                      {v.reinvestDaysLeft > 0 ? `${v.reinvestDaysLeft} days left` : "Ended"}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[9px] font-semibold tracking-widest uppercase ${dim}`}>
                      Last equity dist
                    </span>
                    <span className={`block font-mono text-[11px] tabular-nums ${strong}`}>
                      {v.lastCoc === null ? "—" : pct(v.lastCoc, 1)}
                    </span>
                  </span>
                </span>
                <span className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] ${dim}`}>
                  <span>Tightest · {SHORT_TEST[v.tightest.id]}</span>
                  <span className={`font-mono tabular-nums ${on ? "text-white" : "text-neutral-800"}`}>
                    {bps(v.tightest.cushionBps)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <MicroLabel>Status</MicroLabel>
        <ul className="mt-1 space-y-0.5 text-[10px] text-neutral-600">
          <li className="flex items-center gap-1.5">
            <Swatch color={STATUS_META.pass.color} className="h-2 w-2" /> All tests pass, cushions over 50 bps
          </li>
          <li className="flex items-center gap-1.5">
            <Swatch color={STATUS_META.thin.color} className="h-2 w-2" /> A coverage test within 50 bps of its trigger
          </li>
          <li className="flex items-center gap-1.5">
            <Swatch color={STATUS_META.fail.color} className="h-2 w-2" /> A coverage or quality test failing
          </li>
        </ul>
      </div>
    </aside>
  );
}
