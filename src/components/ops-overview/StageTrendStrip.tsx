import { useEffect, useMemo, useState } from "react";
import {
  getStageTrends,
  STAGE_NAMES,
  type WindowDays,
} from "../../lib/trend-data";
import StageTrendColumn from "./StageTrendColumn";
import TrendWindowSelector from "./TrendWindowSelector";
import HistoricalDayDrawer from "./HistoricalDayDrawer";

/* Spec — Stage Trend Strip.
 *
 * Sits directly below the MandateGrid. Column widths match the grid
 * (240px mandate + 56px region + flex-1 stage area + 60px age) so each
 * stage sparkline aligns under its grid column above.
 *
 * Spec §11.8 — strip must read as quieter than the grid. Outer container
 * uses near-neutral surface tones; sparkline bars are muted grey for
 * past, severity-tinted only for today.
 */

const URL_PARAM = "trend";

function readUrlWindow(): WindowDays | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
  const n = parseInt(raw ?? "", 10);
  if (n === 7 || n === 14 || n === 30 || n === 90) return n;
  return null;
}

function writeUrlWindow(win: WindowDays) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, String(win));
  window.history.replaceState({}, "", url.toString());
}

export default function StageTrendStrip({
  fixtureKey,
}: {
  fixtureKey: "clean" | "watch" | "at-risk" | "broken";
}) {
  const [win, setWin] = useState<WindowDays>(() => readUrlWindow() ?? 14);
  const [drilledDate, setDrilledDate] = useState<string | null>(null);
  const [drilledStage, setDrilledStage] = useState<string | null>(null);

  useEffect(() => {
    writeUrlWindow(win);
  }, [win]);

  const trends = useMemo(
    () => getStageTrends(win, fixtureKey),
    [win, fixtureKey],
  );

  return (
    <section
      aria-label="Stage trend"
      className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50/40"
    >
      {/* Header row aligned to the grid: same outer padding */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-4 py-2">
        <h3 className="text-[11px] font-semibold tracking-widest text-neutral-500 uppercase">
          Trend · last {win} trading days
        </h3>
        <TrendWindowSelector value={win} onChange={setWin} />
      </div>

      {/* Body row — column widths mirror MandateGrid for vertical alignment */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Mandate-column spacer */}
        <div className="w-[240px] shrink-0" />
        {/* Region-column spacer */}
        <div className="w-[56px] shrink-0" />
        {/* Stage columns — flex-1 mirrors MandateGrid's gap-px stage row */}
        <div className="flex flex-1 gap-px">
          {trends.map((t, i) => (
            <StageTrendColumn
              key={STAGE_NAMES[i]}
              data={t}
              onPastDayClick={(date) => {
                setDrilledDate(date);
                setDrilledStage(t.stage);
              }}
            />
          ))}
        </div>
        {/* Age-column spacer */}
        <div className="w-[60px] shrink-0" />
      </div>

      {drilledDate && (
        <HistoricalDayDrawer
          date={drilledDate}
          stage={drilledStage ?? undefined}
          onClose={() => {
            setDrilledDate(null);
            setDrilledStage(null);
          }}
        />
      )}
    </section>
  );
}
