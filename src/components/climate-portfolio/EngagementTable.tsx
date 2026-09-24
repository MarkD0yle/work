import { useState, type ComponentType } from "react";
import type { Engagement, HoldingRow, Sbti } from "./model";
import { SECTOR_SHORT } from "./model";
import { ACCENT, ENGAGEMENTS, fmtDate, nf, pct, tempBand } from "./format";
import {
  Card,
  IconCheck,
  IconClock,
  IconDash,
  IconEscalate,
  IconExit,
  IconFlag,
  IconMonitor,
  IconTalk,
  IconVote,
  MicroLabel,
} from "./ui";

/* Engagement tracker — the page's signature table.
 *
 * The top 15 contributors to financed emissions for the current slice, with
 * the stewardship status of each. The status chips above it are a table
 * view filter: they narrow these rows only, never the KPIs or charts, and
 * the header says so. Escalation reads left to right — engaging, escalated,
 * voted against, divestment review — and the icon + colour step up with it. */

const TOP_N = 15;

const ENG_META: Record<Engagement, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  Engaging: { Icon: IconTalk, tone: "text-neutral-500" },
  Escalated: { Icon: IconEscalate, tone: "text-amber-600" },
  "Voted against": { Icon: IconVote, tone: "text-amber-700" },
  "Divestment review": { Icon: IconExit, tone: "text-rose-600" },
};

const SBTI_META: Record<Sbti, { Icon: ComponentType<{ className?: string }>; cls: string }> = {
  Validated: { Icon: IconCheck, cls: "border-lime-800 bg-lime-800 text-white" },
  Committed: { Icon: IconClock, cls: "border-lime-300 bg-lime-100 text-lime-900" },
  None: { Icon: IconDash, cls: "border-neutral-200 bg-white text-neutral-500" },
};

type Filter = Engagement | "all";

