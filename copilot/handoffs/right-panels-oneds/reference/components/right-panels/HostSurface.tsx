import { HOST_TABLES, type PanelExample } from "../../lib/rightPanels";

/* The work surface each panel docks beside.
 *
 * Deliberately underplayed. A right panel is only ever as good as its
 * relationship to what sits left of it, so the host has to be present enough
 * to make that relationship legible — a selected row, a live grid, a document
 * being read — without competing with the exhibit. Everything here is muted,
 * static, and one level of detail shallower than it would be in the real page.
 */

/* Row stripe as an inset shadow on the first cell rather than a positioned
 * pseudo-element on the <tr>: CSS table layout wraps a ::before on a table-row
 * in an anonymous table cell, which silently shifts every column one place. */
const TONE_STRIPE: Record<string, string> = {
  positive: "shadow-[inset_2px_0_0_#34d399]",
  negative: "shadow-[inset_2px_0_0_#fb7185]",
  warn: "shadow-[inset_2px_0_0_#fbbf24]",
  neutral: "",
};

function HostTable({ example }: { example: PanelExample }) {
  const table = HOST_TABLES[example.id];
  // The first row is "selected" — it is the record the panel is showing.
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-neutral-200">
          {table.columns.map((c) => (
            <th
              key={c.key}
              className={`px-3 py-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase ${
                c.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, i) => (
          <tr
            key={r.id}
            aria-selected={i === 0}
            className={`border-b border-neutral-100 ${
              i === 0 ? "bg-neutral-100" : "hover:bg-neutral-50"
            }`}
          >
            {table.columns.map((c, ci) => (
              <td
                key={c.key}
                className={`px-3 py-2 tabular-nums ${
                  c.align === "right" ? "text-right" : "text-left"
                } ${c.muted ? "text-neutral-400" : "text-neutral-700"} ${
                  i === 0 ? "font-medium text-neutral-900" : ""
                } ${ci === 0 ? TONE_STRIPE[r.tone ?? "neutral"] : ""}`}
              >
                {r.cells[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Board of limit tiles — the monitor a breach panel is opened from. */
function HostBoard() {
  const tiles = [
    { book: "EUR Rates DV01", util: 108, state: "breach" },
    { book: "USD Rates DV01", util: 71, state: "ok" },
    { book: "FX G10 VaR", util: 88, state: "warn" },
    { book: "FX EM VaR", util: 44, state: "ok" },
    { book: "Inflation DV01", util: 62, state: "ok" },
    { book: "Credit CS01", util: 93, state: "warn" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-3">
      {tiles.map((t, i) => {
        const tone =
          t.state === "breach"
            ? "border-rose-300 bg-rose-50"
            : t.state === "warn"
              ? "border-amber-200 bg-amber-50"
              : "border-neutral-200 bg-white";
        const text =
          t.state === "breach"
            ? "text-rose-600"
            : t.state === "warn"
              ? "text-amber-700"
              : "text-neutral-900";
        return (
          <div
            key={t.book}
            className={`rounded-lg border p-3 ${tone} ${i === 0 ? "ring-2 ring-rose-400" : ""}`}
          >
            <div className="truncate text-[11px] text-neutral-600">{t.book}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${text}`}>
              {t.util}%
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full ${
                  t.state === "breach"
                    ? "bg-rose-500"
                    : t.state === "warn"
                      ? "bg-amber-500"
                      : "bg-neutral-400"
                }`}
                style={{ width: `${Math.min(t.util, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Research note — paragraphs numbered so the copilot's citations mean
 * something. ¶9 is highlighted as the passage a citation points at. */
function HostDoc() {
  const paragraphs = [
    "The Governing Council's June cut has been followed by a communication shift that markets have, in our view, under-priced. Three members have now publicly framed the terminal rate as a range rather than a point.",
    "Front-end pricing implies 1.6 cuts by December. We think two is the central case, and the distribution around it is skewed toward more rather than fewer.",
    "We recommend receiving 2y EUR OIS against paying 10y, targeting 40bp of steepening into year-end, with a stop at 12bp of flattening.",
    "Positioning surveys show the steepener is now a consensus trade, which argues for sizing discipline rather than for abandoning the view.",
    "Bank funding conditions remain the quiet risk. A repricing of senior preferred spreads would tighten financial conditions without any policy change at all.",
    "Inflation swaps have been stable at the 5y5y point, which we read as the market accepting the Council's framing rather than as complacency.",
    "Carry on the recommended position runs at approximately -1.8bp per month at current forwards; the trade needs two cuts by December to break even on a hold-to-target basis.",
    "Roll-down partially offsets this after September, when the 2y point begins to capture the easing already priced.",
    "Two things would change our mind: core services inflation printing above 3.4%, or clear signalling that the June move was a one-off insurance cut.",
    "Cross-market, the same view expressed in SONIA is cheaper on carry but carries a fiscal risk premium we would rather not own into the Autumn Statement.",
    "We would flatten rather than add if positioning metrics move another decile higher without a corresponding move in the underlying data.",
    "Appendix: forwards, carry decomposition, and the historical distribution of 2s10s over past easing cycles.",
  ];
  return (
    <article className="mx-auto max-w-2xl px-6 py-5">
      <h3 className="text-base font-semibold tracking-tight text-neutral-900">
        Two cuts, not one — staying in the EUR steepener
      </h3>
      <p className="mt-1 text-[11px] text-neutral-500">
        Rates Strategy · 15 August 2026 · 14 pages
      </p>
      <div className="mt-4 space-y-3">
        {paragraphs.map((p, i) => {
          const n = i + 1;
          const cited = n === 9;
          return (
            <p
              key={n}
              className={`flex gap-3 text-xs leading-relaxed ${
                cited ? "rounded-md bg-sky-50 px-2 py-1.5 -mx-2" : ""
              }`}
            >
              <span
                className={`w-5 shrink-0 text-right text-[10px] tabular-nums ${
                  cited ? "font-semibold text-sky-600" : "text-neutral-300"
                }`}
              >
                {n}
              </span>
              <span className={cited ? "text-neutral-900" : "text-neutral-600"}>
                {p}
              </span>
            </p>
          );
        })}
      </div>
    </article>
  );
}

/* Vol surface — the position under discussion in the commentary thread. */
function HostChart() {
  const strikes = [4600, 4800, 5000, 5200, 5400, 5600];
  const tenors = ["1m", "3m", "6m", "1y", "2y"];
  // Smile: higher vol at the wings, term structure rising with tenor.
  const vol = (si: number, ti: number) =>
    16 + Math.abs(si - 2.5) * 1.6 + ti * 0.9;
  return (
    <div className="p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
          Implied vol surface
        </span>
        <span className="text-[11px] text-neutral-400">SX5E · 16 Aug 26</span>
      </div>
      <div
        className="grid gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200"
        style={{ gridTemplateColumns: `3rem repeat(${strikes.length}, 1fr)` }}
      >
        <div className="bg-neutral-50" />
        {strikes.map((s) => (
          <div
            key={s}
            className="bg-neutral-50 px-1 py-1.5 text-center text-[10px] font-medium text-neutral-500 tabular-nums"
          >
            {s}
          </div>
        ))}
        {tenors.map((t, ti) => (
          <div key={t} className="contents">
            <div className="flex items-center justify-center bg-neutral-50 text-[10px] font-medium text-neutral-500">
              {t}
            </div>
            {strikes.map((s, si) => {
              const v = vol(si, ti);
              const intensity = Math.min(1, (v - 15) / 12);
              const highlighted = t === "1y" && s === 5200;
              return (
                <div
                  key={s}
                  className={`px-1 py-2 text-center text-[11px] tabular-nums ${
                    highlighted ? "ring-2 ring-amber-400 ring-inset" : ""
                  }`}
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${0.06 + intensity * 0.3})`,
                  }}
                >
                  {v.toFixed(1)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-neutral-500">
        Dec 26 · 5200 strike carries the vega concentration under review.
      </p>
    </div>
  );
}

export function HostSurface({ example }: { example: PanelExample }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-neutral-900">
            {example.hostTitle}
          </h2>
          <p className="truncate text-[11px] text-neutral-500">
            {example.hostSubtitle}
          </p>
        </div>
        <span className="shrink-0 rounded border border-neutral-200 px-2 py-1 text-[10px] font-medium text-neutral-400">
          Host surface
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {example.host === "board" ? (
          <HostBoard />
        ) : example.host === "doc" ? (
          <HostDoc />
        ) : example.host === "chart" ? (
          <HostChart />
        ) : (
          <HostTable example={example} />
        )}
      </div>
    </div>
  );
}
