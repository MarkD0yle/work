import { Clock, Gavel, Lightbulb, ListChecks, Star, Trophy } from "lucide-react";
import { StudioShell } from "../components/fi-studio/StudioShell";
import { Badge, Card, Dialog, Row, Segmented, Stat, Takeaway, Term } from "../components/fi-studio/ui";
import { divergingHeat, moveText, onHeat, s } from "../components/fi-studio/tokens";
import { DEALERS, shortName } from "../components/fi-terminal/bonds";
import { mm, signed, usd } from "../components/fi-terminal/format";
import { DEALER_CODES, LINES, MAX_DEV, useBwic, type Filter, type View } from "../components/fi-terminal/model/bwic";

export const title = "FI Studio · Sell a List";
export const section = "trading";
export const fullWidth = true;

/* FI Studio · 4 of 5 — the friendly BWIC.
 *
 * Same engine as the terminal BWIC (useBwic). The countdown and the money
 * lead the page. In the grid every bid is tinted by how it compares to our
 * own valuation — green above, red below — with a star on the best and an
 * outline on the second best. Each line has a plain Sell / Keep switch
 * that follows the reserve rule until you change it. */

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All lines" },
  { id: "trade", label: "Selling" },
  { id: "dnt", label: "Keeping" },
];
const VIEWS: { id: View; label: string }[] = [
  { id: "vsmark", label: "vs our mark (¢)" },
  { id: "px", label: "Price" },
];

const dealerName = (code: string) => DEALERS.find((d) => d.code === code)?.name ?? code;

