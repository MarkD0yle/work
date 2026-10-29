import { useState, type KeyboardEvent } from "react";
import {
  AGES,
  N,
  fmtFactor,
  fmtNum,
  fmtPct,
  fmtSigned,
  lastJ,
  type Basis,
  type TabView,
} from "./model";
import { FOCUS, MicroLabel } from "./ui";

/* Loss development triangle.
 *
 * A plain HTML table rather than a chart: the committee reads the numbers,
 * and the colour is only there to point at the links worth reading. Known
 * cells are shaded on a diverging scale by how their link ratio compares with
 * the column's volume-weighted average; the lower-right is the chain-ladder
 * completion, hatched and italic so it can never be mistaken for data.
 */

export type TriangleMode = "cum" | "factor";

/* Diverging scale: indigo = develops faster than average (smaller link),
 * orange = slower / adverse (bigger link), neutral gray midpoint. */
const DIV = ["#a5b4fc", "#c7d2fe", "#e0e7ff", "#f5f5f5", "#ffedd5", "#fed7aa", "#fdba74"];
const DIV_LABEL = ["≤ −30%", "−30 to −15%", "−15 to −5%", "within ±5%", "+5 to +15%", "+15 to +30%", "≥ +30%"];
const HATCH =
  "repeating-linear-gradient(135deg, rgba(13,148,136,0.10) 0 3px, rgba(255,255,255,0) 3px 7px)";

/** Share of the column's average incremental development: 0.38 = 38% more.
 *  The 0.03 floor keeps tiny late links (1.002 vs 1.004) from reading as
 *  dramatic when they barely move the ultimate. */
function deviation(f: number, avg: number) {
  return (f - avg) / Math.max(avg - 1, 0.03);
}
function bucket(d: number) {
  if (d <= -0.3) return 0;
  if (d <= -0.15) return 1;
  if (d <= -0.05) return 2;
  if (d < 0.05) return 3;
  if (d < 0.15) return 4;
  if (d < 0.3) return 5;
  return 6;
}

interface CellInfo {
  known: boolean;
  text: string;
  shade: number | null;
  /** Link ratio the cell is judged on, with its column average. */
  link: number | null;
  avg: number | null;
  from: number;
  to: number | "Ult";
  cum: number | null;
  sel: number | null;
}

function cellInfo(view: TabView, i: number, j: number, mode: TriangleMode): CellInfo {
  const { cl } = view;
  const L = lastJ(i);
  if (mode === "cum") {
    const known = j <= L;
    const link = j >= 1 && known ? cl.link[i][j - 1] : null;
    const avg = j >= 1 ? cl.vwa[j - 1] : null;
    return {
      known,
      text: fmtNum(cl.cum[i][j], 1),
      shade: link != null && avg != null ? bucket(deviation(link, avg)) : null,
      link,
      avg,
      from: j >= 1 ? AGES[j - 1] : AGES[0],
      to: AGES[j],
      cum: cl.cum[i][j],
      sel: j >= 1 ? cl.sel[j - 1] : null,
    };
  }
  const tail = j === N - 1;
  const known = !tail && j + 1 <= L;
  const link = known ? cl.link[i][j] : null;
  const avg = tail ? null : cl.vwa[j];
  return {
    known,
    text: fmtFactor(known && link != null ? link : cl.sel[j]),
    shade: link != null && avg != null ? bucket(deviation(link, avg)) : null,
    link,
    avg,
    from: AGES[j],
    to: tail ? "Ult" : AGES[j + 1],
    cum: null,
    sel: cl.sel[j],
  };
}

