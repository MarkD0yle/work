import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const title = "Exposure Treemap";
export const fullWidth = true;

/* ------------------------------------------------------------------ *
 * Risk — Counterparty Exposure Treemap
 *
 * Every block is a counterparty exposure, sized by notional and tinted
 * by how much of its limit it has eaten. The squarified layout keeps
 * blocks near-square so area reads as magnitude at a glance.
 *
 * Design rule: low utilisation is GREY — a calm, full canvas means a
 * lot of exposure, all comfortably within limit. Amber and red only
 * appear where a line is being tested or has broken. The eye finds the
 * breach by colour, then reads its size by area.
 * ------------------------------------------------------------------ */

/* ---------- Model ---------- */

type Region = "Americas" | "EMEA" | "APAC";
type Asset = "Rates" | "Credit" | "FX" | "Equity" | "Repo";

type Exposure = {
  id: string;
  counterparty: string;
  region: Region;
  desk: string;
  asset: Asset;
  rating: string;
  notional: number; // USD current exposure
  limit: number; // USD limit
};

type GroupDim = "region" | "desk" | "asset";

const EXPOSURES: Exposure[] = [
  { id: "x1", counterparty: "JP Morgan", region: "Americas", desk: "Rates", asset: "Rates", rating: "A+", notional: 1_840_000_000, limit: 2_200_000_000 },
  { id: "x2", counterparty: "Goldman Sachs", region: "Americas", desk: "Rates", asset: "Repo", rating: "A", notional: 1_520_000_000, limit: 1_600_000_000 },
  { id: "x3", counterparty: "Citadel", region: "Americas", desk: "Equity", asset: "Equity", rating: "BBB+", notional: 880_000_000, limit: 850_000_000 },
  { id: "x4", counterparty: "Bank of America", region: "Americas", desk: "Credit", asset: "Credit", rating: "A", notional: 640_000_000, limit: 1_100_000_000 },
  { id: "x5", counterparty: "Wells Fargo", region: "Americas", desk: "FX", asset: "FX", rating: "A-", notional: 410_000_000, limit: 900_000_000 },
  { id: "x6", counterparty: "Morgan Stanley", region: "Americas", desk: "Equity", asset: "Equity", rating: "A-", notional: 720_000_000, limit: 800_000_000 },

  { id: "x7", counterparty: "Deutsche Bank", region: "EMEA", desk: "Rates", asset: "Rates", rating: "BBB", notional: 1_180_000_000, limit: 1_250_000_000 },
  { id: "x8", counterparty: "BNP Paribas", region: "EMEA", desk: "FX", asset: "FX", rating: "A+", notional: 960_000_000, limit: 1_400_000_000 },
  { id: "x9", counterparty: "Barclays", region: "EMEA", desk: "Credit", asset: "Credit", rating: "A", notional: 1_060_000_000, limit: 1_050_000_000 },
  { id: "x10", counterparty: "Credit Suisse Sec", region: "EMEA", desk: "Repo", asset: "Repo", rating: "BBB-", notional: 520_000_000, limit: 520_000_000 },
  { id: "x11", counterparty: "UBS", region: "EMEA", desk: "Equity", asset: "Equity", rating: "A", notional: 440_000_000, limit: 950_000_000 },
  { id: "x12", counterparty: "Societe Generale", region: "EMEA", desk: "Rates", asset: "Rates", rating: "A-", notional: 380_000_000, limit: 700_000_000 },
  { id: "x13", counterparty: "HSBC", region: "EMEA", desk: "FX", asset: "FX", rating: "A+", notional: 690_000_000, limit: 1_200_000_000 },

  { id: "x14", counterparty: "Nomura", region: "APAC", desk: "Rates", asset: "Rates", rating: "BBB+", notional: 760_000_000, limit: 800_000_000 },
  { id: "x15", counterparty: "MUFG", region: "APAC", desk: "FX", asset: "FX", rating: "A", notional: 540_000_000, limit: 1_000_000_000 },
  { id: "x16", counterparty: "Mizuho", region: "APAC", desk: "Credit", asset: "Credit", rating: "A-", notional: 300_000_000, limit: 650_000_000 },
  { id: "x17", counterparty: "Macquarie", region: "APAC", desk: "Equity", asset: "Equity", rating: "BBB+", notional: 420_000_000, limit: 430_000_000 },
  { id: "x18", counterparty: "DBS", region: "APAC", desk: "Repo", asset: "Repo", rating: "AA-", notional: 260_000_000, limit: 600_000_000 },
  { id: "x19", counterparty: "Daiwa", region: "APAC", desk: "Rates", asset: "Rates", rating: "BBB", notional: 180_000_000, limit: 400_000_000 },
];

