import { useState, type ReactNode } from "react";

/* Shared chrome for the Portfolio Analytics tool pages: a header with title +
   badge, an optional actions slot, and a built-in dark-mode toggle that wraps
   the page in the `.screener-dark` scope (styled globally in index.css). */
export function PortfolioShell({
  title,
  badge,
  subtitle,
  actions,
  children,
}: {
  title: string;
  badge?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: (dark: boolean) => ReactNode;
}) {
  const [dark, setDark] = useState(false);
  return (
    <div className={`flex h-screen flex-col bg-neutral-50 ${dark ? "screener-dark" : ""}`}>
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h1>
          {badge && (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
              {badge}
            </span>
          )}
          {subtitle && <span className="text-[12px] text-neutral-400">{subtitle}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50"
            title={dark ? "Switch to light" : "Switch to dark"}
          >
            {dark ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 2a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 10 2Zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 1.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75ZM4.4 4.4a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 0 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06Zm9.44 9.44a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06ZM2 10a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 2 10Zm13.25 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75ZM5.86 13.84a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 0 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Zm9.44-9.44a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 1 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0Z" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" /></svg>
            )}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children(dark)}</div>
    </div>
  );
}

/* Compact KPI tile used across the tools. */
export function StatTile({ label, value, tone, sub }: { label: string; value: string; tone?: "pos" | "neg"; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-neutral-900"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-neutral-400">{sub}</div>}
    </div>
  );
}