function Readout({ view, active, mode, basisLabel }: {
  view: TabView;
  active: { r: number; c: number } | null;
  mode: TriangleMode;
  basisLabel: string;
}) {
  const base = "flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 bg-neutral-900 px-3 py-2 font-mono text-[11px] text-neutral-300";
  if (!active || !view.inRange[active.r]) {
    return (
      <div className={base} aria-live="polite">
        <span className="font-sans text-neutral-400">
          Hover a cell, or focus the triangle and use the arrow keys, to read its link ratio against the column average.
        </span>
      </div>
    );
  }
  const row = view.inRange[active.r];
  const info = cellInfo(view, row.i, active.c, mode);
  const span = `${info.from}→${info.to === "Ult" ? "ult" : `${info.to}m`}`;
  const parts: { k: string; v: string; strong?: boolean }[] = [];
  let tag: string;
  if (info.known && info.link != null && info.avg != null) {
    const d = deviation(info.link, info.avg);
    parts.push({ k: "factor", v: fmtFactor(info.link), strong: true });
    parts.push({ k: "vs avg", v: fmtFactor(info.avg) });
    parts.push({
      k: "incremental dev",
      v: `${fmtSigned(d * 100, 0, "%")} vs avg`,
    });
    tag = Math.abs(d) < 0.05 ? "In line" : d < 0 ? "Faster than average" : "Slower than average";
  } else if (info.known) {
    tag = "First valuation, no link yet";
  } else {
    parts.push({ k: "selected", v: fmtFactor(info.sel ?? 1), strong: true });
    tag = "Projected (chain ladder)";
  }
  const shade = info.shade != null ? DIV[info.shade] : null;
  return (
    <div className={base} aria-live="polite">
      <span className="font-semibold text-white">AY {row.ay}</span>
      <span>{mode === "cum" && info.known && info.link == null ? "12m" : span}</span>
      {info.cum != null && (
        <span>
          <span className="text-neutral-500">{info.known ? basisLabel.toLowerCase() : "projected"} </span>
          £{fmtNum(info.cum, 1)}m
        </span>
      )}
      {parts.map((p) => (
        <span key={p.k}>
          <span className="text-neutral-500">{p.k} </span>
          <span className={p.strong ? "font-semibold text-white" : ""}>{p.v}</span>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-1.5 font-sans">
        {shade && <span className="inline-block h-2.5 w-2.5" style={{ background: shade }} />}
        {!info.known && <span className="inline-block h-2.5 w-2.5 border border-neutral-500" style={{ backgroundImage: HATCH }} />}
        {tag}
      </span>
    </div>
  );
}

export function TriangleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-neutral-500">
      <div className="flex items-center gap-2">
        <span>Link ratio vs column avg</span>
        <span className="text-neutral-700">Faster</span>
        <div className="flex gap-0.5" role="img" aria-label="Diverging scale from faster than average (indigo) through in line (gray) to slower than average (orange)">
          {DIV.map((c, k) => (
            <span key={c} title={DIV_LABEL[k]} className="h-3 w-5" style={{ background: c }} />
          ))}
        </div>
        <span className="text-neutral-700">Slower</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-5 border border-neutral-200" style={{ backgroundImage: HATCH }} />
        <span className="italic text-neutral-600">Projected</span>
      </div>
    </div>
  );
}

export function Triangle({
  view,
  mode,
  basis,
  from,
  to,
}: {
  view: TabView;
  mode: TriangleMode;
  basis: Basis;
  from: number;
  to: number;
}) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const rows = view.inRange;
  const { cl } = view;
  const basisLabel = basis === "paid" ? "Paid" : "Incurred";
  const safeActive = active && active.r < rows.length ? active : null;

  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const cur = safeActive ?? { r: rows.length - 1, c: 0 };
    let { r, c } = cur;
    switch (e.key) {
      case "ArrowUp": r = Math.max(0, r - 1); break;
      case "ArrowDown": r = Math.min(rows.length - 1, r + 1); break;
      case "ArrowLeft": c = Math.max(0, c - 1); break;
      case "ArrowRight": c = Math.min(N - 1, c + 1); break;
      case "Home": c = 0; break;
      case "End": c = N - 1; break;
      case "Escape": setActive(null); return;
      default: return;
    }
    e.preventDefault();
    setActive({ r, c });
  };

  const colHead = (j: number) =>
    mode === "cum" ? String(AGES[j]) : j === N - 1 ? "120–Ult" : `${AGES[j]}–${AGES[j + 1]}`;

  const totals = rows.reduce(
    (a, r) => ({ ult: a.ult + r.ult, ep: a.ep + r.ep, toDate: a.toDate + r.toDate, ibnr: a.ibnr + r.ibnr }),
    { ult: 0, ep: 0, toDate: 0, ibnr: 0 },
  );
  const anyFallback = cl.fallback.some(Boolean);
  const activeId = safeActive ? `tri-${rows[safeActive.r].ay}-${safeActive.c}` : undefined;
  // Crosshair as teal rules rather than a tint, so the diverging fills keep their hue.
  const rowRule = "inset 0 2px 0 rgba(13,148,136,0.55), inset 0 -2px 0 rgba(13,148,136,0.55)";
  const colRule = "inset 2px 0 0 rgba(13,148,136,0.55), inset -2px 0 0 rgba(13,148,136,0.55)";
  const hl = rowRule;

  const num = "px-2 py-1.5 text-right font-mono text-[11px] tabular-nums";
  const rightCols = [
    { key: "ult", label: "Ultimate" },
    { key: "ulr", label: "ULR" },
    { key: "td", label: `${basisLabel} to date` },
    { key: "ibnr", label: "IBNR" },
  ];

  return (
    <div>
      <Readout view={view} active={safeActive} mode={mode} basisLabel={basisLabel} />
      <div className="overflow-x-auto">
        <table
          role="grid"
          tabIndex={0}
          aria-label={`Loss development triangle, ${basisLabel.toLowerCase()} ${mode === "cum" ? "cumulative £m" : "age-to-age factors"}, accident years ${from} to ${to}`}
          aria-activedescendant={focused ? activeId : undefined}
          onKeyDown={onKey}
          onFocus={() => {
            setFocused(true);
            if (!safeActive && rows.length) setActive({ r: rows.length - 1, c: 0 });
          }}
          onBlur={() => {
            setFocused(false);
            setActive(null);
          }}
          onMouseLeave={() => {
            if (!focused) setActive(null);
          }}
          className={`w-full min-w-[1080px] border-separate text-neutral-900 ${FOCUS}`}
          style={{ borderSpacing: 2 }}
        >
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="w-16 px-2 pt-2 pb-1 text-left align-bottom">
                <MicroLabel>AY</MicroLabel>
              </th>
              <th scope="colgroup" colSpan={N} className="px-2 pt-2 text-left">
                <MicroLabel>
                  {mode === "cum" ? `Development month · cumulative ${basisLabel.toLowerCase()} £m` : "Development period · age-to-age factor"}
                </MicroLabel>
              </th>
              <th scope="colgroup" colSpan={4} className="border-l-2 border-neutral-200 px-2 pt-2 text-left">
                <MicroLabel>Reserve position · £m</MicroLabel>
              </th>
            </tr>
            <tr>
              {AGES.map((_, j) => (
                <th
                  key={j}
                  scope="col"
                  className={`px-2 py-1 text-right font-mono text-[10px] font-medium tabular-nums ${
                    safeActive?.c === j ? "bg-teal-50 text-teal-800" : "text-neutral-500"
                  }`}
                >
                  {colHead(j)}
                </th>
              ))}
              {rightCols.map((c, k) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-2 py-1 text-right text-[10px] font-medium text-neutral-500 ${k === 0 ? "border-l-2 border-neutral-200" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const rowOn = safeActive?.r === r;
              return (
                <tr key={row.ay}>
                  <th
                    scope="row"
                    className={`px-2 py-1.5 text-left font-mono text-[11px] font-semibold tabular-nums ${
                      rowOn ? "bg-teal-50 text-teal-800" : "text-neutral-700"
                    }`}
                  >
                    {row.ay}
                  </th>
                  {AGES.map((_, c) => {
                    const info = cellInfo(view, row.i, c, mode);
                    const isActive = rowOn && safeActive?.c === c;
                    const colOn = safeActive?.c === c;
                    const bg = info.known ? (info.shade != null ? DIV[info.shade] : "#ffffff") : "#ffffff";
                    return (
                      <td
                        key={c}
                        id={`tri-${row.ay}-${c}`}
                        aria-selected={isActive}
                        onMouseEnter={() => setActive({ r, c })}
                        className={`${num} cursor-default ${info.known ? "text-neutral-900" : "text-neutral-500 italic"}`}
                        style={{
                          background: bg,
                          backgroundImage: info.known ? undefined : HATCH,
                          boxShadow: isActive ? undefined : rowOn ? rowRule : colOn ? colRule : undefined,
                          outline: isActive ? "2px solid #0d9488" : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        {info.text}
                      </td>
                    );
                  })}
                  <td className={`${num} border-l-2 border-neutral-200 font-semibold`} style={{ boxShadow: rowOn ? hl : undefined }}>
                    {fmtNum(row.ult, 1)}
                  </td>
                  <td className={num} style={{ boxShadow: rowOn ? hl : undefined }}>
                    {fmtPct(row.ulr, 1)}
                  </td>
                  <td className={num} style={{ boxShadow: rowOn ? hl : undefined }}>
                    {fmtNum(row.toDate, 1)}
                  </td>
                  <td className={`${num} font-semibold`} style={{ boxShadow: rowOn ? hl : undefined }}>
                    {row.ibnr < 0 ? `−${fmtNum(-row.ibnr, 1)}` : fmtNum(row.ibnr, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={N + 1} className="border-t-2 border-neutral-200 px-2 py-1.5 text-right text-[11px] font-semibold text-neutral-700">
                Total · AY {from}–{to}
              </th>
              <td className={`${num} border-t-2 border-l-2 border-neutral-200 font-semibold`}>{fmtNum(totals.ult, 1)}</td>
              <td className={`${num} border-t-2 border-neutral-200`}>{fmtPct((totals.ult / totals.ep) * 100, 1)}</td>
              <td className={`${num} border-t-2 border-neutral-200`}>{fmtNum(totals.toDate, 1)}</td>
              <td className={`${num} border-t-2 border-neutral-200 font-semibold`}>{fmtNum(totals.ibnr, 1)}</td>
            </tr>
            {[
              { key: "vwa", label: "Vol-wtd avg", vals: [...cl.vwa, null] as (number | null)[] },
              { key: "sel", label: "Selected", vals: cl.sel as (number | null)[] },
              { key: "cdf", label: "CDF to ult", vals: cl.cdf as (number | null)[] },
            ].map((f) => (
              <tr key={f.key} className={f.key === "sel" ? "bg-teal-50/60" : ""}>
                <th scope="row" className="px-2 py-1 text-left text-[10px] font-semibold whitespace-nowrap text-neutral-600">
                  {f.label}
                </th>
                {f.vals.map((v, j) => (
                  <td
                    key={j}
                    className={`${num} py-1 ${f.key === "sel" ? "font-semibold text-neutral-900" : "text-neutral-600"} ${
                      safeActive?.c === j ? "bg-teal-50" : ""
                    }`}
                    title={
                      f.key === "vwa" && j < N - 1
                        ? cl.fallback[j]
                          ? "No accident year in range has this link; all-year average used"
                          : `Average of ${cl.vwaN[j]} accident year${cl.vwaN[j] === 1 ? "" : "s"}`
                        : f.key === "sel" && j === N - 1
                          ? "Tail factor beyond 120 months"
                          : undefined
                    }
                  >
                    {v == null ? (
                      <span className="text-neutral-300">tail</span>
                    ) : (
                      <>
                        {fmtFactor(v)}
                        {f.key === "vwa" && cl.fallback[j] && <span className="text-teal-700">†</span>}
                      </>
                    )}
                  </td>
                ))}
                <td colSpan={4} className="border-l-2 border-neutral-200 px-2 py-1 text-[10px] text-neutral-400">
                  {f.key === "vwa" && "age → next age, AYs in range"}
                  {f.key === "sel" && `rounded; last column is the tail`}
                  {f.key === "cdf" && "from this age to ultimate"}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {anyFallback && (
        <p className="px-3 pt-2 text-[10px] text-neutral-500">
          <span className="text-teal-700">†</span> No accident year in the selected range has reached this link, so the all-year volume-weighted average is used.
        </p>
      )}
    </div>
  );
}