/* ---------- Squarified treemap ---------- */

type Rect = { x: number; y: number; w: number; h: number };
type Sized<T> = { item: T; area: number };
type Placed<T> = { item: T } & Rect;

function squarify<T>(sized: Sized<T>[], rect: Rect): Placed<T>[] {
  const out: Placed<T>[] = [];
  const totalValue = sized.reduce((s, d) => s + d.area, 0);
  if (totalValue <= 0 || rect.w <= 0 || rect.h <= 0) return out;

  const scale = (rect.w * rect.h) / totalValue;
  const items = sized.map((d) => ({ item: d.item, area: d.area * scale }));

  let { x, y, w, h } = rect;
  let row: { item: T; area: number }[] = [];

  const worst = (r: { area: number }[], side: number) => {
    if (r.length === 0) return Infinity;
    const sum = r.reduce((s, d) => s + d.area, 0);
    const max = Math.max(...r.map((d) => d.area));
    const min = Math.min(...r.map((d) => d.area));
    const s2 = sum * sum;
    const side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  };

  const layoutRow = (r: { item: T; area: number }[]) => {
    const rowArea = r.reduce((s, d) => s + d.area, 0);
    if (w >= h) {
      const rowW = rowArea / h;
      let oy = y;
      for (const d of r) {
        const itemH = d.area / rowW;
        out.push({ item: d.item, x, y: oy, w: rowW, h: itemH });
        oy += itemH;
      }
      x += rowW;
      w -= rowW;
    } else {
      const rowH = rowArea / w;
      let ox = x;
      for (const d of r) {
        const itemW = d.area / rowH;
        out.push({ item: d.item, x: ox, y, w: itemW, h: rowH });
        ox += itemW;
      }
      y += rowH;
      h -= rowH;
    }
  };

  const queue = [...items];
  while (queue.length > 0) {
    const side = Math.min(w, h);
    const next = queue[0];
    if (row.length === 0 || worst(row, side) >= worst([...row, next], side)) {
      row.push(next);
      queue.shift();
    } else {
      layoutRow(row);
      row = [];
    }
  }
  if (row.length > 0) layoutRow(row);
  return out;
}

/* ---------- Color ramp by utilisation ---------- */

type Band = "calm" | "watch" | "near" | "breach";

function utilBand(util: number): Band {
  if (util >= 1) return "breach";
  if (util >= 0.9) return "near";
  if (util >= 0.75) return "watch";
  return "calm";
}

const BAND_META: Record<
  Band,
  { cell: string; label: string; swatch: string; text: string }
> = {
  calm: {
    cell: "bg-neutral-200/80 text-neutral-700 hover:bg-neutral-300/80",
    label: "Within limit",
    swatch: "bg-neutral-300",
    text: "text-neutral-700",
  },
  watch: {
    cell: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    label: "75–90%",
    swatch: "bg-amber-200",
    text: "text-amber-700",
  },
  near: {
    cell: "bg-amber-300 text-amber-950 hover:bg-amber-400",
    label: "90–100%",
    swatch: "bg-amber-400",
    text: "text-amber-800",
  },
  breach: {
    cell: "bg-red-500 text-white hover:bg-red-600",
    label: "Over limit",
    swatch: "bg-red-500",
    text: "text-red-700",
  },
};

