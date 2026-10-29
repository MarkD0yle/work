import { useMemo, useState } from "react";
import { BUCKETS, DESTS, metrics as M, monthEnd, type Agg } from "./model";
import { ACCENT, HEAT, TONE_TEXT, gbp, heatOf, pct, signedPp, toneOf } from "./format";
import { Card } from "./chrome";

/* Roll-rate transition matrix: start-of-month bucket (rows) to month-end
 * destination (columns), as a share of the row's start balance. Diagonal
 * cells stayed put; cells right of the diagonal rolled forward. */

export function RollMatrixCard({ agg, asOf }: { agg: Agg; asOf: number }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const m = useMemo(() => {
    const cell = (i: number, j: number) => {
      const v = M.roll(agg, asOf, i, j);
      const avg = [1, 2, 3].reduce((s, d) => s + M.roll(agg, asOf - d, i, j), 0) / 3;
      return { v, avg, flow: M.flow(agg, asOf, i, j) };
    };
    return BUCKETS.map((_, i) => ({
      start: M.rowStart(agg, asOf, i),
      cells: DESTS.map((__, j) => cell(i, j)),
    }));
  }, [agg, asOf]);

  const head = m[2].cells[3];
  const headDelta = head.v - head.avg;
  const entry = m[0].cells[1];
  const writeOff = m[4].cells[5];
  const hov = hover ? { row: m[hover.r], cell: m[hover.r].cells[hover.c] } : null;

  return (
    <Card
      className="flex-1"
      title="Roll-rate matrix"
      subtitle={`Share of start-of-month balance by bucket at ${monthEnd(asOf)}`}
    >
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-sm text-neutral-800">
          <span className="font-semibold text-neutral-950">30–59 → 60–89 roll rate {pct(head.v, 1)}</span>{" "}
          <span className={`font-medium ${TONE_TEXT[toneOf(headDelta, false, 0.0005)]}`}>
            ({signedPp(headDelta, 1)} vs 3M avg)
          </span>
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Current → 1–29 entry{" "}
          <span className="font-mono text-neutral-800 tabular-nums">{pct(entry.v)}</span>{" "}
          <span className={TONE_TEXT[toneOf(entry.v - entry.avg, false, 0.00005)]}>
            {signedPp(entry.v - entry.avg)}
          </span>
          <span className="mx-2 text-neutral-300">|</span>
          90+ → charged off{" "}
          <span className="font-mono text-neutral-800 tabular-nums">{pct(writeOff.v, 1)}</span>
          <span className="mx-2 text-neutral-300">|</span>
          {gbp(m.reduce((s, r) => s + r.cells[5].flow, 0))} written off in month
        </p>
      </div>

      <div className="overflow-x-auto px-3 pt-3">
        <table
          className="w-full border-separate text-[11px]"
          style={{ borderSpacing: 2, tableLayout: "fixed" }}
          onMouseLeave={() => setHover(null)}
        >
          <caption className="sr-only">
            Roll-rate matrix: rows are the arrears bucket at the start of the month, columns the
            bucket at month end. Values are percentages of the row's start balance.
          </caption>
          <colgroup>
            <col style={{ width: 92 }} />
            {DESTS.map((d) => (
              <col key={d} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="pb-1 text-left align-bottom">
                <span className="block text-[9px] leading-tight font-semibold tracking-widest text-neutral-400 uppercase">
                  From ↓<br />
                  To →
                </span>
              </th>
              {DESTS.map((d, j) => (
                <th
                  key={d}
                  scope="col"
                  className={`px-1 pb-1 text-center align-bottom text-[10px] font-semibold leading-tight transition ${
                    hover?.c === j ? "text-indigo-700" : "text-neutral-500"
                  }`}
                >
                  {d}
                  {hover?.c === j && (
                    <span aria-hidden className="mx-auto mt-0.5 block h-[2px] w-6" style={{ background: ACCENT }} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.map((row, i) => (
              <tr key={BUCKETS[i]}>
                <th
                  scope="row"
                  className={`py-1 pr-2 text-left align-middle transition ${
                    hover?.r === i ? "text-indigo-700" : "text-neutral-700"
                  }`}
                  style={hover?.r === i ? { boxShadow: `inset 2px 0 0 ${ACCENT}` } : undefined}
                >
                  <div className="pl-1.5 text-[11px] font-semibold">{BUCKETS[i]}</div>
                  <div className="pl-1.5 font-mono text-[10px] font-normal text-neutral-400 tabular-nums">
                    {gbp(row.start)}
                  </div>
                </th>
                {row.cells.map((c, j) => {
                  const structural = c.flow === 0;
                  const h = heatOf(c.v);
                  const diag = i === j;
                  const forward = j > i;
                  const dim = hover !== null && hover.r !== i && hover.c !== j;
                  return (
                    <td
                      key={j}
                      tabIndex={structural ? undefined : 0}
                      onMouseEnter={() => setHover({ r: i, c: j })}
                      onFocus={() => setHover({ r: i, c: j })}
                      onBlur={() => setHover(null)}
                      aria-label={
                        structural
                          ? `${BUCKETS[i]} to ${DESTS[j]}: not possible in one month`
                          : `${BUCKETS[i]} to ${DESTS[j]}: ${pct(c.v, 1)}${diag ? ", stayed" : ""}`
                      }
                      className={`h-11 text-center align-middle font-mono tabular-nums transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        forward ? "font-semibold" : ""
                      }`}
                      style={{
                        background: structural ? "#fafafa" : h.bg,
                        color: structural ? "#d4d4d4" : h.ink,
                        opacity: dim ? 0.3 : 1,
                        outline: diag ? `1.5px solid ${h.ink}` : undefined,
                        outlineOffset: diag ? -5 : undefined,
                      }}
                    >
                      {structural ? "·" : pct(c.v, c.v < 0.1 ? 2 : 1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-3 pb-3">
        <div>
          <div className="mb-1 text-[10px] text-neutral-500">Share of start balance, %</div>
          <div className="flex" aria-hidden>
            {HEAT.map((h) => (
              <span key={h.bg} className="block h-2.5" style={{ width: 30, background: h.bg }} />
            ))}
          </div>
          <div className="relative mt-1 h-3 font-mono text-[9px] text-neutral-400 tabular-nums" style={{ width: HEAT.length * 30 }}>
            {["0", "0.5", "2", "5", "10", "20", "40", "60", "80", "100"].map((t, i) => (
              <span
                key={t}
                className="absolute"
                style={{
                  left: i * 30,
                  transform: i === 0 ? undefined : i === 9 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="sr-only">
            Shading scale from under 0.5% (lightest) to over 80% (darkest).
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="block h-3 w-4 bg-indigo-100" style={{ outline: "1.5px solid #262626", outlineOffset: -3 }} />
            Stayed in bucket
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="font-mono font-semibold text-neutral-800">0.0</span>
            Rolled forward (bold)
          </span>
        </div>
      </div>

      <div className="min-h-[44px] border-t border-neutral-100 bg-neutral-50/70 px-4 py-2.5 text-[11px] text-neutral-600" aria-live="polite">
        {hov && hover ? (
          hov.cell.flow === 0 ? (
            <span>
              {BUCKETS[hover.r]} → {DESTS[hover.c]}: not reachable in a single month.
            </span>
          ) : (
            <span>
              <span className="font-semibold text-neutral-900">
                {BUCKETS[hover.r]} → {DESTS[hover.c]}
              </span>
              : <span className="font-mono tabular-nums">{gbp(hov.cell.flow)}</span> of{" "}
              <span className="font-mono tabular-nums">{gbp(hov.row.start)}</span> ·{" "}
              <span className="font-mono font-semibold text-neutral-900 tabular-nums">{pct(hov.cell.v, 2)}</span>{" "}
              vs 3M avg <span className="font-mono tabular-nums">{pct(hov.cell.avg, 2)}</span>{" "}
              <span
                className={`font-medium ${
                  TONE_TEXT[
                    toneOf(hov.cell.v - hov.cell.avg, hover.c <= hover.r, 0.0002)
                  ]
                }`}
              >
                {signedPp(hov.cell.v - hov.cell.avg)}
              </span>
            </span>
          )
        ) : (
          <span>
            Hover or tab to a cell to trace a flow in pounds. Left of the outline is cure; right
            of it is roll-forward, the direction that drives future losses.
          </span>
        )}
      </div>
    </Card>
  );
}
