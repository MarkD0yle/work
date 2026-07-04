import { PortfolioShell, StatTile } from "../components/PortfolioShell";

export const title = "Risk Attribution";
export const fullWidth = true;
export const section = "portfolio-analytics";

/* Factor risk decomposition: style-factor exposures (diverging betas) and each
   factor's share of total portfolio risk, plus the top marginal contributors —
   the classic Barra / Aladdin risk lens. */

const FACTORS = [
  { name: "Market (Beta)", beta: 0.98, risk: 42, color: "#4f46e5" },
  { name: "Quality", beta: 0.48, risk: 11, color: "#0ea5e9" },
  { name: "Value", beta: 0.35, risk: 9, color: "#10b981" },
  { name: "Low Volatility", beta: 0.28, risk: 8, color: "#14b8a6" },
  { name: "Momentum", beta: -0.22, risk: 7, color: "#f59e0b" },
  { name: "Size", beta: -0.15, risk: 5, color: "#f97316" },
  { name: "Growth", beta: 0.12, risk: 4, color: "#a855f7" },
  { name: "Specific / Idiosyncratic", beta: 0, risk: 14, color: "#94a3b8" },
];

const CONTRIBUTORS = [
  { name: "NVDA 5.25 30", sector: "Technology", weight: 4.8, mctr: 0.42, risk: 9.1 },
  { name: "MSFT 4.90 29", sector: "Technology", weight: 4.2, mctr: 0.31, risk: 7.0 },
  { name: "JPM 5.10 31", sector: "Financials", weight: 3.9, mctr: 0.27, risk: 6.1 },
  { name: "XOM 4.95 30", sector: "Energy", weight: 3.5, mctr: 0.25, risk: 5.4 },
  { name: "TSLA 5.40 29", sector: "Consumer", weight: 2.8, mctr: 0.29, risk: 5.0 },
  { name: "DUK 5.35 32", sector: "Utilities", weight: 3.1, mctr: 0.14, risk: 3.2 },
];

const BETA_DOM = [-0.6, 1.4];
const zeroPct = ((0 - BETA_DOM[0]) / (BETA_DOM[1] - BETA_DOM[0])) * 100;
const toPct = (v: number) => ((v - BETA_DOM[0]) / (BETA_DOM[1] - BETA_DOM[0])) * 100;

function RiskAttribution() {
  const totalRisk = FACTORS.reduce((s, f) => s + f.risk, 0);
  return (
    <PortfolioShell title="Risk Attribution" badge="Factor Model" subtitle="Ex-ante · 245 positions">
      {() => (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Total Volatility" value="9.8%" />
            <StatTile label="Tracking Error" value="1.42%" />
            <StatTile label="Active Share" value="63%" />
            <StatTile label="Positions" value="245" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* factor exposures */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-neutral-900">Style Factor Exposures</div>
              <div className="space-y-2.5">
                {FACTORS.filter((f) => f.beta !== 0).map((f) => {
                  const pos = f.beta >= 0;
                  const p = toPct(f.beta);
                  return (
                    <div key={f.name} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[12px] text-neutral-600">{f.name}</span>
                      <div className="relative h-5 flex-1 rounded bg-neutral-100">
                        <div className="absolute inset-y-0 w-px bg-neutral-300" style={{ left: `${zeroPct}%` }} />
                        <div
                          className={`absolute inset-y-0.5 rounded ${pos ? "bg-indigo-500" : "bg-rose-400"}`}
                          style={pos ? { left: `${zeroPct}%`, width: `${p - zeroPct}%` } : { left: `${p}%`, width: `${zeroPct - p}%` }}
                        />
                      </div>
                      <span className={`w-12 shrink-0 text-right font-mono text-[12px] tabular-nums ${pos ? "text-indigo-600" : "text-rose-600"}`}>
                        {f.beta > 0 ? "+" : ""}
                        {f.beta.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* risk contribution */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-neutral-900">Risk Contribution by Factor</div>
              <div className="flex h-5 w-full overflow-hidden rounded-md">
                {FACTORS.map((f) => (
                  <div key={f.name} title={`${f.name} · ${f.risk}%`} style={{ width: `${(f.risk / totalRisk) * 100}%`, background: f.color }} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {FACTORS.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-[12px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
                    <span className="flex-1 text-neutral-600">{f.name}</span>
                    <span className="font-mono tabular-nums text-neutral-800">{((f.risk / totalRisk) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* top contributors */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-neutral-900">Top Marginal Risk Contributors</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                    <th className="py-1.5 pr-4">Position</th>
                    <th className="py-1.5 pr-4">Sector</th>
                    <th className="py-1.5 pr-4 text-right">Weight</th>
                    <th className="py-1.5 pr-4 text-right">MCTR</th>
                    <th className="py-1.5 text-right">% of Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRIBUTORS.map((c) => (
                    <tr key={c.name} className="border-b border-neutral-100 last:border-0">
                      <td className="py-1.5 pr-4 font-mono font-medium text-neutral-800">{c.name}</td>
                      <td className="py-1.5 pr-4 text-neutral-500">{c.sector}</td>
                      <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-neutral-700">{c.weight.toFixed(1)}%</td>
                      <td className="py-1.5 pr-4 text-right font-mono tabular-nums text-neutral-700">{c.mctr.toFixed(2)}</td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.risk / 10) * 100}%` }} />
                          </div>
                          <span className="w-10 font-mono tabular-nums text-neutral-800">{c.risk.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </PortfolioShell>
  );
}

export default RiskAttribution;