export default function FiStudioBwic() {
  const {
    view, setView, filter, setFilter, override, stage, setStage, left,
    focus, setFocus, toggleTrade, shown, trading, totalFace, tradingFace, proceeds, vsMark, bidsIn, bidsMax, belowReserve, winners,
    dealerStats, maxFace, fr, mmss, focusAdvice,
  } = useBwic();

  const urgent = left < 120 && stage !== "awarded";

  return (
    <StudioShell
      screen="BWIC"
      title="Sell a list"
      lead="Fourteen bonds went out to six dealers. The bids are in — choose what to sell."
      context={
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-stone-500">
            List BW-1028-A · IG Core Fund · {LINES.length} lines · ${usd(totalFace / 1e6)}M · all-or-none: No
          </span>
          {stage !== "awarded" ? (
            <Badge tone={urgent ? "bad" : "warn"} icon={<Clock className="h-3 w-3" />}>
              {mmss} left to decide
            </Badge>
          ) : (
            <Badge tone="good" icon={<Trophy className="h-3 w-3" />}>Awarded</Badge>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Headline numbers */}
        <div className={`grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-center gap-6 px-5 py-4 ${s.card}`}>
          <Stat label="Status" value={stage === "awarded" ? "Awarded" : "Bids in · deciding"} valueClass={stage === "awarded" ? s.up : "text-amber-700"} sub="Bids were due 14:00 · firm until 14:15" />
          <Stat label="Bids received" value={`${bidsIn} of ${bidsMax}`} sub={`${Math.round((bidsIn / bidsMax) * 100)}% of dealers answered`} />
          <Stat label="Lines selling" value={`${trading.length} of ${LINES.length}`} sub={<>{belowReserve} below <Term k="reserve">reserve</Term></>} />
          <Stat label="Face selling" value={`$${usd(tradingFace / 1e6)}M`} sub={`of $${usd(totalFace / 1e6)}M`} />
          <Stat label="You receive" value={`$${usd(proceeds / 1e6, 2)}M`} sub="price only, before accrued" big />
          <Stat label={<Term k="mark">Versus our mark</Term>} value={`${vsMark >= 0 ? "+" : "−"}$${usd(Math.abs(vsMark))}`} valueClass={moveText(vsMark)} sub="P&L when you award" />
          {stage === "deciding" ? (
            <button type="button" onClick={() => setStage("confirm")} disabled={trading.length === 0} className={`flex items-center gap-2 px-5 py-3 text-[14px] font-semibold ${s.sellBg} ${s.focus} disabled:opacity-40`}>
              <Gavel className="h-4 w-4" /> Sell {trading.length} lines
            </button>
          ) : stage === "awarded" ? (
            <Badge tone="good">Tickets sent to {winners} dealers</Badge>
          ) : (
            <span />
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
          <Card
            icon={<ListChecks className="h-4 w-4" />}
            title="Every bid, line by line"
            hint="Tint shows each bid against our mark. ★ best · outlined = second best · struck through = below reserve."
            actions={
              <div className="flex items-center gap-2">
                <Segmented label="Show lines" value={filter} options={FILTERS} onChange={setFilter} />
                <Segmented label="Cells show" value={view} options={VIEWS} onChange={setView} />
              </div>
            }
            bodyClassName="overflow-x-auto px-3 pb-3"
          >
            <table className="w-full border-separate border-spacing-y-1 text-[13px] tabular-nums">
              <thead>
                <tr className="text-[11px] text-stone-400">
                  <th className="px-2 py-1 text-left font-medium">#</th>
                  <th className="px-2 py-1 text-left font-medium">Bond</th>
                  <th className="px-2 py-1 text-right font-medium">Size</th>
                  <th className="px-2 py-1 text-right font-medium"><Term k="mark">Our mark</Term></th>
                  <th className="px-2 py-1 text-right font-medium"><Term k="reserve">Reserve</Term></th>
                  {DEALER_CODES.map((c) => (
                    <th key={c} className="px-1 py-1 text-center font-medium" title={dealerName(c)}>{c}</th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium">Best</th>
                  <th className="px-2 py-1 text-right font-medium"><Term k="cover">2nd</Term></th>
                  <th className="px-2 py-1 text-right font-medium">vs mark</th>
                  <th className="px-2 py-1 text-center font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ l, best, cover, trade, overridden }) => {
                  const bestVs = best ? (best.b - l.mark) * 100 : 0;
                  const on = focus === l.n;
                  return (
                    <tr key={l.n} onClick={() => setFocus(l.n)} className={`cursor-pointer ${on ? "bg-indigo-50" : "hover:bg-stone-50"} ${!trade ? "text-stone-400" : ""}`}>
                      <td className="px-2 py-1.5 text-stone-400">{l.n}</td>
                      <td className="px-2 py-1.5">
                        <span className={`font-medium ${trade ? "text-stone-900" : "text-stone-500"}`}>{shortName(l.bond)}</span>
                        <span className="ml-1.5 text-[11px] text-stone-400">{l.bond.rating}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{mm(l.face)}</td>
                      <td className="px-2 py-1.5 text-right text-stone-500">{l.mark.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-right text-stone-400">{l.reserve.toFixed(3)}</td>
                      {l.bids.map((b, di) => {
                        const isBest = best?.i === di;
                        const isCover = cover?.i === di;
                        const dev = b === null ? 0 : b - l.mark;
                        return (
                          <td key={di} className="px-0.5">
                            {b === null ? (
                              <div className="flex h-7 items-center justify-center text-[11px] text-stone-300" aria-label="No bid">
                                <Term k="DNB">—</Term>
                              </div>
                            ) : (
                              <div
                                className={`flex h-7 items-center justify-center gap-0.5 text-[12px] ${onHeat(dev / MAX_DEV)} ${isBest ? "ring-2 ring-inset ring-indigo-600" : isCover ? "ring-1 ring-inset ring-stone-400" : ""} ${b < l.reserve ? "line-through decoration-rose-500" : ""}`}
                                style={{ backgroundColor: divergingHeat(-dev / MAX_DEV) }}
                                title={`${dealerName(DEALER_CODES[di])} ${b.toFixed(3)} · ${signed(dev * 100)}¢ vs mark${isBest ? " · best" : isCover ? " · second best" : ""}`}
                              >
                                {isBest && <Star className="h-3 w-3 fill-indigo-600 text-indigo-600" aria-label="Best" />}
                                {view === "px" ? b.toFixed(3) : signed(dev * 100, 1)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right font-semibold text-stone-900">{best ? best.b.toFixed(3) : "—"}</td>
                      <td className="px-2 py-1.5 text-right text-stone-500">{cover ? cover.b.toFixed(3) : "—"}</td>
                      <td className={`px-2 py-1.5 text-right ${moveText(bestVs)}`}>{best ? `${signed(bestVs, 1)}¢` : "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          role="switch"
                          disabled={!best || stage !== "deciding"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrade(l.n);
                          }}
                          aria-checked={trade}
                          aria-label={`Line ${l.n} ${shortName(l.bond)}: ${trade ? "selling, switch to keep" : "keeping, switch to sell"}`}
                          className={`inline-flex w-24 items-center justify-between gap-1 px-1 py-0.5 text-[12px] font-medium ${s.focus} disabled:cursor-not-allowed ${
                            trade ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          <span className={`h-4 w-4 rounded-full bg-white shadow ${trade ? "order-last" : ""}`} />
                          <span className="flex-1 text-center">{!best ? "No bids" : trade ? "Sell" : "Keep"}{overridden && " *"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-3 text-[12px] text-stone-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-5 ring-2 ring-inset ring-indigo-600" /> Best</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-5 ring-1 ring-inset ring-stone-400" /> Second best</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-5" style={{ backgroundColor: divergingHeat(-1) }} /> above our mark</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-5" style={{ backgroundColor: divergingHeat(1) }} /> below our mark</span>
              <span><span className="line-through decoration-rose-500">101.0</span> below reserve</span>
              <span>— = <Term k="DNB">no bid</Term></span>
              <span>* = you overrode the reserve rule</span>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card title={`Line ${fr.l.n} · ${shortName(fr.l.bond)}`} hint="Click any row to see it here">
              <div className="space-y-1.5">
                {fr.l.bids
                  .map((b, i) => ({ b, i }))
                  .sort((a, b) => (b.b ?? -1) - (a.b ?? -1))
                  .map(({ b, i }) => {
                    const scale = (v: number) => ((v - (fr.l.mark - 1)) / 1.4) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="w-24 truncate text-stone-700" title={dealerName(DEALER_CODES[i])}>{dealerName(DEALER_CODES[i])}</span>
                        <div className="relative h-4 flex-1 bg-stone-100">
                          {b !== null && <div className={`h-4 ${fr.best?.i === i ? "bg-indigo-500" : "bg-stone-300"}`} style={{ width: `${Math.min(100, Math.max(4, scale(b)))}%` }} />}
                          <div className="absolute inset-y-[-2px] w-0.5 bg-stone-900" style={{ left: `${scale(fr.l.mark)}%` }} title="Our mark" />
                          <div className="absolute inset-y-[-2px] w-0.5 bg-rose-500" style={{ left: `${scale(fr.l.reserve)}%` }} title="Reserve" />
                        </div>
                        <span className="w-14 text-right font-medium tabular-nums text-stone-900">{b === null ? "no bid" : b.toFixed(3)}</span>
                      </div>
                    );
                  })}
              </div>
              <p className="mt-2 flex gap-4 text-[11px] text-stone-500">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-stone-900" /> our mark {fr.l.mark.toFixed(3)}</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-rose-500" /> reserve {fr.l.reserve.toFixed(3)}</span>
              </p>
              <div className="mt-2 border-t border-stone-100 pt-2">
                <Row k="Gap to second best" v={fr.best && fr.cover ? `${((fr.best.b - fr.cover.b) * 100).toFixed(1)}¢` : "—"} />
                <Row k="You'd receive" v={fr.best ? `$${usd((fr.best.b / 100) * fr.l.face)}` : "—"} />
                <Row k="How easy to trade" v={`${fr.l.bond.liq}/10`} />
              </div>
              <div className="mt-3">
                <Takeaway icon={<Lightbulb className="h-4 w-4" />}>{focusAdvice}</Takeaway>
              </div>
            </Card>

            <Card title="Dealer scorecard" hint="Who won what, and how keen they were" icon={<Trophy className="h-4 w-4" />} bodyClassName="px-4 pb-4">
              <ul className={`divide-y ${s.divide}`}>
                {dealerStats.map((d) => (
                  <li key={d.code} className="py-2">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-medium text-stone-900">{dealerName(d.code)}</span>
                      <span className="text-stone-500 tabular-nums">won {d.wins} · {mm(d.face)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-stone-100">
                        <div className="h-1.5 bg-indigo-500" style={{ width: `${(d.face / maxFace) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-[11px] text-stone-500 tabular-nums">bid {d.resp}/{LINES.length}</span>
                      <span className={`w-14 text-right text-[11px] tabular-nums ${moveText(d.avg)}`}>{signed(d.avg, 1)}¢</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-stone-400">Avg ¢ = how far a dealer's bids sat from our mark. Feeds the dealer panel review — dealers who rarely bid lose their slot.</p>
            </Card>
          </div>
        </div>
      </div>

      {stage === "confirm" && (
        <Dialog
          title="Award this list?"
          onClose={() => setStage("deciding")}
          actions={
            <>
              <button type="button" onClick={() => setStage("deciding")} className={`px-4 py-2 text-[13px] ${s.secondary} ${s.focus}`}>Back</button>
              <button type="button" autoFocus onClick={() => setStage("awarded")} className={`px-5 py-2 text-[14px] font-semibold ${s.sellBg} ${s.focus}`}>Confirm and award</button>
            </>
          }
        >
          <p className="text-[16px] leading-snug text-stone-900">
            You are <strong className="text-orange-600">SELLING</strong> {trading.length} lines, ${usd(tradingFace / 1e6)}M face, to {winners} dealers for ${usd(proceeds / 1e6, 2)}M.
          </p>
          <div className="mt-4">
            <Row k="P&L vs our mark" v={`${vsMark >= 0 ? "+" : "−"}$${usd(Math.abs(vsMark))}`} vClass={moveText(vsMark)} />
            <Row k="Keeping (not selling)" v={`${LINES.length - trading.length} lines`} />
            <Row k="Your overrides" v={`${Object.keys(override).length}`} />
            <Row k="Second-best levels sent to losing dealers" v="Yes · after award" />
          </div>
        </Dialog>
      )}
    </StudioShell>
  );
}