/* ---------- Helpers ---------- */

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n}`;
}

function groupKey(e: Exposure, dim: GroupDim): string {
  return dim === "region" ? e.region : dim === "desk" ? e.desk : e.asset;
}

/* ---------- Atoms ---------- */

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "muted" | "warning" | "error" | "ok";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    muted: "bg-neutral-50 text-neutral-500 ring-neutral-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    error: "bg-red-50 text-red-700 ring-red-200",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const HEADER_H = 22;
const CANVAS_H = 540;
const GAP = 2;

/* ================================================================== *
 * Page
 * ================================================================== */

export default function ExposureTreemap() {
  const [dim, setDim] = useState<GroupDim>("region");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Aggregate into groups → leaves.
  const groups = useMemo(() => {
    const map = new Map<string, Exposure[]>();
    for (const e of EXPOSURES) {
      const k = groupKey(e, dim);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items,
        notional: items.reduce((s, e) => s + e.notional, 0),
        limit: items.reduce((s, e) => s + e.limit, 0),
      }))
      .sort((a, b) => b.notional - a.notional);
  }, [dim]);

  // Layout: top-level groups, then leaves within each group rect.
  const placed = useMemo(() => {
    const groupRects = squarify(
      groups.map((g) => ({ item: g, area: g.notional })),
      { x: 0, y: 0, w: width, h: CANVAS_H },
    );
    type Cell = Placed<Exposure> & { groupKey: string };
    const cells: Cell[] = [];
    const headers: { key: string; rect: Rect; notional: number; util: number }[] =
      [];
    for (const gr of groupRects) {
      const inner: Rect = {
        x: gr.x + GAP,
        y: gr.y + GAP,
        w: gr.w - GAP * 2,
        h: gr.h - GAP * 2,
      };
      const showHeader = inner.h > HEADER_H + 24 && inner.w > 60;
      const bodyRect: Rect = showHeader
        ? { x: inner.x, y: inner.y + HEADER_H, w: inner.w, h: inner.h - HEADER_H }
        : inner;
      headers.push({
        key: gr.item.key,
        rect: { ...inner, h: showHeader ? HEADER_H : inner.h },
        notional: gr.item.notional,
        util: gr.item.notional / gr.item.limit,
      });
      const leafRects = squarify(
        gr.item.items
          .slice()
          .sort((a, b) => b.notional - a.notional)
          .map((e) => ({ item: e, area: e.notional })),
        bodyRect,
      );
      for (const lr of leafRects)
        cells.push({ ...lr, groupKey: gr.item.key });
    }
    return { cells, headers };
  }, [groups, width]);

  // KPIs
  const total = EXPOSURES.reduce((s, e) => s + e.notional, 0);
  const breaches = EXPOSURES.filter((e) => e.notional >= e.limit);
  const near = EXPOSURES.filter(
    (e) => e.notional / e.limit >= 0.9 && e.notional < e.limit,
  );
  const topUtil = EXPOSURES.reduce((a, b) =>
    b.notional / b.limit > a.notional / a.limit ? b : a,
  );

  const focusId = hovered ?? selected;
  const focusExp = EXPOSURES.find((e) => e.id === (selected ?? hovered)) ?? null;

  const overall = breaches.length > 0 ? "error" : near.length > 0 ? "warning" : "ok";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            Exposure Treemap
          </span>
          <span className="text-xs text-neutral-400">
            Counterparty credit · {compactUsd(total)} gross
          </span>
        </div>

        {/* grouping segmented */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
          {(["region", "desk", "asset"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDim(d);
                setSelected(null);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                dim === d
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              By {d}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          {overall === "ok" ? (
            <Badge tone="ok">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              All lines within limit
            </Badge>
          ) : overall === "warning" ? (
            <Badge tone="warning">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {near.length} line{near.length > 1 ? "s" : ""} near limit
            </Badge>
          ) : (
            <Badge tone="error">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {breaches.length} limit breach{breaches.length > 1 ? "es" : ""}
            </Badge>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1700px] px-8 py-6">
          {/* ---------- KPI strip ---------- */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Gross exposure" value={compactUsd(total)} hint={`${EXPOSURES.length} counterparties`} />
            <Kpi label="Breaches" value={String(breaches.length)} hint="Over limit" tone={breaches.length ? "error" : "neutral"} />
            <Kpi label="Near limit" value={String(near.length)} hint="≥ 90% utilised" tone={near.length ? "warning" : "neutral"} />
            <Kpi
              label="Top utilisation"
              value={`${Math.round((topUtil.notional / topUtil.limit) * 100)}%`}
              hint={topUtil.counterparty}
              tone={topUtil.notional >= topUtil.limit ? "error" : "warning"}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
            {/* ---------- Treemap canvas ---------- */}
            <section className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div
                ref={containerRef}
                className="relative w-full"
                style={{ height: CANVAS_H }}
                onMouseLeave={() => setHovered(null)}
              >
                {/* group header labels */}
                {placed.headers.map((h) => (
                  <div
                    key={`h-${h.key}`}
                    className="pointer-events-none absolute flex items-center gap-2 px-1"
                    style={{
                      left: h.rect.x,
                      top: h.rect.y,
                      width: h.rect.w,
                      height: h.rect.h,
                    }}
                  >
                    <span className="truncate text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                      {h.key}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      {compactUsd(h.notional)}
                    </span>
                  </div>
                ))}

                {/* leaf cells */}
                {placed.cells.map((c) => {
                  const util = c.item.notional / c.item.limit;
                  const band = utilBand(util);
                  const meta = BAND_META[band];
                  const isFocus = focusId === c.item.id;
                  const big = c.w > 58 && c.h > 30;
                  return (
                    <button
                      key={c.item.id}
                      type="button"
                      onMouseEnter={() => setHovered(c.item.id)}
                      onClick={() =>
                        setSelected((s) => (s === c.item.id ? null : c.item.id))
                      }
                      title={`${c.item.counterparty} · ${compactUsd(c.item.notional)} · ${Math.round(util * 100)}% of limit`}
                      className={`absolute overflow-hidden rounded-[3px] border border-white/70 px-1.5 py-1 text-left transition ${meta.cell} ${
                        isFocus ? "z-10 ring-2 ring-neutral-900 ring-offset-1" : ""
                      }`}
                      style={{
                        left: c.x,
                        top: c.y,
                        width: Math.max(0, c.w - GAP),
                        height: Math.max(0, c.h - GAP),
                      }}
                    >
                      {big && (
                        <>
                          <div className="truncate text-[11px] font-semibold leading-tight">
                            {c.item.counterparty}
                          </div>
                          <div className="truncate font-mono text-[10px] leading-tight opacity-80">
                            {compactUsd(c.item.notional)}
                          </div>
                          {c.h > 48 && (
                            <div className="mt-0.5 font-mono text-[10px] leading-tight opacity-70">
                              {Math.round(util * 100)}%
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* legend */}
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-neutral-100 pt-3">
                <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Limit use
                </span>
                {(["calm", "watch", "near", "breach"] as const).map((b) => (
                  <span key={b} className="flex items-center gap-1.5">
                    <span className={`h-3 w-3 rounded-sm ${BAND_META[b].swatch}`} />
                    <span className="text-[11px] text-neutral-500">
                      {BAND_META[b].label}
                    </span>
                  </span>
                ))}
                <span className="ml-auto text-[11px] text-neutral-400">
                  Area = notional · colour = % of limit
                </span>
              </div>
            </section>

            {/* ---------- Detail panel ---------- */}
            <aside className="rounded-2xl border border-neutral-200 bg-white p-5">
              {focusExp ? (
                <ExposureDetail exp={focusExp} pinned={!!selected && !hovered} />
              ) : (
                <div className="flex h-full flex-col">
                  <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                    Top utilisation
                  </h2>
                  <p className="mt-2 text-[11px] text-neutral-400">
                    Hover a block for detail, click to pin. The largest red
                    block is the biggest breach by notional.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {[...EXPOSURES]
                      .sort(
                        (a, b) => b.notional / b.limit - a.notional / a.limit,
                      )
                      .slice(0, 6)
                      .map((e) => {
                        const util = e.notional / e.limit;
                        const meta = BAND_META[utilBand(util)];
                        return (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(e.id)}
                              onMouseEnter={() => setHovered(e.id)}
                              onMouseLeave={() => setHovered(null)}
                              className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-left hover:bg-neutral-50"
                            >
                              <span className={`h-7 w-1 rounded-full ${meta.swatch}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-neutral-800">
                                  {e.counterparty}
                                </span>
                                <span className="block font-mono text-[10px] text-neutral-400">
                                  {compactUsd(e.notional)}
                                </span>
                              </span>
                              <span
                                className={`font-mono text-sm font-semibold tabular-nums ${meta.text}`}
                              >
                                {Math.round(util * 100)}%
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * KPI tile
 * ================================================================== */

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "error";
}) {
  const accent = {
    neutral: "border-l-neutral-300",
    warning: "border-l-amber-500",
    error: "border-l-red-500",
  }[tone];
  const valueColor = {
    neutral: "text-neutral-900",
    warning: "text-amber-700",
    error: "text-red-700",
  }[tone];
  return (
    <div
      className={`rounded-xl border border-l-4 border-neutral-200 bg-white p-4 ${accent}`}
    >
      <div className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

/* ================================================================== *
 * Exposure detail
 * ================================================================== */

function ExposureDetail({ exp, pinned }: { exp: Exposure; pinned: boolean }) {
  const util = exp.notional / exp.limit;
  const band = utilBand(util);
  const meta = BAND_META[band];
  const headroom = exp.limit - exp.notional;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {exp.counterparty}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {exp.region} · {exp.desk} · {exp.asset}
          </p>
        </div>
        {pinned && <Badge tone="muted">pinned</Badge>}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Badge tone="neutral">{exp.rating}</Badge>
        <Badge
          tone={
            band === "breach"
              ? "error"
              : band === "calm"
                ? "muted"
                : "warning"
          }
        >
          {Math.round(util * 100)}% of limit
        </Badge>
      </div>

      {/* utilisation bar */}
      <div className="mt-4">
        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={meta.swatch + " absolute inset-y-0 left-0 rounded-full"}
            style={{ width: `${Math.min(100, util * 100)}%` }}
          />
          {/* limit marker */}
          <div className="absolute inset-y-0 right-0 w-px bg-neutral-400" />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-400">
          <span>{compactUsd(exp.notional)} used</span>
          <span>limit {compactUsd(exp.limit)}</span>
        </div>
      </div>

      {/* figures */}
      <dl className="mt-5 space-y-2.5">
        {[
          { k: "Current exposure", v: compactUsd(exp.notional) },
          { k: "Limit", v: compactUsd(exp.limit) },
          {
            k: "Headroom",
            v: headroom >= 0 ? compactUsd(headroom) : `-${compactUsd(-headroom)}`,
            tone: headroom < 0 ? "text-red-700" : "text-neutral-800",
          },
        ].map((row) => (
          <div key={row.k} className="flex items-center justify-between">
            <dt className="text-xs text-neutral-500">{row.k}</dt>
            <dd
              className={`font-mono text-sm font-semibold tabular-nums ${
                "tone" in row ? (row.tone as string) : "text-neutral-800"
              }`}
            >
              {row.v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
          {band === "breach" ? "Escalate breach" : "Run what-if"}
        </button>
        <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          View limits
        </button>
      </div>
    </div>
  );
}
