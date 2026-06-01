import { useMemo, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Exception Heat Map — Ops Overview section
 *
 * A two-dimensional read of where today's mandates are NOT clean:
 *
 *   rows  = exception types  (what went wrong)
 *   cols  = pipeline stages  (where in the day it went wrong)
 *   cell  = severity of the non-clean mandates at that intersection
 *
 * Two encodings, switchable:
 *
 *   "Severity"   — hue carries severity (the house rule). Clean is neutral
 *                  grey; the eye is only pulled to amber and red. The cell
 *                  count is the number of non-clean mandates.
 *
 *   "SLA breach" — hue is dropped entirely. SLA breach is encoded with
 *                  LIGHT / DARK shading plus an ICON only (a neutral mono
 *                  ramp, darker = more breaches, ▲ on any breach). This
 *                  keeps the breach read colour-blind safe and stops it
 *                  competing with the severity hues.
 *
 * Tailwind stands in for SSDS here; swap the palette when porting.
 * ------------------------------------------------------------------ */

/* ---------- Model ---------- */

type ExceptionType =
  | "late_files"
  | "stale_pricing"
  | "abnormal_trade_values"
  | "validation_failures"
  | "matching_delays";

type StageKey =
  | "actuals"
  | "estimates"
  | "rebalance"
  | "trades_generated"
  | "trades_executed"
  | "matched"
  | "reporting"
  | "nav_rules";

type CellSeverity = "clean" | "typical" | "required" | "benchmark";

type Cell = {
  severity: CellSeverity;
  /** number of non-clean mandates at this exception × stage */
  affected: number;
  /** subset of `affected` that have breached their SLA */
  slaBreached: number;
  /** sample mandate names, for the detail panel */
  mandates: string[];
};

const ROWS: { key: ExceptionType; label: string }[] = [
  { key: "late_files", label: "Late Files" },
  { key: "stale_pricing", label: "Stale Pricing" },
  { key: "abnormal_trade_values", label: "Abnormal Trade Values" },
  { key: "validation_failures", label: "Validation Failures" },
  { key: "matching_delays", label: "Matching Delays" },
];

const COLS: { key: StageKey; label: string }[] = [
  { key: "actuals", label: "Actuals" },
  { key: "estimates", label: "Estimates" },
  { key: "rebalance", label: "Rebalance" },
  { key: "trades_generated", label: "Trades Generated" },
  { key: "trades_executed", label: "Trades Executed" },
  { key: "matched", label: "Matched" },
  { key: "reporting", label: "Reporting" },
  { key: "nav_rules", label: "NAV Rules" },
];

/* ---------- Fixture (§ hand-authored so today reads as a story) ----------
 *
 * Most intersections are clean (grey). A handful of hotspots:
 *   - Late Files at Actuals is the headline — 3 mandates, 2 breaching.
 *   - Validation Failures bite hardest at NAV Rules (escalation).
 *   - Matching Delays cluster at Matched.
 * Only non-clean cells are listed; everything else defaults to clean.
 */

const C = (
  severity: CellSeverity,
  affected: number,
  slaBreached: number,
  mandates: string[],
): Cell => ({ severity, affected, slaBreached, mandates });

const CLEAN: Cell = { severity: "clean", affected: 0, slaBreached: 0, mandates: [] };

const GRID: Partial<Record<ExceptionType, Partial<Record<StageKey, Cell>>>> = {
  late_files: {
    actuals: C("benchmark", 3, 2, [
      "Cohen & Steers · Capstock",
      "JP Morgan AM · Liquidity Fund",
      "PIMCO · Income Fund",
    ]),
    estimates: C("required", 1, 0, ["Fidelity · Global Bond"]),
  },
  stale_pricing: {
    rebalance: C("typical", 1, 0, ["Vanguard · Unrealized P&L"]),
    reporting: C("typical", 1, 0, ["BlackRock · Equity Index"]),
    nav_rules: C("required", 2, 1, [
      "iShares · STT Daily NAV",
      "State Street GA · GX Multi-Asset",
    ]),
  },
  abnormal_trade_values: {
    trades_generated: C("required", 2, 0, [
      "iShares · STT Daily NAV",
      "Vanguard · Unrealized P&L",
    ]),
    trades_executed: C("benchmark", 1, 1, ["State Street GA · GX Multi-Asset"]),
  },
  validation_failures: {
    estimates: C("typical", 1, 0, ["PIMCO · Income Fund"]),
    trades_generated: C("required", 1, 0, ["BlackRock · Equity Index"]),
    reporting: C("required", 1, 0, ["State Street GA · GX Multi-Asset"]),
    nav_rules: C("benchmark", 2, 1, [
      "iShares · STT Daily NAV",
      "Cohen & Steers · Capstock",
    ]),
  },
  matching_delays: {
    trades_executed: C("typical", 1, 0, ["Fidelity · Global Bond"]),
    matched: C("required", 3, 1, [
      "JP Morgan AM · Liquidity Fund",
      "iShares · STT Daily NAV",
      "PIMCO · Income Fund",
    ]),
  },
};

function cellAt(row: ExceptionType, col: StageKey): Cell {
  return GRID[row]?.[col] ?? CLEAN;
}

/* ---------- Encodings ---------- */

type Mode = "severity" | "sla";

/** Severity mode — hue carries severity. Clean is neutral grey. */
function severityAppearance(cell: Cell): { cls: string; faint: boolean } {
  switch (cell.severity) {
    case "clean":
      return { cls: "bg-neutral-100 text-neutral-300", faint: true };
    case "typical":
      return { cls: "bg-yellow-200 text-yellow-900", faint: false };
    case "required":
      return { cls: "bg-amber-400 text-amber-950", faint: false };
    case "benchmark":
      return { cls: "bg-red-500 text-white", faint: false };
  }
}

/** SLA-breach mode — NO hue. Light/dark neutral ramp + an icon only. */
function slaAppearance(cell: Cell): {
  cls: string;
  faint: boolean;
  icon: boolean;
} {
  if (cell.slaBreached <= 0) {
    // Non-clean but within SLA stays pale; clean is paler still.
    return cell.affected > 0
      ? { cls: "bg-neutral-200 text-neutral-500", faint: false, icon: false }
      : { cls: "bg-neutral-50 text-neutral-300", faint: true, icon: false };
  }
  if (cell.slaBreached === 1)
    return { cls: "bg-neutral-500 text-white", faint: false, icon: true };
  if (cell.slaBreached === 2)
    return { cls: "bg-neutral-700 text-white", faint: false, icon: true };
  return { cls: "bg-neutral-900 text-white", faint: false, icon: true };
}

const SEVERITY_LABEL: Record<CellSeverity, string> = {
  clean: "Clean",
  typical: "Watch",
  required: "Act now",
  benchmark: "Escalate",
};

/* ---------- Component ---------- */

type Selected = { row: ExceptionType; col: StageKey } | null;

export default function ExceptionHeatmap() {
  const [mode, setMode] = useState<Mode>("severity");
  const [selected, setSelected] = useState<Selected>(null);
  const [hover, setHover] = useState<{
    row: ExceptionType | null;
    col: StageKey | null;
  }>({ row: null, col: null });

  // Roll-ups for the summary line + axis totals.
  const totals = useMemo(() => {
    let affected = 0;
    let breached = 0;
    let worst: CellSeverity = "clean";
    const rank: Record<CellSeverity, number> = {
      clean: 0,
      typical: 1,
      required: 2,
      benchmark: 3,
    };
    for (const r of ROWS) {
      for (const c of COLS) {
        const cell = cellAt(r.key, c.key);
        affected += cell.affected;
        breached += cell.slaBreached;
        if (rank[cell.severity] > rank[worst]) worst = cell.severity;
      }
    }
    return { affected, breached, worst };
  }, []);

  const rowTotals = useMemo(
    () =>
      Object.fromEntries(
        ROWS.map((r) => [
          r.key,
          COLS.reduce(
            (acc, c) => {
              const cell = cellAt(r.key, c.key);
              return {
                affected: acc.affected + cell.affected,
                breached: acc.breached + cell.slaBreached,
              };
            },
            { affected: 0, breached: 0 },
          ),
        ]),
      ) as Record<ExceptionType, { affected: number; breached: number }>,
    [],
  );

  const selectedCell = selected ? cellAt(selected.row, selected.col) : null;
  const gridTemplate = `200px repeat(${COLS.length}, minmax(46px, 1fr)) 64px`;

  const summary =
    totals.affected === 0
      ? "All mandates clean across every stage."
      : `${totals.affected} non-clean mandate${totals.affected === 1 ? "" : "s"} across ${ROWS.length} exception types` +
        (totals.breached > 0
          ? ` · ${totals.breached} SLA breach${totals.breached === 1 ? "" : "es"}.`
          : ".");

  return (
    <section aria-label="Exception heat map" className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
          Exception Heat Map
        </h2>
        <span className="text-xs text-neutral-400">{summary}</span>

        {/* Mode toggle */}
        <div className="ml-auto flex items-center gap-0.5 rounded-full border border-neutral-300 p-0.5">
          {(
            [
              { v: "severity", label: "Severity" },
              { v: "sla", label: "SLA breach" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                mode === o.v
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Legend mode={mode} />
      </div>

      <div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
        <div
          className="grid min-w-[760px] text-xs"
          style={{ gridTemplateColumns: gridTemplate }}
          onMouseLeave={() => setHover({ row: null, col: null })}
        >
          {/* Header row */}
          <div className="sticky left-0 z-20 flex items-center border-b border-neutral-200 bg-white px-3 py-2 font-semibold tracking-wide text-neutral-500 uppercase">
            Exception
          </div>
          {COLS.map((c) => {
            const colHover = hover.col === c.key;
            return (
              <div
                key={c.key}
                className={`border-b border-neutral-200 px-1 py-2 text-center text-[10px] leading-tight font-medium ${
                  colHover ? "bg-neutral-100 text-neutral-700" : "text-neutral-400"
                }`}
              >
                {c.label}
              </div>
            );
          })}
          <div className="border-b border-l border-neutral-200 bg-white px-1 py-2 text-center text-[10px] font-medium text-neutral-400">
            Total
          </div>

          {/* Body rows */}
          {ROWS.map((r) => {
            const rowHover = hover.row === r.key;
            const rt = rowTotals[r.key];
            return (
              <div key={r.key} className="contents">
                {/* Sticky row label */}
                <div
                  onMouseEnter={() => setHover({ row: r.key, col: hover.col })}
                  className={`sticky left-0 z-10 flex items-center border-t border-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-800 ${
                    rowHover ? "bg-neutral-100" : "bg-white"
                  }`}
                >
                  {r.label}
                </div>

                {/* Cells */}
                {COLS.map((c) => {
                  const cell = cellAt(r.key, c.key);
                  const app =
                    mode === "severity"
                      ? severityAppearance(cell)
                      : slaAppearance(cell);
                  const icon = mode === "sla" && "icon" in app && app.icon === true;
                  const isSel =
                    selected?.row === r.key && selected?.col === c.key;
                  const interactive = cell.affected > 0;
                  const display =
                    mode === "severity"
                      ? cell.affected || ""
                      : cell.slaBreached || (cell.affected ? "·" : "");
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={!interactive}
                      onMouseEnter={() => setHover({ row: r.key, col: c.key })}
                      onClick={() =>
                        interactive && setSelected({ row: r.key, col: c.key })
                      }
                      title={`${r.label} · ${c.label} — ${
                        cell.affected === 0
                          ? "clean"
                          : `${cell.affected} non-clean (${SEVERITY_LABEL[cell.severity]})${
                              cell.slaBreached > 0
                                ? ` · ${cell.slaBreached} SLA breach`
                                : ""
                            }`
                      }`}
                      className={`relative m-px flex h-9 items-center justify-center gap-0.5 rounded-[3px] text-[11px] font-bold tabular-nums transition ${app.cls} ${
                        interactive ? "hover:brightness-95" : "cursor-default"
                      } ${isSel ? "outline outline-2 outline-blue-500" : ""}`}
                    >
                      {icon && (
                        <span aria-hidden className="text-[9px] leading-none">
                          ▲
                        </span>
                      )}
                      <span>{display}</span>
                    </button>
                  );
                })}

                {/* Row total */}
                <div className="flex items-center justify-center border-t border-l border-neutral-100 bg-white px-1 font-mono text-[10px] font-medium text-neutral-500">
                  {mode === "severity"
                    ? rt.affected || "—"
                    : rt.breached || "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected-cell detail */}
      {selected && selectedCell && (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900">
              {ROWS.find((r) => r.key === selected.row)!.label}
            </span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-600">
              {COLS.find((c) => c.key === selected.col)!.label}
            </span>
            <SeverityBadge severity={selectedCell.severity} />
            {selectedCell.slaBreached > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-400 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                <span aria-hidden>▲</span>
                {selectedCell.slaBreached} SLA breach
                {selectedCell.slaBreached === 1 ? "" : "es"}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-700"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {selectedCell.affected} non-clean mandate
            {selectedCell.affected === 1 ? "" : "s"} at this stage.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {selectedCell.mandates.map((m) => (
              <li
                key={m}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700"
              >
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ---------- Atoms ---------- */

function SeverityBadge({ severity }: { severity: CellSeverity }) {
  const map: Record<CellSeverity, string> = {
    clean: "border-neutral-300 bg-neutral-50 text-neutral-500",
    typical: "border-yellow-300 bg-yellow-50 text-yellow-800",
    required: "border-amber-300 bg-amber-50 text-amber-800",
    benchmark: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function Legend({ mode }: { mode: Mode }): ReactNode {
  const items =
    mode === "severity"
      ? [
          { cls: "bg-neutral-100", label: "Clean" },
          { cls: "bg-yellow-200", label: "Watch" },
          { cls: "bg-amber-400", label: "Act now" },
          { cls: "bg-red-500", label: "Escalate" },
        ]
      : [
          { cls: "bg-neutral-50", label: "Clean" },
          { cls: "bg-neutral-200", label: "Within SLA" },
          { cls: "bg-neutral-500", label: "▲ 1 breach" },
          { cls: "bg-neutral-900", label: "▲ 3+" },
        ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-[2px] ${it.cls}`} />
          <span className="text-[10px] text-neutral-400">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
