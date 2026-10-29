import type { ReactNode } from "react";
import { CLIENT } from "./data";

/* A stand-in for the screen the floating assistant sits on top of — a plain
 * client overview, so the widget is judged in situ (does it cover anything
 * important? does it read as part of the product?) rather than on a blank
 * page. Static on purpose: it is scenery. */

const KPIS: [string, string, string][] = [
  ["AUM", CLIENT.aum, "+£41m MTD"],
  ["Return YTD", "+7.8%", "+1.2% vs benchmark"],
  ["1d VaR 99%", "£18.7m", "78% of limit"],
  ["Cash", "3.4%", "Target 2–5%"],
];

const ALLOC: [string, number][] = [
  ["Global equity", 58],
  ["IG credit", 17],
  ["Government bonds", 14],
  ["Alternatives", 7.6],
  ["Cash", 3.4],
];

const ACTIVITY = [
  ["28 Oct", "Rebalance executed", "Equity −1.0%, Credit +1.0%"],
  ["21 Oct", "Client call logged", "Private credit sleeve discussed"],
  ["14 Oct", "Limit warning cleared", "Microsoft back below 4.8%"],
  ["02 Oct", "Q3 report sent", "Trustee pack v2"],
];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-200 px-4 py-2.5 text-[13px] font-semibold text-neutral-800">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function HostPage({ toolbar }: { toolbar: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-neutral-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white py-3 pr-6 pl-32">
        <div className="min-w-0">
          <div className="text-[11px] text-neutral-500">Clients / {CLIENT.name}</div>
          <h1 className="truncate text-[18px] font-semibold text-neutral-950">Portfolio overview</h1>
        </div>
        {toolbar}
      </header>

      <div className="mx-auto max-w-6xl space-y-4 p-6 pb-28">
        <div className="grid grid-cols-2 gap-px border border-neutral-200 bg-neutral-200 lg:grid-cols-4">
          {KPIS.map(([k, v, d]) => (
            <div key={k} className="bg-white px-4 py-3">
              <div className="text-[12px] text-neutral-500">{k}</div>
              <div className="mt-0.5 text-[22px] font-semibold tracking-tight tabular-nums text-neutral-950">{v}</div>
              <div className="text-[12px] text-neutral-500">{d}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Card title="Asset allocation">
            <ul className="space-y-3">
              {ALLOC.map(([k, v]) => (
                <li key={k} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-[13px]">
                  <span className="text-neutral-700">{k}</span>
                  <span className="h-2 bg-neutral-100">
                    <span className="block h-full bg-neutral-800" style={{ width: `${v}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-neutral-900">{v}%</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Mandate">
            <dl className="space-y-2 text-[13px]">
              {[
                ["Mandate", CLIENT.mandate],
                ["Benchmark", CLIENT.benchmark],
                ["Risk profile", CLIENT.riskProfile],
                ["RM", CLIENT.rm],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[100px_1fr] gap-2">
                  <dt className="text-neutral-500">{k}</dt>
                  <dd className="text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card title="Recent activity">
          <ul className="divide-y divide-neutral-100 text-[13px]">
            {ACTIVITY.map(([d, t, n]) => (
              <li key={t} className="grid grid-cols-[64px_1fr] gap-3 py-2.5 sm:grid-cols-[64px_220px_1fr]">
                <span className="text-neutral-500 tabular-nums">{d}</span>
                <span className="font-medium text-neutral-900">{t}</span>
                <span className="col-start-2 text-neutral-500 sm:col-start-auto">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
