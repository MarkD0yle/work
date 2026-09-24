import { useMemo, useState } from "react";
import type { IntroducerRow } from "./model";
import { STATUS, days, gbpM, int, pct } from "./format";
import { SortTh, type SortDir } from "./ui";

/* Broker / branch league table: the twelve biggest introducers over the
 * ten-week cohort window. Packaging quality is a bar in the cell so the
 * column scans as a shape, not a list of numbers. */

type SortKey = "name" | "submissions" | "value" | "offerRate" | "daysToOffer" | "fallThrough" | "packaging" | "breaches";
type Sort = { key: SortKey; dir: SortDir };

const COLUMNS: { key: SortKey; label: string; right?: boolean; title?: string }[] = [
  { key: "name", label: "Introducer" },
  { key: "submissions", label: "Submissions", right: true, title: "Applications received in the last ten weeks" },
  { key: "value", label: "Value", right: true },
  { key: "offerRate", label: "Offer rate", right: true, title: "Offers ÷ decided cases (offers plus fall-throughs before offer)" },
  { key: "daysToOffer", label: "Days to offer", right: true, title: "Mean business days from application to offer" },
  { key: "fallThrough", label: "Fall-through", right: true, title: "Fallen through at any stage ÷ submissions" },
  { key: "packaging", label: "Packaging", right: true, title: "Share of submissions that arrived fully packaged" },
  { key: "breaches", label: "Past SLA", right: true, title: "Live cases past their stage SLA" },
];

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  submissions: "desc",
  value: "desc",
  offerRate: "desc",
  daysToOffer: "asc",
  fallThrough: "asc",
  packaging: "desc",
  breaches: "desc",
};

function compare(a: IntroducerRow, b: IntroducerRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.introducer.name.localeCompare(b.introducer.name);
    case "submissions":
      return a.submissions - b.submissions;
    case "value":
      return a.value - b.value;
    case "offerRate":
      return (a.offerRate ?? -1) - (b.offerRate ?? -1);
    case "daysToOffer":
      return (a.daysToOffer ?? Infinity) - (b.daysToOffer ?? Infinity);
    case "fallThrough":
      return a.fallThrough - b.fallThrough;
    case "packaging":
      return a.packaging - b.packaging;
    case "breaches":
      return a.breaches - b.breaches;
  }
}

const NUM = "px-2 py-2 text-right font-mono text-[11px] tabular-nums whitespace-nowrap";

export function LeagueTable({ rows, scope }: { rows: IntroducerRow[]; scope: string }) {
  const [sort, setSort] = useState<Sort>({ key: "submissions", dir: "desc" });

  const sorted = useMemo(() => {
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => m * compare(a, b, sort.key) || b.submissions - a.submissions);
  }, [rows, sort]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }));

  const totalSubs = rows.reduce((s, r) => s + r.submissions, 0);

  return (
    <section aria-labelledby="mp-league-title" className="flex h-full flex-col border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <h2 id="mp-league-title" className="text-sm font-semibold text-neutral-900">
            Broker and branch league
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            Top {rows.length} introducers by submissions over the ten-week window · {scope} · {int(totalSubs)} submissions between them
          </p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-sm font-medium text-neutral-700">No introducers in this slice</div>
          <p className="mt-1 text-[11px] text-neutral-500">Nothing was submitted for this channel and product combination in the window.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <caption className="sr-only">Introducer league table, sortable</caption>
            <thead className="border-b border-neutral-200 bg-neutral-50/70">
              <tr>
                <th scope="col" className="w-6 px-2 py-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                  #
                </th>
                {COLUMNS.map((c) => (
                  <SortTh
                    key={c.key}
                    label={c.label}
                    title={c.title}
                    active={sort.key === c.key}
                    dir={sort.dir}
                    align={c.right ? "right" : "left"}
                    onClick={() => sortBy(c.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.map((r, i) => {
                const lowPackaging = r.packaging < 70;
                return (
                  <tr key={r.introducer.id} className="hover:bg-neutral-50">
                    <td className="px-2 py-2 font-mono text-[10px] text-neutral-400 tabular-nums">{i + 1}</td>
                    <th scope="row" className="px-2 py-2 text-left">
                      <span className="block truncate text-[11px] font-medium text-neutral-900">{r.introducer.name}</span>
                      <span className="block text-[10px] text-neutral-400">{r.introducer.channel}</span>
                    </th>
                    <td className={`${NUM} font-semibold text-neutral-900`}>{int(r.submissions)}</td>
                    <td className={`${NUM} text-neutral-700`}>{gbpM(r.value)}</td>
                    <td className={`${NUM} text-neutral-800`}>{r.offerRate === null ? "—" : pct(r.offerRate * 100)}</td>
                    <td className={`${NUM} text-neutral-800`}>{r.daysToOffer === null ? "—" : days(r.daysToOffer)}</td>
                    <td className={`${NUM} ${r.fallThrough > 0.2 ? "font-semibold text-rose-700" : "text-neutral-800"}`}>
                      {pct(r.fallThrough * 100, 1)}
                    </td>
                    <td className={NUM}>
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className={lowPackaging ? "font-semibold text-rose-700" : "text-neutral-800"}>{Math.round(r.packaging)}</span>
                        <span className="relative inline-block h-1.5 w-16 bg-neutral-100" aria-hidden>
                          <span
                            className="absolute inset-y-0 left-0"
                            style={{ width: `${r.packaging}%`, background: lowPackaging ? STATUS.bad : "#404040" }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className={`${NUM} ${r.breaches ? "text-neutral-900" : "text-neutral-400"}`}>{int(r.breaches)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
