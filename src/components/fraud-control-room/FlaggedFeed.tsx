import type { CSSProperties } from "react";
import { CHANNELS, MCCS, SCHEMES, type FeedRow } from "./model";
import { C, fmtInt, gbpExact, hhmmss } from "./theme";
import { EmptyState, Panel } from "./ui";

/* The signature panel: flagged transactions streaming in at the top, each
 * with its risk score and the rule that caught it, and a decision the
 * analyst can make on the spot. New rows slide in (unless paused or reduced
 * motion); decided rows dim and carry a tag. */

export type Decision = "approve" | "decline" | "escalate";

const DECISIONS: { id: Decision; label: string; glyph: string; color: string; done: string }[] = [
  { id: "approve", label: "Approve", glyph: "✓", color: C.good, done: "Approved" },
  { id: "decline", label: "Decline", glyph: "✕", color: C.bad, done: "Declined" },
  { id: "escalate", label: "Escalate", glyph: "↑", color: C.warn, done: "Escalated" },
];

function riskBand(score: number) {
  if (score >= 800) return { label: "High", color: C.bad };
  if (score >= 600) return { label: "Med", color: C.warn };
  return { label: "Low", color: C.good };
}

const COLS: { label: string; width?: number; align?: "right" }[] = [
  { label: "Time", width: 74 },
  { label: "Card", width: 82 },
  { label: "Merchant" },
  { label: "MCC group", width: 110 },
  { label: "Ctry", width: 42 },
  { label: "Amount", width: 82, align: "right" },
  { label: "Risk score", width: 124 },
  { label: "Rule hit" },
  { label: "Decision", width: 214 },
];

const ROW_H = 28;

