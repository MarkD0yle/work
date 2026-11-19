import { cx, tone as toneTokens, type Tone } from "../patterns/tokens";
import { VALUATION_DATE, describe } from "./nav-model";

/* HostSurface — the page the sidebar is navigating.
 *
 * Kept deliberately plain. It exists so each sidebar is judged next to real
 * content at a real width, and so choosing a link visibly does something. The
 * title, breadcrumb and open-item figure follow the active link; the fund
 * table is the same on every page.
 */

type FundRow = {
  fund: string;
  ccy: string;
  nav: string;
  move: string;
  status: string;
  tone: Tone;
};

const FUNDS: FundRow[] = [
  { fund: "Aldgate Global Equity UCITS", ccy: "USD", nav: "184.2371", move: "+0.42%", status: "Pricing", tone: "warning" },
  { fund: "Aldgate Sterling Corporate Bond", ccy: "GBP", nav: "102.9148", move: "-0.08%", status: "Cash break", tone: "negative" },
  { fund: "Aldgate Emerging Markets Debt", ccy: "USD", nav: "96.4410", move: "+0.17%", status: "Awaiting sign-off", tone: "info" },
  { fund: "Aldgate Multi-Asset Income", ccy: "EUR", nav: "121.0056", move: "+0.21%", status: "Released", tone: "positive" },
  { fund: "Aldgate Short Duration Credit", ccy: "EUR", nav: "100.3312", move: "+0.01%", status: "Released", tone: "positive" },
  { fund: "Aldgate Japan Smaller Companies", ccy: "JPY", nav: "15,482.60", move: "-0.63%", status: "Released", tone: "positive" },
  { fund: "Aldgate Infrastructure Income", ccy: "GBP", nav: "1.1247", move: "+0.05%", status: "Accruals", tone: "warning" },
  { fund: "Aldgate Liquidity GBP", ccy: "GBP", nav: "1.0000", move: "0.00%", status: "Released", tone: "positive" },
];

export function HostSurface({ activeId }: { activeId: string }) {
  const { crumbs, title, item } = describe(activeId);

  const tiles = [
    { label: "Funds in scope", value: "42" },
    { label: "Completed", value: "31" },
    { label: "Open items", value: String(item.count ?? 0) },
    { label: "Next cut-off", value: "17:30" },
  ];

  return (
    <div className="flex h-full min-w-0 flex-col bg-neutral-50">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-5">
        <div className="min-w-0">
          <div className="truncate text-[11px] text-neutral-500">{crumbs.join(" / ")}</div>
          <h2 className="truncate text-sm font-semibold tracking-tight text-neutral-900">{title}</h2>
        </div>
        <span className="shrink-0 border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 tabular-nums">
          VD {VALUATION_DATE}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="border border-neutral-200 bg-white px-3 py-2.5">
              <dt className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
                {t.label}
              </dt>
              <dd className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900 tabular-nums">
                {t.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 overflow-x-auto border border-neutral-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] tracking-widest text-neutral-500 uppercase">
                <th scope="col" className="px-3 py-2 font-semibold">Fund</th>
                <th scope="col" className="px-3 py-2 font-semibold">Ccy</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">NAV per share</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Day move</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {FUNDS.map((row) => (
                <tr key={row.fund} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-neutral-900">{row.fund}</td>
                  <td className="px-3 py-2 text-neutral-500">{row.ccy}</td>
                  <td className="px-3 py-2 text-right text-neutral-900 tabular-nums">{row.nav}</td>
                  <td
                    className={cx(
                      "px-3 py-2 text-right tabular-nums",
                      row.move.startsWith("-") ? "text-red-700" : "text-neutral-700",
                    )}
                  >
                    {row.move}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cx(
                        "inline-flex rounded-full border px-2 text-[11px] leading-5 font-medium whitespace-nowrap",
                        toneTokens[row.tone].soft,
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