export function EngagementTable({
  holdings,
  scopeLabel,
  portfolioLabel,
}: {
  holdings: HoldingRow[];
  scopeLabel: string;
  portfolioLabel: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const top = holdings.slice(0, TOP_N);
  const topShare = top.reduce((a, h) => a + h.feShare, 0);
  const maxShare = top[0]?.feShare ?? 1;
  const rows = filter === "all" ? top : top.filter((h) => h.issuer.engagement === filter);
  const count = (e: Engagement) => top.filter((h) => h.issuer.engagement === e).length;

  const chips: { value: Filter; label: string; n: number }[] = [
    { value: "all", label: "All", n: top.length },
    ...ENGAGEMENTS.map((e) => ({ value: e as Filter, label: e, n: count(e) })),
  ];

  return (
    <Card
      title="Engagement tracker"
      subtitle={
        <>
          Top {top.length} contributors to financed emissions in {portfolioLabel} — together{" "}
          <b className="font-mono font-semibold text-neutral-700">{pct(topShare, 0)}</b> of the total · {scopeLabel}
        </>
      }
      footer={
        <>
          Escalation path: engaging → escalated → voted against → divestment review. Milestones from
          the stewardship log to 22 Sep 2026; controversy flags from the ESG research feed.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2">
        <MicroLabel>Table view · engagement status</MicroLabel>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter the engagement table by status">
          {chips.map((c) => {
            const on = filter === c.value;
            const meta = c.value === "all" ? null : ENG_META[c.value];
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.value)}
                className={`inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] font-medium transition focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-1 focus-visible:outline-none ${
                  on
                    ? "border-lime-800 bg-lime-800 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {meta && <meta.Icon className={`h-3.5 w-3.5 ${on ? "text-white" : meta.tone}`} />}
                {c.label}
                <span
                  className={`font-mono text-[10px] tabular-nums ${on ? "text-lime-100" : "text-neutral-400"}`}
                >
                  {c.n}
                </span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-neutral-500" aria-live="polite">
          Showing <b className="font-mono font-semibold text-neutral-800">{rows.length}</b> of {top.length} ·
          filters this table only
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed" style={{ minWidth: 1180 }}>
          <caption className="sr-only">
            Top {TOP_N} contributors to financed emissions with engagement status
          </caption>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 210 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 106 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 196 }} />
            <col />
          </colgroup>
          <thead className="border-b border-neutral-200">
            <tr className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              <th scope="col" className="px-3 py-2 text-right">#</th>
              <th scope="col" className="px-3 py-2 text-left">Issuer</th>
              <th scope="col" className="px-3 py-2 text-left">Sector</th>
              <th scope="col" className="px-3 py-2 text-right">Weight</th>
              <th scope="col" className="px-3 py-2 text-left">Share of financed</th>
              <th scope="col" className="px-3 py-2 text-right" title="tCO₂e per $m revenue">
                t/$m rev
              </th>
              <th scope="col" className="px-3 py-2 text-left">Temp.</th>
              <th scope="col" className="px-3 py-2 text-left">SBTi</th>
              <th scope="col" className="px-3 py-2 text-left">Engagement</th>
              <th scope="col" className="px-3 py-2 text-left">Last milestone</th>
              <th scope="col" className="px-3 py-2 text-left">Controversy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center">
                  <div className="text-sm font-medium text-neutral-800">
                    No top-{TOP_N} contributor is at &ldquo;{filter}&rdquo; in this slice
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="mt-2 text-xs font-medium text-lime-800 underline underline-offset-2 hover:text-lime-900 focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:outline-none"
                  >
                    Show all {top.length}
                  </button>
                </td>
              </tr>
            )}
            {rows.map((h) => {
              const i = h.issuer;
              const rank = holdings.indexOf(h) + 1;
              const band = tempBand(h.temp);
              const sb = SBTI_META[i.sbti];
              const eng = i.engagement ? ENG_META[i.engagement] : null;
              return (
                <tr key={i.id} className="align-top transition hover:bg-lime-50/40">
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-neutral-400 tabular-nums">{rank}</td>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <div className="truncate text-xs font-medium text-neutral-900">{i.name}</div>
                    <div className="truncate text-[10px] text-neutral-500">
                      {i.industry} · {i.country}
                    </div>
                  </th>
                  <td className="truncate px-3 py-2 text-xs text-neutral-600">{SECTOR_SHORT[i.sector]}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-800 tabular-nums">
                    {pct(h.weight, 2)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-neutral-100" aria-hidden>
                        <div className="h-full" style={{ width: `${(h.feShare / maxShare) * 100}%`, background: ACCENT }} />
                      </div>
                      <span className="w-11 text-right font-mono text-xs text-neutral-800 tabular-nums">
                        {pct(h.feShare, 1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-800 tabular-nums">
                    {nf(h.intensity, 0)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-neutral-800 tabular-nums">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 border border-black/10"
                        style={{ background: band.color }}
                      />
                      {nf(h.temp, 1)}°C
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 border px-1.5 py-px text-[10px] font-semibold ${sb.cls}`}>
                      <sb.Icon className="h-2.5 w-2.5" />
                      {i.sbti}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {eng ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-800">
                        <eng.Icon className={`h-3.5 w-3.5 shrink-0 ${eng.tone}`} />
                        {i.engagement}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                        <IconMonitor className="h-3.5 w-3.5 shrink-0" />
                        Monitoring
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.milestone ? (
                      <>
                        <div className="font-mono text-xs text-neutral-800 tabular-nums">{fmtDate(i.milestone.date)}</div>
                        <div className="truncate text-[10px] text-neutral-500" title={i.milestone.text}>
                          {i.milestone.text}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.controversy ? (
                      <span className="inline-flex items-start gap-1.5 text-xs text-neutral-800">
                        <IconFlag className="mt-px h-3.5 w-3.5 shrink-0 text-rose-600" />
                        <span className="sr-only">Flagged: </span>
                        {i.controversy}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-300">
                        —<span className="sr-only">No flag</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