export function FlaggedFeed({
  rows,
  dataSec,
  animate,
  decisions,
  onDecide,
  alertsInWindow,
  windowLabel,
  empty,
  className,
  style,
}: {
  rows: FeedRow[];
  dataSec: number;
  animate: boolean;
  decisions: Record<number, Decision>;
  onDecide: (id: number, d: Decision | null) => void;
  alertsInWindow: number;
  windowLabel: string;
  empty: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const tally = DECISIONS.map((d) => ({
    ...d,
    n: Object.values(decisions).filter((x) => x === d.id).length,
  }));
  const total = tally.reduce((s, t) => s + t.n, 0);

  return (
    <Panel
      className={className}
      style={style}
      title="Flagged transactions"
      meta={
        empty ? undefined : (
          <>
            live queue · latest {rows.length} of{" "}
            <span className="font-mono tabular-nums" style={{ color: C.t1 }}>
              {fmtInt(alertsInWindow)}
            </span>{" "}
            live-rule alerts in {windowLabel}
          </>
        )
      }
      right={
        <div className="flex items-center gap-2 text-[10px]" aria-live="polite">
          <span className="font-semibold tracking-widest uppercase" style={{ color: C.t2 }}>
            Decisions this session
          </span>
          {tally.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono tabular-nums"
              style={{ borderColor: C.line2, color: C.t1 }}
              title={`${t.done}: ${t.n}`}
            >
              <span aria-hidden="true" style={{ color: t.color }}>
                {t.glyph}
              </span>
              <span className="sr-only">{t.done}</span>
              {t.n}
            </span>
          ))}
          <span className="font-mono tabular-nums" style={{ color: C.t2 }}>
            = {total}
          </span>
        </div>
      }
    >
      {empty ? (
        <EmptyState>Select at least one scheme to see flagged transactions.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No flagged transactions for this slice in the last {windowLabel}.</EmptyState>
      ) : (
        <table className="w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            {COLS.map((c) => (
              <col key={c.label} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: 24 }}>
              {COLS.map((c, i) => (
                <th
                  key={c.label}
                  scope="col"
                  className={`border-b text-[10px] font-semibold tracking-wider uppercase ${
                    c.align === "right" ? "text-right" : "text-left"
                  } ${i === 0 ? "pl-3" : "px-2"}`}
                  style={{ color: C.t2, borderColor: C.line }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const decided = decisions[r.id];
              const dd = DECISIONS.find((d) => d.id === decided);
              const band = riskBand(r.score);
              const fresh = animate && dataSec - r.t <= 1;
              const dim: CSSProperties = decided ? { opacity: 0.42 } : {};
              const cell = "border-b px-2 whitespace-nowrap overflow-hidden text-ellipsis";
              return (
                <tr
                  key={r.id}
                  className={`fcr-row ${fresh ? "fcr-row-in" : ""}`}
                  style={{ height: ROW_H }}
                >
                  <td className={`${cell} pl-3 font-mono tabular-nums`} style={{ borderColor: C.line, color: C.t2, ...dim }}>
                    {hhmmss(r.t)}
                  </td>
                  <td className={`${cell} font-mono tabular-nums`} style={{ borderColor: C.line, color: C.t1, ...dim }}>
                    <span style={{ color: C.t3 }}>••••</span> {r.pan}
                  </td>
                  <td className={cell} style={{ borderColor: C.line, color: C.t1, ...dim }} title={r.merchant}>
                    {r.merchant}
                    <span className="ml-1.5 text-[10px]" style={{ color: C.t3 }}>
                      {CHANNELS[r.ch].short} · {SCHEMES[r.sch].short}
                    </span>
                  </td>
                  <td className={cell} style={{ borderColor: C.line, color: C.t2, ...dim }}>
                    {MCCS[r.m]}
                  </td>
                  <td
                    className={`${cell} font-mono`}
                    style={{ borderColor: C.line, color: r.country === "GB" ? C.t2 : C.t1, ...dim }}
                  >
                    {r.country}
                  </td>
                  <td className={`${cell} text-right font-mono tabular-nums`} style={{ borderColor: C.line, color: C.t1, ...dim }}>
                    {gbpExact(r.amount)}
                  </td>
                  <td className={cell} style={{ borderColor: C.line, ...dim }}>
                    <div className="flex items-center gap-1.5" title={`${band.label} risk: ${r.score} of 999`}>
                      <div className="h-1.5 w-14 shrink-0" style={{ background: C.line2 }}>
                        <div className="h-full" style={{ width: `${(r.score / 999) * 100}%`, background: band.color }} />
                      </div>
                      <span className="font-mono tabular-nums" style={{ color: C.t1 }}>
                        {r.score}
                      </span>
                      <span className="text-[9px] font-semibold tracking-wider uppercase" style={{ color: C.t2 }}>
                        {band.label}
                      </span>
                    </div>
                  </td>
                  <td className={cell} style={{ borderColor: C.line, color: C.t1, ...dim }} title={`${r.rule.id} ${r.rule.name}`}>
                    <span className="font-mono" style={{ color: C.t2 }}>
                      {r.rule.id}
                    </span>{" "}
                    {r.rule.name}
                  </td>
                  <td className="border-b px-2" style={{ borderColor: C.line }}>
                    {dd ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase"
                          style={{ borderColor: dd.color, color: C.t1 }}
                        >
                          <span aria-hidden="true" style={{ color: dd.color }}>
                            {dd.glyph}
                          </span>
                          {dd.done}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDecide(r.id, null)}
                          className="fcr-focus text-[10px] underline-offset-2 hover:underline"
                          style={{ color: C.t2 }}
                          aria-label={`Undo decision on card ending ${r.pan} at ${r.merchant}`}
                        >
                          Undo
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1" role="group" aria-label={`Decide card ending ${r.pan}`}>
                        {DECISIONS.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => onDecide(r.id, d.id)}
                            className="fcr-btn fcr-focus inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                            aria-label={`${d.label} card ending ${r.pan} at ${r.merchant}, ${gbpExact(r.amount)}`}
                          >
                            <span aria-hidden="true" style={{ color: d.color }}>
                              {d.glyph}
                            </span>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
